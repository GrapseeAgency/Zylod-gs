import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { roundQty } from '@/lib/product-contract'

/**
 * GET /api/rfq — list RFQ requests for the authenticated user
 * Query params: role (buyer|supplier), status, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const { searchParams } = request.nextUrl
    const role = searchParams.get('role') || auth.user.userType || 'buyer'
    const status = searchParams.get('status') || ''
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))

    const skip = (page - 1) * limit
    // Task 82: role=supplier filters by the caller's SUPPLIER PROFILE id —
    // rfqQuotes.supplierId is a supplierProfiles reference (schema relation),
    // so the old `supplierId: userId` compared two different id spaces and
    // always matched nothing (a seller listing their quoted RFQs via this
    // route saw an empty list). Sellers without a profile get an honest
    // empty result, not a silent wrong one.
    let supplierFilterId: string | null = null
    if (role === 'supplier') {
      const profile = await db.supplierProfiles.findUnique({
        where: { userId },
        select: { id: true },
      })
      supplierFilterId = profile?.id ?? null
    }
    const where: Record<string, unknown> =
      role === 'supplier'
        ? supplierFilterId
          ? { quotes: { some: { supplierId: supplierFilterId } } }
          : { id: '__no_supplier_profile__' } // honest empty set
        : { buyerId: userId }
    if (status) Object.assign(where, { status })

    const [rfqs, total] = await Promise.all([
      db.rfqRequests.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: true,
          quotes: role === 'supplier'
            ? { where: { supplierId: supplierFilterId ?? '__none__' } }
            : { take: 5, orderBy: { createdAt: 'desc' } },
          _count: { select: { quotes: true } },
        },
      }),
      db.rfqRequests.count({ where }),
    ])

    const data = rfqs.map(r => ({
      id: r.id,
      buyerId: r.buyerId,
      title: r.title,
      description: r.description,
      categorySlug: r.categorySlug,
      quantity: r.quantity,
      unit: r.unit,
      targetPrice: r.targetPrice,
      deliveryCity: r.deliveryCity,
      deadline: r.deadline,
      status: r.status,
      // Task 55-b (additive): product link + conversion state so the buyer UI
      // can show the 'Order placed' chip and gate 'Convert to order'.
      productId: r.productId,
      convertedOrderId: r.convertedOrderId,
      convertedOrderNumber: r.convertedOrderNumber,
      items: r.items,
      quotes: r.quotes,
      quoteCount: r._count.quotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('RFQ GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/rfq — create a new RFQ request
 * Body: { title, description, categorySlug?, productId?, quantity?, unit?, targetPrice?, deliveryCity?, deadline?, items? }
 * buyerId is taken from auth token.
 *
 * Task 55-b (ADDITIVE): optional productId links the RFQ to a marketplace
 * product. It must reference an ACTIVE + APPROVED product (the same live
 * visibility rule the public catalog and the order path use) — anything else
 * is a 400 with a truthful message, because a linked-but-dead product would
 * make the eventual quote→order conversion impossible. When absent, the RFQ
 * behaves exactly as before (freeform request; such RFQs are honestly NOT
 * convertible to orders later — there is no SKU to buy).
 */
const productIdSchema = z.string().min(1).optional().nullable()
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const buyerId = auth.user.id

    const body = await request.json()
    const { title, description, categorySlug, quantity, unit, targetPrice, deliveryCity, deadline, items } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 })
    }

    // Optional product link (Task 55-b) — Zod type check, then a REAL
    // active+approved existence check. Truthful 400s; nothing else changes.
    const parsedProductId = productIdSchema.safeParse(body.productId)
    if (!parsedProductId.success) {
      return NextResponse.json({ error: 'productId must be a non-empty string' }, { status: 400 })
    }
    let safeProductId: string | null = null
    if (parsedProductId.data) {
      const linked = await db.products.findUnique({ where: { id: parsedProductId.data } })
      if (!linked) {
        return NextResponse.json({ error: 'The linked product does not exist' }, { status: 400 })
      }
      if (!linked.isActive || !linked.isApproved) {
        return NextResponse.json(
          { error: 'The linked product is not an active, approved marketplace product' },
          { status: 400 }
        )
      }
      safeProductId = linked.id
    }

    // Unit-bearing decimals (kg: 12.5 kg inquiry is valid) — 2 dp normalization.
    const safeQuantity =
      quantity != null && Number.isFinite(Number(quantity)) && Number(quantity) > 0
        ? roundQty(Number(quantity))
        : null
    const safeItems = Array.isArray(items)
      ? items.map((item: { productName: string; specifications?: string; quantity: number; unit?: string; targetPrice?: number }) => ({
          ...item,
          quantity:
            item.quantity != null && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
              ? roundQty(Number(item.quantity))
              : 1,
        }))
      : undefined

    const rfq = await db.rfqRequests.create({
      data: {
        buyerId,
        title,
        description,
        categorySlug: categorySlug || null,
        productId: safeProductId,
        quantity: safeQuantity,
        unit: unit || 'pcs',
        targetPrice: targetPrice || null,
        deliveryCity: deliveryCity || null,
        deadline: deadline ? new Date(deadline) : null,
        items: safeItems
          ? { create: safeItems.map((item: { productName: string; specifications?: string; quantity: number; unit?: string; targetPrice?: number }) => ({
              productName: item.productName,
              specifications: item.specifications || null,
              quantity: item.quantity,
              unit: item.unit || 'pcs',
              targetPrice: item.targetPrice || null,
            })) }
          : undefined,
      },
      include: { items: true },
    })

    return NextResponse.json({ success: true, data: rfq }, { status: 201 })
  } catch (error) {
    console.error('RFQ POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
