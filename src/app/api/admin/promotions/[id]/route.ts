import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { promotionAdminObject, shapePromotion } from '@/lib/promotions-admin'

/**
 * Task 100 — admin promotion PATCH / DELETE.
 *
 * PATCH speaks the FULL-SET sync doctrine (same as the collections rail):
 * when productIds is present it is the ENTIRE desired pin set — membership
 * is replaced in ONE transaction, so a refused set applies nothing and the
 * rail can never drift into a half-pinned state. Omitted productIds keep
 * the existing pins (used for pause/resume/window edits).
 *
 * No-leak: a foreign or phantom id is the SAME 404 — the admin console
 * cannot be used to probe id existence.
 * History: DELETE removes the campaign and its pins (cascade); past orders
 * keep the promotionName snapshot — a receipt never rewrites itself.
 */

const patchSchema = promotionAdminObject
  .partial()
  .refine(
    (v) => {
      if (v.validFrom === undefined || v.validUntil === undefined) return true
      return v.validUntil > v.validFrom
    },
    { message: 'End date must be after the start date', path: ['validUntil'] }
  )
  .refine((v) => v.type !== 'percentage' || (v.value ?? 0) <= 100, {
    message: 'A percentage discount cannot exceed 100%',
    path: ['value'],
  })

async function loadPromotion(id: string) {
  return db.promotions.findUnique({
    where: { id },
    include: { products: { include: { product: { select: { id: true, name: true } } } } },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-promotions-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await loadPromotion(id)
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid promotion payload' },
        { status: 400 }
      )
    }
    const d = parsed.data

    // Full-set pin sync (only when productIds arrived).
    if (d.productIds !== undefined) {
      const unique = [...new Set(d.productIds)]
      const found = await db.products.findMany({ where: { id: { in: unique } }, select: { id: true } })
      const foundIds = new Set(found.map((p) => p.id))
      const missing = unique.filter((pid) => !foundIds.has(pid))
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Unknown product${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Window sanity against the STORED row when only one side arrived.
    const nextFrom = d.validFrom ?? existing.validFrom
    const nextUntil = d.validUntil ?? existing.validUntil
    if (nextUntil <= nextFrom) {
      return NextResponse.json({ error: 'End date must be after the start date' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (d.name !== undefined) data.name = d.name.trim()
    if (d.type !== undefined) data.type = d.type
    if (d.value !== undefined) data.value = d.value
    if (d.maxDiscount !== undefined) data.maxDiscount = d.maxDiscount
    if (d.minOrderAmount !== undefined) data.minOrderAmount = d.minOrderAmount > 0 ? d.minOrderAmount : null
    if (d.usageLimit !== undefined) data.usageLimit = d.usageLimit > 0 ? d.usageLimit : null
    if (d.validFrom !== undefined) data.validFrom = d.validFrom
    if (d.validUntil !== undefined) data.validUntil = d.validUntil
    if (d.isActive !== undefined) data.isActive = d.isActive
    if (d.description !== undefined) data.description = d.description ?? null

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.promotions.update({ where: { id }, data })
      if (d.productIds !== undefined) {
        await tx.promotionProducts.deleteMany({ where: { promotionId: id } })
        await tx.promotionProducts.createMany({
          data: [...new Set(d.productIds)].map((productId) => ({ promotionId: id, productId })),
        })
      }
      return row
    })

    const fresh = await loadPromotion(id)
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'promotion_updated',
        entityType: 'promotions',
        entityId: id,
        metadata: JSON.stringify({
          before: { name: existing.name, isActive: existing.isActive, value: existing.value, validUntil: existing.validUntil },
          after: { name: updated.name, isActive: updated.isActive, value: updated.value, validUntil: updated.validUntil },
          pinsSynced: d.productIds !== undefined,
        }),
      },
    })
    void tapAllAdmins('promotion:changed', {
      action: 'updated',
      promotionId: id,
      name: updated.name,
      isActive: updated.isActive,
    })

    if (!fresh) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: shapePromotion(
        fresh,
        fresh.products.map((pp) => ({ id: pp.product.id, name: pp.product.name }))
      ),
    })
  } catch (error) {
    console.error('Admin promotions PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-promotions-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.promotions.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    await db.promotions.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'promotion_deleted',
        entityType: 'promotions',
        entityId: id,
        metadata: JSON.stringify({ name: existing.name }),
      },
    })
    void tapAllAdmins('promotion:changed', { action: 'deleted', promotionId: id, name: existing.name })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin promotions DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
