import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/returns — the authenticated buyer's return requests (newest first).
 * Optional filters: ?orderId=<id> — returns for one order only.
 * Every row is real DB data; no fabricated statuses or pickup promises.
 * Refunds (Task 47): each row carries the real refunds[] ledger rows (money
 * that actually moved outside the system) — empty array when nothing refunded.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'returns-list', 60, 60 * 1000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const url = new URL(request.url)
    const orderId = url.searchParams.get('orderId') || undefined

    const returns = await db.returnRequests.findMany({
      where: {
        buyerId: auth.user.id,
        ...(orderId ? { orderId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Items are fetched separately (plain string FK, no Prisma relation).
    const returnIds = returns.map(r => r.id)
    const allItems = returnIds.length
      ? await db.returnRequestItems.findMany({ where: { returnRequestId: { in: returnIds } } })
      : []
    const itemsByReturn = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const list = itemsByReturn.get(item.returnRequestId) ?? []
      list.push(item)
      itemsByReturn.set(item.returnRequestId, list)
    }

    // Real refund ledger rows (one batched query) — only for THIS buyer's
    // returns, so no other buyer's refund data can leak through this endpoint.
    const allRefunds = returnIds.length
      ? await db.refunds.findMany({
          where: { returnRequestId: { in: returnIds }, buyerId: auth.user.id },
          orderBy: { createdAt: 'desc' },
        })
      : []
    const refundsByReturn = new Map<string, typeof allRefunds>()
    for (const refund of allRefunds) {
      const list = refundsByReturn.get(refund.returnRequestId) ?? []
      list.push(refund)
      refundsByReturn.set(refund.returnRequestId, list)
    }

    // Attach minimal real order info for context (orderNumber only).
    const orderIds = [...new Set(returns.map(r => r.orderId))]
    const orders = orderIds.length
      ? await db.orders.findMany({
          where: { id: { in: orderIds }, buyerId: auth.user.id },
          select: { id: true, orderNumber: true, paymentStatus: true },
        })
      : []
    const orderById = new Map(orders.map(o => [o.id, o]))

    return NextResponse.json({
      success: true,
      data: returns.map(r => ({
        id: r.id,
        returnNumber: r.returnNumber,
        orderId: r.orderId,
        orderNumber: orderById.get(r.orderId)?.orderNumber ?? null,
        status: r.status,
        shippingMethod: r.shippingMethod,
        estimatedRefund: r.estimatedRefund,
        resolutionNote: r.resolutionNote,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        items: (itemsByReturn.get(r.id) ?? []).map(i => ({
          id: i.id,
          orderItemId: i.orderItemId,
          reason: i.reason,
          quantity: i.quantity,
          comments: i.comments,
        })),
        refunds: (refundsByReturn.get(r.id) ?? []).map(f => ({
          id: f.id,
          amount: f.amount,
          method: f.method,
          reference: f.reference,
          status: f.status,
          processedAt: f.createdAt.toISOString(),
          note: f.note,
        })),
      })),
    })
  } catch (error) {
    console.error('Returns list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
