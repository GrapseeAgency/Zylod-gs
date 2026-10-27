import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * PATCH  /api/admin/banners/[id] — partial update of a REAL banners row
 *        (title/subtitle/image/link/position/sortOrder/isActive/schedule).
 *        A patch that would change NOTHING still succeeds (200, real row
 *        back) but skips the audit + broadcast — matching the platform's
 *        "no-op writes don't broadcast" doctrine (Task 56-c).
 * DELETE /api/admin/banners/[id] — hard delete. No other table references
 *        banners (schema-verified), so deletion cannot orphan anything.
 *
 * Both: 401-first, then rate limit ('admin-banners-write'), then the work.
 * An unknown id is a REAL 404. Every state-changing success audits and fires
 * 'banner:changed' on every admin room (fire-and-forget).
 */

const BANNER_POSITIONS = ['home_top', 'home_middle', 'category_top', 'sidebar'] as const

/**
 * Same contract as the POST route: absolute http(s) URL or root-relative
 * path starting with a single `/` — portable storage for same-origin assets.
 */
const bannerImageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => /^https?:\/\/\S+$/.test(v) || /^\/(?!\/)/.test(v),
    'must be an absolute http(s) URL or a root-relative path starting with /',
  )

const BannerPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    subtitle: z.string().trim().max(200).nullable().optional(),
    imageUrl: bannerImageUrl.optional(),
    linkPageId: z.string().trim().max(120).nullable().optional(),
    linkParams: z.string().trim().max(300).nullable().optional(),
    position: z.enum(BANNER_POSITIONS).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
    startAt: z.coerce.date().nullable().optional(),
    endAt: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((v) => !(v.startAt && v.endAt) || v.endAt > v.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  })

async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {
    // Non-fatal: clients degrade to the 30s poll.
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-banners-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const existing = await db.banners.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = BannerPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid banner patch', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    // Schedule-window sanity when the patch results in BOTH endpoints set.
    const startAt = data.startAt === undefined ? existing.startAt : data.startAt
    const endAt = data.endAt === undefined ? existing.endAt : data.endAt
    if (startAt && endAt && endAt <= startAt) {
      return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 })
    }

    // No-op guard: nothing actually changing → no audit, no broadcast.
    const changes = Object.entries(data).filter(([k, v]) => {
      const before = (existing as unknown as Record<string, unknown>)[k]
      if (v instanceof Date && before instanceof Date) return v.getTime() !== before.getTime()
      return v !== before
    })
    if (changes.length === 0) {
      return NextResponse.json({ success: true, data: { banner: existing, noop: true } })
    }

    const banner = await db.banners.update({ where: { id }, data })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'banner_updated',
        entityType: 'banners',
        entityId: id,
        metadata: JSON.stringify({
          before: Object.fromEntries(changes.map(([k]) => [k, (existing as unknown as Record<string, unknown>)[k]])),
          after: Object.fromEntries(changes.map(([k]) => [k, (banner as unknown as Record<string, unknown>)[k]])),
        }),
      },
    })

    void tapAllAdmins('banner:changed', { bannerId: id, action: 'updated' })
    return NextResponse.json({ success: true, data: { banner } })
  } catch (err) {
    console.error('PATCH /api/admin/banners/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-banners-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const existing = await db.banners.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    }

    await db.banners.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'banner_deleted',
        entityType: 'banners',
        entityId: id,
        metadata: JSON.stringify({ title: existing.title, position: existing.position }),
      },
    })

    void tapAllAdmins('banner:changed', { bannerId: id, action: 'deleted' })
    return NextResponse.json({ success: true, data: { deletedId: id } })
  } catch (err) {
    console.error('DELETE /api/admin/banners/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 })
  }
}
