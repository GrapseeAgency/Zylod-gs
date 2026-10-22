import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * THE BUYER→SELLER QUERY RAIL (Task 146) — the writer half the queries
 * inbox always lacked. The reader (/api/supplier/queries) and the reply
 * (/api/supplier/queries/[id]) existed since Tasks 121/133, but NO buyer
 * path ever created a row: the seller's Queries inbox was a permanently
 * empty surface. This rail closes the circuit.
 *
 * POST /api/queries — a signed-in BUYER files pre_order / custom_request /
 * complaint questions to a real store. 'product_question' is refused with
 * a pointer to the product's own Q&A rail (Task 93) — one question, one
 * home. The target supplier is resolved SERVER-SIDE: by productId (the
 * product's OWN store, the id-space rule — products.supplierId IS the
 * supplierProfiles id) or by supplierId directly; when both are sent they
 * must agree. The supplier is told (durable notification + live
 * seller:<id> tap) and the filing is audited.
 *
 * GET /api/queries — the buyer's OWN filings newest-first, replies included,
 * so the buyer can actually read the answer they were notified about.
 */

const QueryCreateSchema = z
  .object({
    productId: z.string().trim().min(1).max(64).optional(),
    supplierId: z.string().trim().min(1).max(64).optional(),
    queryType: z.enum(['pre_order', 'custom_request', 'complaint']),
    subject: z.string().trim().min(3).max(160),
    message: z.string().trim().min(5).max(2000),
  })
  .strict()
  .refine((v) => v.productId || v.supplierId, { message: 'A store or a product is required' })

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'buyer-query-create', 5, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = QueryCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const flat = parsed.error.issues[0]
      return NextResponse.json({ error: flat?.message || 'Invalid query' }, { status: 400 })
    }
    const { productId, supplierId, queryType, subject, message } = parsed.data

    let targetSupplierId: string | null = null

    if (productId) {
      // The product's OWN store receives the question — a query can never be
      // steered to a store that does not own the goods.
      const product = await db.products.findUnique({
        where: { id: productId },
        select: { supplierId: true, isActive: true, isApproved: true, name: true },
      })
      if (!product || !product.isActive || !product.isApproved) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      if (supplierId && supplierId !== product.supplierId) {
        return NextResponse.json(
          { error: 'That store does not own this product — the question goes to the product\'s own seller' },
          { status: 400 }
        )
      }
      targetSupplierId = product.supplierId
    } else if (supplierId) {
      const supplier = await db.supplierProfiles.findUnique({
        where: { id: supplierId },
        select: { id: true },
      })
      if (!supplier) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 })
      }
      targetSupplierId = supplier.id
    }

    if (!targetSupplierId) {
      return NextResponse.json({ error: 'A store or a product is required' }, { status: 400 })
    }

    const row = await db.sellerCustomerQueries.create({
      data: {
        supplierId: targetSupplierId,
        buyerId: auth.user.id,
        productId: productId ?? null,
        queryType,
        subject,
        message,
        status: 'open',
      },
    })

    // The supplier is TOLD — durable notification + a live tap on their room.
    await sendNotification({
      userId: (await db.supplierProfiles.findUnique({ where: { id: targetSupplierId }, select: { userId: true } }))?.userId ?? auth.user.id,
      type: 'system',
      title: `New ${queryType.replace('_', ' ')} from a buyer`,
      body: `"${subject}" — open your Queries inbox to reply.`,
      relatedEntityId: row.id,
    }).catch(() => { /* telling is best-effort; the row is the truth */ })
    void broadcastToRoom(`seller:${targetSupplierId}`, 'query:new', { queryId: row.id, queryType })

    await db.auditLogs
      .create({
        data: {
          actorId: auth.user.id,
          action: 'buyer_query_created',
          entityType: 'sellerCustomerQueries',
          entityId: row.id,
          metadata: JSON.stringify({ supplierId: targetSupplierId, queryType, subject, productId: productId ?? null }),
        },
      })
      .catch(() => { /* evidence, not a gate */ })

    return NextResponse.json(
      { success: true, data: { id: row.id, status: row.status }, message: 'Query filed — the seller has been notified.' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Buyer query POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'buyer-query-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rows = await db.sellerCustomerQueries.findMany({
      where: { buyerId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        supplier: { select: { companyName: true } },
        // NOTE: sellerCustomerQueries carries productId but has NO product
        // relation in the schema — names resolve in a second query below.
      },
    })

    const productIds = rows.map((r) => r.productId).filter(Boolean) as string[]
    const productRows = productIds.length
      ? await db.products.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : []
    const productMap = new Map(productRows.map((p) => [p.id, p]))

    return NextResponse.json({
      success: true,
      data: {
        queries: rows.map((r) => ({
          id: r.id,
          queryType: r.queryType,
          subject: r.subject,
          message: r.message,
          status: r.status,
          replyMessage: r.replyMessage,
          repliedAt: r.repliedAt,
          createdAt: r.createdAt,
          supplierName: r.supplier?.companyName ?? null,
          product: r.productId ? productMap.get(r.productId) ?? null : null,
        })),
      },
    })
  } catch (error) {
    console.error('Buyer queries GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
