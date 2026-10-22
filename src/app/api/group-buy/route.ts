import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/group-buy — list LIVE volume-pooling campaigns (active + not
 * expired), each with the REAL product identity and honest progress.
 *
 * POST /api/group-buy (Task 141 rewrite) — the product's OWN supplier opens
 * a pool. The old POST let ANY authenticated user create a campaign for ANY
 * product at ANY price (a buyer could "pool" a seller's goods at ৳1 and the
 * page would advertise it as a wholesale rate) — a fake the ownership rule
 * kills. Since Task 141 the pool rate is REAL money: the order engine prices
 * participants' lines at discountedPrice up to their reserved quantity once
 * the pool completes, so opening one is a seller pricing commitment.
 *
 * Guards: 401-first → 5/min 'group-buy-create' → resolveSupplierProfile
 * (403 SUPPLIER_PROFILE_REQUIRED for buyers/admins-without-profile) → Zod
 * strict → product must exist AND belong to THIS supplier → the rate must
 * actually be a discount (0 < discountedPrice ≤ basePrice) → the target
 * must be a real pool (≥ the product MOQ, ≤ 1,000,000) → duration 1..720h.
 * Audited 'group_buy_created' with the real before/after economics.
 */

const CreateSchema = z
  .object({
    productId: z.string().trim().min(1).max(64),
    title: z.string().trim().min(3).max(140).optional(),
    targetQty: z.coerce.number().positive('Target quantity must be positive').max(1_000_000),
    discountedPrice: z.coerce.number().positive('Discounted price must be positive'),
    durationHours: z.coerce.number().int().min(1).max(720).default(48),
  })
  .strict()

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, 'group-buy-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const campaigns = await db.groupBuyCampaigns.findMany({
      where: { status: 'active', expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    const productIds = [...new Set(campaigns.map((c) => c.productId))]
    const products = productIds.length > 0
      ? await db.products.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, thumbnailUrl: true, basePrice: true },
        })
      : []
    const prodMap = new Map(products.map((p) => [p.id, p]))

    const data = campaigns.map((c) => {
      const prod = prodMap.get(c.productId)
      const progressPercent = Math.min(100, Math.round((c.currentQty / c.targetQty) * 100))
      return {
        id: c.id,
        productId: c.productId,
        title: c.title,
        productName: prod?.name || c.title,
        productImage: prod?.thumbnailUrl,
        targetQty: c.targetQty,
        currentQty: c.currentQty,
        progressPercent,
        discountedPrice: c.discountedPrice,
        originalPrice: c.originalPrice,
        savingsPercent: Math.round(((c.originalPrice - c.discountedPrice) / c.originalPrice) * 100),
        status: c.status,
        expiresAt: c.expiresAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Group buy GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'group-buy-create', 5, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(
        { error: "Supplier profile required — only the product's own supplier can open a pool", code: 'SUPPLIER_PROFILE_REQUIRED' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? Object.values(flattened.fieldErrors)[0]?.[0] ?? 'Invalid payload', details: flattened.fieldErrors },
        { status: 400 }
      )
    }
    const { productId, title, targetQty, discountedPrice, durationHours } = parsed.data

    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, basePrice: true, supplierId: true, isActive: true, isApproved: true, moq: true },
    })
    if (!product || !product.isActive || !product.isApproved) {
      return NextResponse.json({ error: 'Product not found or not available' }, { status: 404 })
    }
    if (product.supplierId !== profile.id) {
      return NextResponse.json({ error: 'You can only open pools for your own products' }, { status: 403 })
    }
    if (discountedPrice > product.basePrice) {
      return NextResponse.json(
        { error: `The pool rate must not exceed the factory rate (৳${product.basePrice.toLocaleString()}) — that would be a fake discount` },
        { status: 422 }
      )
    }
    if (targetQty < product.moq) {
      return NextResponse.json(
        { error: `The pool target must be at least this product's MOQ (${product.moq} ${'units'})` },
        { status: 422 }
      )
    }

    const campaign = await db.groupBuyCampaigns.create({
      data: {
        productId,
        title: title || `Group Buy: ${product.name}`,
        targetQty,
        currentQty: 0,
        discountedPrice,
        originalPrice: product.basePrice,
        expiresAt: new Date(Date.now() + durationHours * 3600000),
        status: 'active',
      },
    })

    await db.auditLogs
      .create({
        data: {
          actorId: auth.user.id,
          action: 'group_buy_created',
          entityType: 'groupBuyCampaigns',
          entityId: campaign.id,
          metadata: JSON.stringify({
            productId,
            productName: product.name,
            targetQty,
            originalPrice: product.basePrice,
            discountedPrice,
            savingsPercent: Math.round(((product.basePrice - discountedPrice) / product.basePrice) * 100),
            expiresAt: campaign.expiresAt.toISOString(),
          }),
        },
      })
      .catch(() => { /* evidence, not a gate */ })

    return NextResponse.json({ success: true, data: campaign }, { status: 201 })
  } catch (error) {
    console.error('Group buy POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
