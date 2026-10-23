import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/coupons/claim
 * Claim/collect an active coupon code to the user's personal voucher vault.
 * Body: { couponId?: string, code?: string }
 *
 * Audit unit 19 hardened the money rails:
 *   - The claim is ONE transaction (re-check inside the tx, the same blessed
 *     pattern as the earn route): the old check-then-create raced two
 *     concurrent claims into duplicate vouchers (double money promises with
 *     no DB unique backstop on userCoupons).
 *   - Concurrent claims of the SAME code are serialized per-process through
 *     a tiny promise queue BEFORE any transaction starts — SQLite serializes
 *     writers, so N simultaneous tx calls would otherwise each sit on the
 *     write lock until the 5s interactive-transaction timeout expires and
 *     500 (caught live by the t161 storm probe). With the queue each waiter
 *     runs after the previous claimant, sees the duplicate row, and gets the
 *     honest 409.
 *   - coupons.usageLimit is now ENFORCED at claim time (the old rail only
 *     incremented usedCount for display; the apply rail was the sole gate).
 *   - Task 143's personal-voucher binding is enforced here too: a coupon
 *     owned by another buyer (earned reward codes) is a 403, not a junk
 *     vault row that fails at apply.
 */

// Per-coupon claim queues (module scope). Value = the tail promise of the
// queue; every new claim chains onto it. Entries self-clean when the tail
// settles so the map never grows.
const claimQueues = new Map<string, Promise<unknown>>()
function enqueueClaim<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = claimQueues.get(key) ?? Promise.resolve()
  const run = prev.then(() => null, () => null).then(fn)
  claimQueues.set(key, run)
  void run.catch(() => null).then(() => {
    if (claimQueues.get(key) === run) claimQueues.delete(key)
  })
  return run
}
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const rl = checkRateLimit(request, 'coupons-claim', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { couponId, code } = body as Record<string, unknown>
    const extraKeys = Object.keys(body as Record<string, unknown>).filter((k) => k !== 'couponId' && k !== 'code')
    if (extraKeys.length > 0) {
      return NextResponse.json({ error: `Unknown fields not allowed: ${extraKeys.join(', ')}` }, { status: 400 })
    }
    if (couponId !== undefined && couponId !== null && typeof couponId !== 'string') {
      return NextResponse.json({ error: 'couponId must be a string' }, { status: 400 })
    }
    if (code !== undefined && code !== null && typeof code !== 'string') {
      return NextResponse.json({ error: 'code must be a string' }, { status: 400 })
    }
    if (!couponId && !code) {
      return NextResponse.json({ error: 'couponId or code is required' }, { status: 400 })
    }

    const userId = auth.user.id // narrow once — the tx closure cannot see the guard
    // Serialize same-coupon claims before touching the DB (see docblock).
    const queueKey = String(couponId ?? String(code).toUpperCase())
    const claimed = await enqueueClaim(queueKey, () => db.$transaction(async (tx) => {
      // Re-read the coupon INSIDE the transaction so the checks below and the
      // writes share one consistent snapshot (SQLite serializes writers).
      const coupon = couponId
        ? await tx.coupons.findUnique({ where: { id: couponId } })
        : await tx.coupons.findUnique({ where: { code: String(code).toUpperCase() } })

      if (!coupon || !coupon.isActive) {
        return { status: 404 as const, error: 'Coupon not found or inactive' }
      }
      if (new Date(coupon.validUntil) < new Date()) {
        return { status: 400 as const, error: 'This coupon has expired' }
      }
      // Task 143 binding — personal money promises belong to their buyer only.
      if (coupon.userId && coupon.userId !== userId) {
        return { status: 403 as const, error: 'This voucher belongs to another buyer — it cannot be collected with its code.' }
      }
      // usageLimit is a real cap: once exhausted the code stops being claimable.
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        return { status: 409 as const, error: 'This coupon has been fully claimed — the usage limit is reached.' }
      }
      // Duplicate-claim re-check INSIDE the tx (closes the TOCTOU that let two
      // concurrent claims mint two active vouchers from one code).
      const alreadyClaimed = await tx.userCoupons.findFirst({
        where: { userId, code: coupon.code, status: 'active' },
        select: { id: true },
      })
      if (alreadyClaimed) {
        return { status: 409 as const, error: 'You have already collected this coupon' }
      }

      const discountLabel = coupon.discountType === 'percentage'
        ? `${coupon.discountPercent}% OFF`
        : `৳${coupon.discountPercent} FLAT`

      const userCoupon = await tx.userCoupons.create({
        data: {
          userId,
          couponId: coupon.id,
          code: coupon.code,
          title: `Coupon: ${coupon.code}`,
          discountStyle: coupon.discountType === 'percentage' ? 'percentage' : 'fixed',
          discountLabel,
          status: 'active',
          validUntil: coupon.validUntil,
          savingsBDT: coupon.discountPercent,
          minOrderBDT: coupon.minOrderAmount || 0,
          categoryLabel: 'Wholesale',
          categoryColor: '#E53935',
        },
      })

      await tx.coupons.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      })

      return { status: 201 as const, userCoupon, discountLabel, validUntil: coupon.validUntil, code: coupon.code }
    }, { maxWait: 2_000, timeout: 10_000 }))

    if (claimed.status !== 201) {
      return NextResponse.json({ error: claimed.error }, { status: claimed.status })
    }

    // Dispatch real in-app confirmation notification (post-commit; a dead
    // notification path never rolls back the claim — the row is the truth).
    await sendNotification({
      userId,
      type: 'promotion',
      title: `Coupon Collected: ${claimed.code}`,
      body: `You claimed ${claimed.discountLabel} discount for your next wholesale order. Valid until ${new Date(claimed.validUntil).toLocaleDateString('en-GB')}.`,
      relatedEntityId: claimed.userCoupon.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Coupon claimed successfully!',
      data: claimed.userCoupon,
    }, { status: 201 })
  } catch (error) {
    console.error('Coupon claim error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
