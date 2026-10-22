import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/live-shopping/[id]
 * Retrieve live stream room state, featured products, and live factory info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const stream = await db.liveStreams.findUnique({
      where: { id },
    })

    if (!stream) {
      return NextResponse.json({ error: 'Live stream session not found' }, { status: 404 })
    }

    const supplier = await db.supplierProfiles.findUnique({
      where: { id: stream.supplierId },
      select: {
        id: true,
        companyName: true,
        ratingAvg: true,
        ratingCount: true,
        storeCustomization: { select: { logoUrl: true } },
      },
    })

    // Fetch featured products if specified
    const prodIds = stream.featuredProductIds
      ? stream.featuredProductIds.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const products = prodIds.length > 0
      ? await db.products.findMany({
          where: { id: { in: prodIds } },
          select: { id: true, name: true, basePrice: true, thumbnailUrl: true, stockQuantity: true },
        })
      : await db.products.findMany({
          where: { isActive: true },
          take: 4,
          select: { id: true, name: true, basePrice: true, thumbnailUrl: true, stockQuantity: true },
        })

    return NextResponse.json({
      success: true,
      data: {
        ...stream,
        supplierName: supplier?.companyName || null,
        supplierLogo: supplier?.storeCustomization?.logoUrl ?? null,
        // Real aggregate from supplier reviews — null when the supplier has
        // never been rated (no constant/fabricated rating is ever sent).
        supplierRating: supplier && supplier.ratingCount > 0 ? supplier.ratingAvg : null,
        supplierRatingCount: supplier?.ratingCount ?? 0,
        featuredProducts: products,
        // REAL chat state: no persisted messages yet. Real-time chat is wired
        // via socket.io when the host goes live — never seeded with fake rows.
        liveMessages: [],
      },
    })
  } catch (error) {
    console.error('Live shopping stream GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


const StreamActionSchema = z
  .object({ action: z.enum(['start', 'end']) })
  .strict()

/**
 * PATCH /api/live-shopping/[id] (Task 142) — the host's real broadcast
 * control. 'start' flips isLive on (the moment the room actually opens);
 * 'end' flips it off and stamps endedAt. Owner (the stream's own supplier
 * profile) or an admin; audited — going live is a public promise about a
 * real store.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'live-shopping-control', 20, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const parsed = StreamActionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'action must be "start" or "end"' }, { status: 400 })
    }

    const stream = await db.liveStreams.findUnique({ where: { id } })
    if (!stream) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
    }

    if (auth.user.userType !== 'admin') {
      const profile = await resolveSupplierProfile(auth.user)
      if (!profile || profile.id !== stream.supplierId) {
        return NextResponse.json({ error: 'Only the host store can control this broadcast' }, { status: 403 })
      }
    }

    if (parsed.data.action === 'start') {
      if (stream.isLive) {
        return NextResponse.json({ error: 'This broadcast is already live' }, { status: 409 })
      }
      const updated = await db.liveStreams.update({
        where: { id },
        data: { isLive: true, endedAt: null },
      })
      await db.auditLogs
        .create({
          data: {
            actorId: auth.user.id,
            action: 'live_stream_started',
            entityType: 'liveStreams',
            entityId: id,
            metadata: JSON.stringify({ title: stream.title, supplierId: stream.supplierId }),
          },
        })
        .catch(() => { /* evidence, not a gate */ })
      return NextResponse.json({ success: true, data: updated })
    }

    // end
    if (!stream.isLive) {
      return NextResponse.json({ error: 'This broadcast is not live' }, { status: 409 })
    }
    const updated = await db.liveStreams.update({
      where: { id },
      data: { isLive: false, endedAt: new Date() },
    })
    await db.auditLogs
      .create({
        data: {
          actorId: auth.user.id,
          action: 'live_stream_ended',
          entityType: 'liveStreams',
          entityId: id,
          metadata: JSON.stringify({ title: stream.title, supplierId: stream.supplierId }),
        },
      })
      .catch(() => { /* evidence, not a gate */ })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Live shopping stream PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
