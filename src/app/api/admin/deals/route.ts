import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * Admin deals rail — the WRITE half the read rail never had (Task 89).
 *
 * /api/deals has READ flashDeals + dailyDeals since the start, but NO route
 * anywhere could CREATE or manage them — the only way a deal existed was a
 * hand-written DB row. This closes the loop:
 *
 * GET  /api/admin/deals — admin-only list of BOTH deal kinds, every row
 *      (inactive/upcoming/expired included), product summary attached,
 *      computed status (live|upcoming|expired|inactive) + real counts.
 * POST /api/admin/deals — create a flash deal (startAt/endAt/totalStock/
 *      maxPerBuyer) or a daily deal (dayDate). The product MUST exist.
 *      discountPercent is COMPUTED server-side from the real basePrice —
 *      the client never supplies it (honest math, no inflated claims).
 *      An overlapping ACTIVE deal of the same kind on the same product is a
 *      409 (same-day duplicate for daily, overlapping window for flash).
 *
 * Both: 401-first, rate limited, audit-logged, and every mutation fires
 * 'deal:changed' on every admin room (fire-and-forget; poll degrades).
 */

const ProductCard = {
  select: {
    id: true,
    name: true,
    slug: true,
    thumbnailUrl: true,
    basePrice: true,
    unit: true,
    stockQuantity: true,
    supplier: { select: { id: true, companyName: true, verificationStatus: true } },
    category: { select: { name: true, slug: true } },
  },
} as const

function dealStatus(row: {
  isActive: boolean
  liveStart?: Date | null
  liveEnd?: Date | null
}, now: Date): 'live' | 'upcoming' | 'expired' | 'inactive' {
  if (!row.isActive) return 'inactive'
  const start = row.liveStart
  const end = row.liveEnd
  if (start && start > now) return 'upcoming'
  if (end && end < now) return 'expired'
  if (!start && !end) return 'live'
  if (start && !end && start <= now) return 'live'
  if (!start && end && end >= now) return 'live'
  return 'live'
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-deals-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const now = new Date()
    const [flash, daily] = await Promise.all([
      db.flashDeals.findMany({
        orderBy: [{ isActive: 'desc' }, { startAt: 'desc' }],
        include: { product: ProductCard },
      }),
      db.dailyDeals.findMany({
        orderBy: [{ isActive: 'desc' }, { dayDate: 'desc' }],
        include: { product: ProductCard },
      }),
    ])

    const flashRows = flash.map((d) => ({
      id: d.id,
      type: 'flash' as const,
      productId: d.productId,
      dealPrice: d.dealPrice,
      discountPercent: d.discountPercent,
      isActive: d.isActive,
      createdAt: d.createdAt,
      startAt: d.startAt,
      endAt: d.endAt,
      totalStock: d.totalStock,
      soldCount: d.soldCount,
      maxPerBuyer: d.maxPerBuyer,
      status: dealStatus(
        { isActive: d.isActive, liveStart: d.startAt, liveEnd: d.endAt },
        now
      ),
      product: d.product
        ? {
            id: d.product.id,
            name: d.product.name,
            slug: d.product.slug,
            thumbnail: d.product.thumbnailUrl,
            basePrice: d.product.basePrice,
            unit: d.product.unit,
            supplierName: d.product.supplier?.companyName ?? null,
            categoryName: d.product.category?.name ?? null,
          }
        : null,
    }))

    const dayStart = (d: Date) => {
      const x = new Date(d)
      x.setUTCHours(0, 0, 0, 0)
      return x
    }
    const dailyRows = daily.map((d) => {
      const ds = dayStart(d.dayDate)
      const de = new Date(ds.getTime() + 24 * 60 * 60 * 1000 - 1)
      return {
        id: d.id,
        type: 'daily' as const,
        productId: d.productId,
        dealPrice: d.dealPrice,
        discountPercent: d.discountPercent,
        isActive: d.isActive,
        createdAt: d.createdAt,
        dayDate: d.dayDate,
        startAt: ds,
        endAt: de,
        status: dealStatus({ isActive: d.isActive, liveStart: ds, liveEnd: de }, now),
        product: d.product
          ? {
              id: d.product.id,
              name: d.product.name,
              slug: d.product.slug,
              thumbnail: d.product.thumbnailUrl,
              basePrice: d.product.basePrice,
              unit: d.product.unit,
              supplierName: d.product.supplier?.companyName ?? null,
              categoryName: d.product.category?.name ?? null,
            }
          : null,
      }
    })

    const all = [...flashRows, ...dailyRows].sort((a, b) =>
      a.createdAt.getTime() < b.createdAt.getTime() ? 1 : -1
    )

    const stats = {
      total: all.length,
      live: all.filter((d) => d.status === 'live').length,
      upcoming: all.filter((d) => d.status === 'upcoming').length,
      expired: all.filter((d) => d.status === 'expired').length,
      inactive: all.filter((d) => d.status === 'inactive').length,
    }

    return NextResponse.json({ success: true, data: { deals: all, stats } })
  } catch (err) {
    console.error('GET /api/admin/deals error:', err)
    return NextResponse.json({ error: 'Failed to load deals' }, { status: 500 })
  }
}

const DealCreateSchema = z
  .object({
    type: z.enum(['flash', 'daily']),
    productId: z.string().trim().min(1).max(64),
    dealPrice: z.number().positive().max(100_000_000),
    // flash-only
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    totalStock: z.number().min(0).max(1_000_000).optional(),
    maxPerBuyer: z.number().min(0).max(1_000_000).nullable().optional(),
    // daily-only
    dayDate: z.coerce.date().optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-deals-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    const parsed = DealCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deal payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const input = parsed.data
    // Kind-guards on the CREATE payload too: a daily deal must not smuggle
    // flash-only fields and vice-versa (mirrors the PATCH route's guards).
    if (input.type === 'daily' && (input.startAt !== undefined || input.endAt !== undefined || input.totalStock !== undefined || input.maxPerBuyer !== undefined)) {
      return NextResponse.json(
        { error: 'startAt/endAt/totalStock/maxPerBuyer apply to flash deals only' },
        { status: 400 }
      )
    }
    if (input.type === 'flash' && input.dayDate !== undefined) {
      return NextResponse.json({ error: 'dayDate applies to daily deals only' }, { status: 400 })
    }

    const product = await db.products.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, basePrice: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Honest discount math: computed from the REAL basePrice, never client-supplied.
    const discountPercent = Math.max(
      0,
      Math.round((1 - input.dealPrice / product.basePrice) * 1000) / 10
    )

    if (input.type === 'flash') {
      if (!input.startAt || !input.endAt) {
        return NextResponse.json(
          { error: 'Flash deals require startAt and endAt' },
          { status: 400 }
        )
      }
      if (input.endAt <= input.startAt) {
        return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
      }
      if (input.endAt.getTime() - input.startAt.getTime() > 14 * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Flash deals are capped at 14 days' }, { status: 400 })
      }
      const overlap = await db.flashDeals.findFirst({
        where: {
          productId: input.productId,
          isActive: true,
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt },
        },
        select: { id: true },
      })
      if (overlap) {
        return NextResponse.json(
          { error: 'An active flash deal already covers this window for this product', conflictId: overlap.id },
          { status: 409 }
        )
      }
      const deal = await db.flashDeals.create({
        data: {
          productId: input.productId,
          dealPrice: input.dealPrice,
          discountPercent,
          startAt: input.startAt,
          endAt: input.endAt,
          totalStock: input.totalStock ?? 0,
          maxPerBuyer: input.maxPerBuyer ?? null,
          isActive: true,
        },
      })
      await db.auditLogs.create({
        data: {
          actorId: auth.user.id,
          action: 'deal_created',
          entityType: 'flashDeals',
          entityId: deal.id,
          metadata: JSON.stringify({ productId: input.productId, dealPrice: input.dealPrice, discountPercent }),
        },
      })
      void tapAllAdmins('deal:changed', { dealId: deal.id, type: 'flash', action: 'created' })
      return NextResponse.json({ success: true, data: { deal } }, { status: 201 })
    }

    // daily
    if (!input.dayDate) {
      return NextResponse.json({ error: 'Daily deals require dayDate' }, { status: 400 })
    }
    const day = new Date(input.dayDate)
    day.setUTCHours(0, 0, 0, 0)
    const duplicate = await db.dailyDeals.findFirst({
      where: { productId: input.productId, isActive: true, dayDate: day },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'An active daily deal already exists for this product on this day', conflictId: duplicate.id },
        { status: 409 }
      )
    }
    const deal = await db.dailyDeals.create({
      data: {
        productId: input.productId,
        dealPrice: input.dealPrice,
        discountPercent,
        dayDate: day,
        isActive: true,
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'deal_created',
        entityType: 'dailyDeals',
        entityId: deal.id,
        metadata: JSON.stringify({ productId: input.productId, dealPrice: input.dealPrice, discountPercent, dayDate: day.toISOString() }),
      },
    })
    void tapAllAdmins('deal:changed', { dealId: deal.id, type: 'daily', action: 'created' })
    return NextResponse.json({ success: true, data: { deal } }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/deals error:', err)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}

async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {
    // Non-fatal: clients degrade to the 30s poll.
  }
}
