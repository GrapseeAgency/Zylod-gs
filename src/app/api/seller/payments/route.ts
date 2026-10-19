import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/seller/payments — the seller's payment-verification inbox (Task
 * 56-b). Every payments row whose ORDER carries a subOrder for the session
 * supplier's profile — i.e. the buyer paid (or claims to have paid) for goods
 * THIS seller ships. A pending row here is a real submission from
 * POST /api/orders/[id]/payment-submit waiting for the seller's
 * verify/reject decision (POST /api/seller/payments/[id]/verify).
 *
 * Contract:
 * - 401-first (authenticateRequest), then the supplier-profile resolution —
 *   a session without a real supplierProfile gets the honest 403
 *   SUPPLIER_PROFILE_REQUIRED (never a fabricated or borrowed profile).
 * - Rate limit 30/min 'seller-payments-list'.
 * - ?status=pending|success|failed|refunded|all (default all). The default
 *   ordering is the VERIFICATION QUEUE order: pending → success → failed →
 *   refunded, newest-first inside each group (implemented as per-status
 *   queries concatenated in rank order — deterministic and honest, take 50
 *   overall).
 * - Rows carry the order's real orderNumber/totalAmount/paymentStatus, the
 *   item count and the first item names as a minimal summary — no buyer PII
 *   beyond what the seller already sees on their orders surface.
 */

const TAKE = 50

// Real payments.status values (prisma/schema.prisma) in verification-queue rank.
const STATUS_RANK = ['pending', 'success', 'failed', 'refunded'] as const

/** The buyer-supplied brand (bKash / Nagad / …) lives in the submit JSON. */
function extractBrand(gatewayResponse: string | null): string | null {
  try {
    const g = gatewayResponse ? (JSON.parse(gatewayResponse) as { brand?: unknown }) : null
    return g && typeof g.brand === 'string' && g.brand.length > 0 ? g.brand : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Seller scope — no supplier profile, no seller data (honest 403).
  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }

  const rl = checkRateLimit(request, 'seller-payments-list', 30, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const rawStatus = searchParams.get('status') || 'all'
    const status = rawStatus === '' ? 'all' : rawStatus
    if (!['pending', 'success', 'failed', 'refunded', 'all'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of pending, success, failed, refunded, all' },
        { status: 400 }
      )
    }

    // The join is through order.subOrders — a payment is the seller's when
    // its order has a subOrder row with THIS supplierProfiles.id.
    const orderWhere = { subOrders: { some: { supplierId: profile.id } } }

    let paymentsList
    if (status === 'all') {
      // Queue order: fetch each real status group (newest-first) and
      // concatenate pending → success → failed → refunded, capped at 50.
      const groups = await Promise.all(
        STATUS_RANK.map((s) =>
          db.payments.findMany({
            where: { status: s, order: orderWhere },
            orderBy: { id: 'desc' },
            take: TAKE,
            include: {
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  totalAmount: true,
                  paymentStatus: true,
                  subOrders: {
                    where: { supplierId: profile.id },
                    include: {
                      items: { select: { quantity: true, product: { select: { name: true } } } },
                    },
                  },
                },
              },
            },
          })
        )
      )
      paymentsList = groups.flat().slice(0, TAKE)
    } else {
      paymentsList = await db.payments.findMany({
        where: { status, order: orderWhere },
        orderBy: { id: 'desc' },
        take: TAKE,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              paymentStatus: true,
              subOrders: {
                where: { supplierId: profile.id },
                include: {
                  items: { select: { quantity: true, product: { select: { name: true } } } },
                },
              },
            },
          },
        },
      })
    }

    const data = paymentsList.map((p) => {
      const ownSubOrders = p.order.subOrders
      const itemCount = ownSubOrders.reduce((sum, so) => sum + so.items.length, 0)
      const itemSummary = ownSubOrders
        .flatMap((so) => so.items.map((i) => i.product?.name || ''))
        .filter((n) => n.length > 0)
        .slice(0, 3)
      // payments has NO createdAt column — the buyer's submission timestamp
      // lives inside the gatewayResponse JSON written by payment-submit.
      let submittedAt: string | null = null
      try {
        const g = p.gatewayResponse ? (JSON.parse(p.gatewayResponse) as { submittedAt?: unknown }) : null
        if (g && typeof g.submittedAt === 'string') submittedAt = g.submittedAt
      } catch {
        /* gatewayResponse written by another producer (webhook note) — no timestamp */
      }
      return {
        id: p.id,
        orderId: p.order.id,
        orderNumber: p.order.orderNumber,
        orderTotal: p.order.totalAmount,
        orderPaymentStatus: p.order.paymentStatus,
        method: p.method,
        amount: p.amount,
        status: p.status,
        transactionId: p.transactionId,
        brand: extractBrand(p.gatewayResponse),
        submittedAt,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        itemCount,
        itemSummary,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Seller payments GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
