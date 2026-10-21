import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { sellerCampaignPatchSchema, normalizeSellerCampaignPatch, shapeSellerCampaign, validateOwnPinnedProducts } from '@/lib/promotions-seller'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * Task 115 — SELLER CAMPAIGN [id], rewritten onto the REAL pricing engine.
 *
 * Ownership scoping: every method resolves the session's supplierProfile
 * and only touches rows where supplierId matches. A foreign or unknown id
 * gets the same 404 — no existence leak (Task 50-b doctrine).
 *
 * PATCH is the hand-built schema (only arrived keys — never derived from a
 * defaulted create schema via .partial(), the Task 111 standing rule) and
 * re-validates a replaced pin list. When only ONE side of the date window
 * moves, it is checked against the row's stored counterpart.
 *
 * DELETE refuses with 409 when the campaign has priced real orders
 * (usedCount > 0) — the money history must survive; park it instead.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const row = await db.promotions.findFirst({
      where: { id, supplierId: profile.id },
      include: { products: { include: { product: { select: { id: true, name: true } } } } },
    })
    if (!row) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: shapeSellerCampaign(
        row,
        row.products.map((pp) => ({ id: pp.product.id, name: pp.product.name }))
      ),
    })
  } catch (error) {
    console.error('Seller campaign GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const parsed = sellerCampaignPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid campaign payload' },
        { status: 400 }
      )
    }
    const body = parsed.data
    const data = normalizeSellerCampaignPatch(body)
    if (Object.keys(data).length === 0 && body.productIds === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { id } = await params
    const existing = await db.promotions.findFirst({
      where: { id, supplierId: profile.id },
      include: { products: { select: { productId: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Window consistency against the STORED counterpart when only one side moves.
    const effectiveFrom = (data.validFrom as Date | undefined) ?? existing.validFrom
    const effectiveUntil = (data.validUntil as Date | undefined) ?? existing.validUntil
    if (effectiveUntil <= effectiveFrom) {
      return NextResponse.json({ error: 'End date must be after the start date' }, { status: 400 })
    }
    // Percentage cap against the eventual row (type may move without value).
    const effectiveType = (data.type as string | undefined) ?? existing.type
    const effectiveValue = (data.value as number | undefined) ?? existing.value
    if (effectiveType === 'percentage' && effectiveValue > 100) {
      return NextResponse.json({ error: 'A percentage discount cannot exceed 100%' }, { status: 400 })
    }

    let replacementPins: Array<{ id: string; name: string }> | null = null
    if (body.productIds !== undefined) {
      const { ok, phantom, foreign, unavailable } = await validateOwnPinnedProducts(db, profile.id, body.productIds)
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
      replacementPins = ok
    }

    const before = {
      name: existing.name, type: existing.type, value: existing.value, isActive: existing.isActive,
      validFrom: existing.validFrom.toISOString(), validUntil: existing.validUntil.toISOString(),
      pinnedCount: existing.products.length,
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.promotions.update({ where: { id }, data })
      if (replacementPins) {
        await tx.promotionProducts.deleteMany({ where: { promotionId: id } })
        await tx.promotionProducts.createMany({
          data: replacementPins.map((p) => ({ promotionId: id, productId: p.id })),
        })
      }
      return row
    })
    const pinnedNow = await db.promotionProducts.findMany({
      where: { promotionId: id },
      include: { product: { select: { id: true, name: true } } },
    })
    const pinned = pinnedNow.map((pp) => ({ id: pp.product.id, name: pp.product.name }))

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_campaign_updated',
        entityType: 'promotions',
        entityId: id,
        metadata: JSON.stringify({
          supplierId: profile.id,
          before,
          after: {
            name: updated.name, type: updated.type, value: updated.value, isActive: updated.isActive,
            validFrom: updated.validFrom.toISOString(), validUntil: updated.validUntil.toISOString(),
            pinnedCount: replacementPins ? replacementPins.length : before.pinnedCount,
          },
        }),
      },
    })
    void broadcastToRoom(`seller:${profile.id}`, 'campaign:changed', {
      action: 'updated',
      campaignId: id,
      name: updated.name,
    })

    return NextResponse.json({ success: true, data: shapeSellerCampaign(updated, pinned), message: 'Campaign updated' })
  } catch (error) {
    console.error('Seller campaign PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const existing = await db.promotions.findFirst({
      where: { id, supplierId: profile.id },
      select: { id: true, name: true, usedCount: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Money history survives: a campaign that priced real orders cannot be
    // deleted — the usage counter and the orders' promotion snapshots point
    // at it. Park it instead (isActive=false).
    if (existing.usedCount > 0) {
      return NextResponse.json(
        {
          error: `This campaign has priced ${existing.usedCount} order${existing.usedCount > 1 ? 's' : ''} — it cannot be deleted. Park it instead to take it off the store.`,
        },
        { status: 409 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.promotionProducts.deleteMany({ where: { promotionId: id } })
      await tx.promotions.delete({ where: { id } })
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_campaign_deleted',
        entityType: 'promotions',
        entityId: id,
        metadata: JSON.stringify({ supplierId: profile.id, name: existing.name, usedCount: existing.usedCount }),
      },
    })
    void broadcastToRoom(`seller:${profile.id}`, 'campaign:changed', {
      action: 'deleted',
      campaignId: id,
      name: existing.name,
    })

    return NextResponse.json({ success: true, message: 'Campaign deleted' })
  } catch (error) {
    console.error('Seller campaign DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
