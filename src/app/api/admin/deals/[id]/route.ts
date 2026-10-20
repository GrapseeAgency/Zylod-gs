import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * PATCH  /api/admin/deals/[id] — manage an EXISTING flash or daily deal.
 *        Allowed edits: isActive toggle, dealPrice (discountPercent is
 *        RECOMPUTED from the real basePrice — never trusted from the client),
 *        flash-only: endAt (may extend, may not precede startAt), totalStock,
 *        maxPerBuyer; daily-only: dayDate (re-keyed to UTC midnight, duplicate
 *        409-checked). `type` is IMMUTABLE — a flash deal can never silently
 *        become a daily deal.
 * DELETE /api/admin/deals/[id] — hard delete (no table references deals).
 *
 * Both: 401-first, rate limited ('admin-deals-write'), unknown id = real 404,
 * success audits + fires 'deal:changed' on every admin room (fire-and-forget).
 */

async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {
    // Non-fatal: clients degrade to the 30s poll.
  }
}

const DealPatchSchema = z
  .object({
    isActive: z.boolean().optional(),
    dealPrice: z.number().positive().max(100_000_000).optional(),
    endAt: z.coerce.date().optional(),
    totalStock: z.number().min(0).max(1_000_000).optional(),
    maxPerBuyer: z.number().min(0).max(1_000_000).nullable().optional(),
    dayDate: z.coerce.date().optional(),
  })
  .strict()

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-deals-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = DealPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deal patch', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const data = parsed.data

    const flash = await db.flashDeals.findUnique({ where: { id } })
    const daily = flash ? null : await db.dailyDeals.findUnique({ where: { id } })
    if (!flash && !daily) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const kind = flash ? 'flash' : 'daily'
    const row = flash ?? daily!

    // Kind-specific guard: daily-only fields on flash and vice-versa.
    if (kind === 'flash' && (data.dayDate !== undefined)) {
      return NextResponse.json({ error: 'dayDate applies to daily deals only' }, { status: 400 })
    }
    if (kind === 'daily' && (data.endAt !== undefined || data.totalStock !== undefined || data.maxPerBuyer !== undefined)) {
      return NextResponse.json({ error: 'endAt/totalStock/maxPerBuyer apply to flash deals only' }, { status: 400 })
    }

    let discountPercent = row.discountPercent
    if (data.dealPrice !== undefined && data.dealPrice !== row.dealPrice) {
      const product = await db.products.findUnique({
        where: { id: row.productId },
        select: { basePrice: true },
      })
      if (!product) {
        return NextResponse.json({ error: 'The deal\'s product no longer exists' }, { status: 409 })
      }
      discountPercent = Math.max(0, Math.round((1 - data.dealPrice / product.basePrice) * 1000) / 10)
    }

    if (kind === 'flash') {
      const f = flash!
      const startAt = f.startAt
      const endAt = data.endAt ?? f.endAt
      if (endAt <= startAt) {
        return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
      }
      const updated = await db.flashDeals.update({
        where: { id },
        data: {
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.dealPrice !== undefined ? { dealPrice: data.dealPrice, discountPercent } : {}),
          ...(data.endAt !== undefined ? { endAt: data.endAt } : {}),
          ...(data.totalStock !== undefined ? { totalStock: data.totalStock } : {}),
          ...(data.maxPerBuyer !== undefined ? { maxPerBuyer: data.maxPerBuyer } : {}),
        },
      })
      await db.auditLogs.create({
        data: {
          actorId: auth.user.id,
          action: 'deal_updated',
          entityType: 'flashDeals',
          entityId: id,
          metadata: JSON.stringify({ isActive: updated.isActive, dealPrice: updated.dealPrice }),
        },
      })
      void tapAllAdmins('deal:changed', { dealId: id, type: 'flash', action: 'updated' })
      return NextResponse.json({ success: true, data: { deal: updated } })
    }

    // daily
    const d = daily!
    let dayDate = d.dayDate
    if (data.dayDate !== undefined) {
      const next = new Date(data.dayDate)
      next.setUTCHours(0, 0, 0, 0)
      if (next.getTime() !== d.dayDate.getTime()) {
        const duplicate = await db.dailyDeals.findFirst({
          where: { productId: d.productId, isActive: true, dayDate: next, id: { not: id } },
          select: { id: true },
        })
        if (duplicate) {
          return NextResponse.json(
            { error: 'An active daily deal already exists for this product on that day', conflictId: duplicate.id },
            { status: 409 }
          )
        }
        dayDate = next
      }
    }
    const updated = await db.dailyDeals.update({
      where: { id },
      data: {
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.dealPrice !== undefined ? { dealPrice: data.dealPrice, discountPercent } : {}),
        ...(data.dayDate !== undefined ? { dayDate } : {}),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'deal_updated',
        entityType: 'dailyDeals',
        entityId: id,
        metadata: JSON.stringify({ isActive: updated.isActive, dealPrice: updated.dealPrice }),
      },
    })
    void tapAllAdmins('deal:changed', { dealId: id, type: 'daily', action: 'updated' })
    return NextResponse.json({ success: true, data: { deal: updated } })
  } catch (err) {
    console.error('PATCH /api/admin/deals/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-deals-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const flash = await db.flashDeals.findUnique({ where: { id } })
    const daily = flash ? null : await db.dailyDeals.findUnique({ where: { id } })
    if (!flash && !daily) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (flash) await db.flashDeals.delete({ where: { id } })
    else await db.dailyDeals.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'deal_deleted',
        entityType: flash ? 'flashDeals' : 'dailyDeals',
        entityId: id,
        metadata: JSON.stringify({ productId: flash?.productId ?? daily!.productId }),
      },
    })
    void tapAllAdmins('deal:changed', { dealId: id, type: flash ? 'flash' : 'daily', action: 'deleted' })
    return NextResponse.json({ success: true, data: { deletedId: id } })
  } catch (err) {
    console.error('DELETE /api/admin/deals/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
  }
}
