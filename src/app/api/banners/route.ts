import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/banners — PUBLIC read of the REAL banners table (Task 89).
 *
 * The banners table existed in the schema from day one but had NO route at
 * all — a dead table while every "banner" in the UI was either supplier
 * storefront JSON or nothing. This closes the read half of the rail:
 *
 * - No authentication: banner content is exactly what an anonymous storefront
 *   visitor sees, so the endpoint leaks nothing private.
 * - Only rows that are ACTIVE and within their optional schedule window come
 *   back (startAt <= now when set, endAt >= now when set) — expired or future
 *   scheduled banners are honestly absent, never padded with placeholders.
 * - ?position filters by the REAL position vocabulary (home_top |
 *   home_middle | category_top | sidebar); anything else is a 400 with the
 *   verbatim Zod error. Absent = every position (the home page asks for
 *   home_top specifically).
 * - Ordering is deterministic: sortOrder ascending, then createdAt descending
 *   (newest first within the same slot priority).
 * - Payload carries only public display fields — no admin-only bookkeeping.
 * - Rate limited ('banners-public', 120/min) like every other public rail.
 */

const QuerySchema = z.object({
  position: z.enum(['home_top', 'home_middle', 'category_top', 'sidebar']).optional(),
})

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, 'banners-public', 120, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const parsed = QuerySchema.safeParse({
      position: searchParams.get('position') || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const now = new Date()
    const banners = await db.banners.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        linkPageId: true,
        linkParams: true,
        position: true,
        sortOrder: true,
      },
    })

    const rows = parsed.data.position
      ? banners.filter((b) => b.position === parsed.data.position)
      : banners

    return NextResponse.json({ success: true, data: { banners: rows } })
  } catch (err) {
    console.error('GET /api/banners error:', err)
    return NextResponse.json({ error: 'Failed to load banners' }, { status: 500 })
  }
}
