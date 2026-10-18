import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/* Ownership scoping (Task 50-b): every method resolves the session's
 * supplierProfile and only touches rows where supplierId matches. A foreign
 * or unknown id gets the same 404 — no existence leak. */

const PROMO_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'ended'] as const

const patchPromotionSchema = z.object({
  status: z.enum(PROMO_STATUSES).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  endDate: z.coerce.date().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const { id } = await params
    const promo = await db.sellerPromotions.findFirst({
      where: { id, supplierId: profile.id },
    })
    if (!promo) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: promo })
  } catch (error) {
    console.error('Promotion GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const parsed = patchPromotionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid promotion payload' },
        { status: 400 }
      )
    }
    const body = parsed.data

    const { id } = await params
    const existing = await db.sellerPromotions.findFirst({
      where: { id, supplierId: profile.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    const updated = await db.sellerPromotions.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.name && { name: body.name }),
        ...(body.discountValue !== undefined && { discountValue: body.discountValue }),
        ...(body.endDate && { endDate: body.endDate }),
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_promotion_updated',
        entityType: 'sellerPromotions',
        entityId: id,
        metadata: JSON.stringify({ supplierId: profile.id, changes: body }),
      },
    })

    return NextResponse.json({ success: true, data: updated, message: 'Promotion updated' })
  } catch (error) {
    console.error('Promotion PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const { id } = await params
    const existing = await db.sellerPromotions.findFirst({
      where: { id, supplierId: profile.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    await db.sellerPromotions.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_promotion_deleted',
        entityType: 'sellerPromotions',
        entityId: id,
        metadata: JSON.stringify({ supplierId: profile.id, name: existing.name }),
      },
    })

    return NextResponse.json({ success: true, message: 'Promotion deleted' })
  } catch (error) {
    console.error('Promotion DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
