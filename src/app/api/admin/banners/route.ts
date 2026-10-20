import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * Admin content rail — REAL banners table CRUD (Task 89).
 *
 * GET /api/admin/banners — admin-only oversight list: EVERY row (inactive,
 * expired, future-scheduled included) plus real groupBy stats by position.
 * POST /api/admin/banners — create a banner. All validation is Zod strict;
 * unknown keys are rejected. The schedule window is validated (endAt after
 * startAt when both present). Every mutation:
 *   - 401-first (requireUserType), then the rate limit
 *   - audits into auditLogs (actorType 'admin')
 *   - fires a 'banner:changed' tap on EVERY admin's admin:<userId> room so
 *     other admin consoles' content queues refresh live (fire-and-forget —
 *     the DB write is the source of truth; socket failure degrades to the
 *     30s poll, never fails the request).
 */

const BANNER_POSITIONS = ['home_top', 'home_middle', 'category_top', 'sidebar'] as const

const BannerCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().trim().max(200).optional(),
    imageUrl: z.string().trim().url().max(2048),
    linkPageId: z.string().trim().max(120).optional(),
    linkParams: z.string().trim().max(300).optional(),
    position: z.enum(BANNER_POSITIONS).default('home_top'),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isActive: z.boolean().default(true),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
  })
  .strict()
  .refine((v) => !v.startAt || !v.endAt || v.endAt > v.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  })

/** Every admin's live room — used by the shared broadcast helper below. */
async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {
    // Non-fatal: clients degrade to the 30s poll.
  }
}

export { tapAllAdmins }

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-banners-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const now = new Date()
    const [rows, byPosition] = await Promise.all([
      db.banners.findMany({
        orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      db.banners.groupBy({ by: ['position'], _count: { _all: true } }),
    ])

    const banners = rows.map((b) => {
      // Status is the server's honest computation:
      //   inactive            — isActive is false
      //   expired             — endAt already passed
      //   scheduled           — startAt in the future
      //   live                — active and inside (or without) a window
      const status: 'live' | 'scheduled' | 'expired' | 'inactive' =
        !b.isActive
          ? 'inactive'
          : b.endAt && b.endAt < now
            ? 'expired'
            : b.startAt && b.startAt > now
              ? 'scheduled'
              : 'live'
      return { ...b, status }
    })

    const stats = {
      total: rows.length,
      live: banners.filter((b) => b.status === 'live').length,
      inactive: rows.filter((b) => !b.isActive).length,
      byPosition: Object.fromEntries(
        byPosition.map((g) => [g.position, g._count._all])
      ),
    }

    return NextResponse.json({ success: true, data: { banners, stats } })
  } catch (err) {
    console.error('GET /api/admin/banners error:', err)
    return NextResponse.json({ error: 'Failed to load banners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-banners-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    const parsed = BannerCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid banner payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { startAt, endAt, ...rest } = parsed.data
    const banner = await db.banners.create({
      data: {
        ...rest,
        subtitle: rest.subtitle ?? null,
        linkPageId: rest.linkPageId ?? null,
        linkParams: rest.linkParams ?? null,
        startAt: startAt ?? null,
        endAt: endAt ?? null,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'banner_created',
        entityType: 'banners',
        entityId: banner.id,
        metadata: JSON.stringify({ title: banner.title, position: banner.position }),
      },
    })

    void tapAllAdmins('banner:changed', { bannerId: banner.id, action: 'created' })
    return NextResponse.json({ success: true, data: { banner } }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/banners error:', err)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}
