import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { sellerCampaignCreateSchema, normalizeSellerCampaignInput, shapeSellerCampaign, validateOwnPinnedProducts } from '@/lib/promotions-seller'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * Task 115 — THE SELLER CAMPAIGN RAIL, rewritten onto the REAL pricing
 * engine. The old route wrote `sellerPromotions` rows — a table NO pricing
 * code ever read: a seller could publish an "active" discount that changed
 * nothing at checkout, a fake promise with a confident label. That table is
 * retired (schema dropped this round); campaigns now live on `promotions`
 * with supplierId set — the SAME engine the platform's promotions use, with
 * REAL SELLER-FUNDED pricing teeth: the discount reduces this supplier's
 * subOrder subtotal at checkout.
 *
 * House contract: 401-first, profile 403, rate limits, Zod STRICT, pins
 * validated as OWN+ACTIVE+APPROVED with distinguishable refusals, audit,
 * seller-room broadcast.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || (auth.authenticated ? 'Forbidden' : 'Authentication required') }, { status: 401 })
  }
  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }
  const rl = checkRateLimit(request, 'seller-campaigns-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rows = await db.promotions.findMany({
      where: { supplierId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { products: { include: { product: { select: { id: true, name: true } } } } },
    })

    // Honest lifecycle math — the same computed status the admin shape uses.
    const now = new Date()
    const stats = { total: rows.length, live: 0, scheduled: 0, ended: 0, paused: 0, totalUses: 0 }
    for (const r of rows) {
      stats.totalUses += r.usedCount
      if (!r.isActive) stats.paused += 1
      else if (now < r.validFrom) stats.scheduled += 1
      else if (now > r.validUntil) stats.ended += 1
      else stats.live += 1
    }

    return NextResponse.json({
      success: true,
      data: rows.map((r) =>
        shapeSellerCampaign(
          r,
          r.products.map((pp) => ({ id: pp.product.id, name: pp.product.name }))
        )
      ),
      stats,
    })
  } catch (error) {
    console.error('Seller campaigns GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || (auth.authenticated ? 'Forbidden' : 'Authentication required') }, { status: 401 })
  }
  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }
  const rl = checkRateLimit(request, 'seller-campaigns-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = sellerCampaignCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid campaign payload' },
        { status: 400 }
      )
    }
    const input = normalizeSellerCampaignInput(parsed.data)

    const { ok, phantom, foreign, unavailable } = await validateOwnPinnedProducts(db, profile.id, parsed.data.productIds)
    if (phantom.length > 0) {
      return NextResponse.json(
        { error: `Unknown product${phantom.length > 1 ? 's' : ''}: ${phantom.join(', ')}` },
        { status: 400 }
      )
    }
    if (foreign.length > 0) {
      return NextResponse.json(
        { error: `Campaigns may only pin YOUR products — not product ${foreign.join(', ')}` },
        { status: 403 }
      )
    }
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: `Pinned product${unavailable.length > 1 ? 's are' : ' is'} hidden or not approved yet: ${unavailable.join(', ')}` },
        { status: 400 }
      )
    }
    if (ok.length === 0) {
      return NextResponse.json({ error: 'Pin at least one of your products to this campaign' }, { status: 400 })
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.promotions.create({ data: { ...input, supplierId: profile.id } })
      await tx.promotionProducts.createMany({
        data: ok.map((p) => ({ promotionId: row.id, productId: p.id })),
      })
      return row
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_campaign_created',
        entityType: 'promotions',
        entityId: created.id,
        metadata: JSON.stringify({
          supplierId: profile.id,
          name: created.name,
          type: created.type,
          value: created.value,
          pinnedCount: ok.length,
          isActive: created.isActive,
        }),
      },
    })
    void broadcastToRoom(`seller:${profile.id}`, 'campaign:changed', {
      action: 'created',
      campaignId: created.id,
      name: created.name,
      pinnedCount: ok.length,
    })

    return NextResponse.json({ success: true, data: shapeSellerCampaign(created, ok) }, { status: 201 })
  } catch (error) {
    console.error('Seller campaigns POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
