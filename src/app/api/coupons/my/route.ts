import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/coupons/my
 * User's coupon vault with status filters (active, used, expired).
 *
 * Task 143 (audit completion): the vault is ONE honest list. It merges
 * (a) claimed platform vouchers (userCoupons rows) and (b) EARNED personal
 * vouchers (coupons rows bound to this buyer — points redemption writes
 * there because that is the table checkout validates against). Both are
 * mapped into the same display shape, the status filter applies to both,
 * and the merged list is sorted newest-first and paginated. A voucher that
 * is spendable at checkout is never invisible in the vault, and a voucher
 * shown active here is never spent at checkout.
 */

type VaultCoupon = {
  id: string
  code: string
  title: string
  discountStyle: string
  discountLabel: string
  status: string
  validUntil: Date
  savingsBDT: number
  minOrderBDT: number
  categoryLabel: string | null
  categoryColor: string | null
  claimedAt: Date
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') || 'active'
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))

    const now = new Date()

    // (a) claimed platform vouchers — status lives on the row itself.
    const userWhere: Record<string, unknown> = { userId: auth.user.id }
    if (status === 'active') {
      userWhere.status = 'active'
      userWhere.validUntil = { gte: now }
    } else if (status === 'used') {
      userWhere.status = 'used'
    } else if (status === 'expired') {
      userWhere.OR = [
        { status: 'expired' },
        { validUntil: { lt: now }, status: 'active' },
      ]
    }

    // (b) earned bound vouchers — status is DERIVED: a single-use voucher
    // whose usedCount reached its usageLimit was spent at checkout ('used'
    // wins over expiry, mirroring the userCoupons precedence); one past its
    // validUntil is 'expired'; otherwise 'active'.
    const boundRows = await db.coupons.findMany({
      where: { userId: auth.user.id },
      // coupons carries NO createdAt — validFrom is the issue moment for
      // earned vouchers (redeem stamps it with `new Date()`).
      orderBy: { validFrom: 'desc' },
    })

    const derived: VaultCoupon[] = boundRows.map((c) => {
      const used = c.usageLimit !== null && c.usedCount >= c.usageLimit
      const pastDue = c.validUntil < now
      const derivedStatus = used ? 'used' : pastDue ? 'expired' : 'active'
      const value = c.discountPercent
      return {
        id: c.id,
        code: c.code,
        title: `৳${value} Loyalty Voucher`,
        discountStyle: 'fixed',
        discountLabel: `৳${value} FLAT OFF`,
        status: derivedStatus,
        validUntil: c.validUntil,
        savingsBDT: value,
        minOrderBDT: c.minOrderAmount ?? 0,
        categoryLabel: 'Loyalty Reward',
        categoryColor: '#D97706',
        claimedAt: c.validFrom,
      }
    })

    const userCoupons = await db.userCoupons.findMany({
      where: userWhere,
      orderBy: { claimedAt: 'desc' },
    })

    // Merge → sort newest-first → apply the status filter to the union →
    // paginate. A buyer's own vouchers are bounded (claimed + earned), so
    // the in-memory merge stays honest and cheap; both sources are
    // userId-scoped queries, never a table scan.
    const claimed: VaultCoupon[] = userCoupons.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      discountStyle: c.discountStyle,
      discountLabel: c.discountLabel,
      status: c.status,
      validUntil: c.validUntil,
      savingsBDT: c.savingsBDT,
      minOrderBDT: c.minOrderBDT,
      categoryLabel: c.categoryLabel,
      categoryColor: c.categoryColor,
      claimedAt: c.claimedAt,
    }))

    const filteredDerived = derived.filter((c) =>
      status === 'active' ? c.status === 'active' : status === 'used' ? c.status === 'used' : c.status === 'expired'
    )

    const merged = [...claimed, ...filteredDerived].sort(
      (a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime()
    )

    const total = merged.length
    const totalPages = Math.ceil(total / limit)
    const paged = merged.slice((page - 1) * limit, (page - 1) * limit + limit)

    return NextResponse.json({
      success: true,
      data: paged,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('My coupons GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
