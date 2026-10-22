import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/live-shopping
 * List ongoing and scheduled factory live broadcasts.
 *
 * POST /api/live-shopping
 * Supplier creates a new live broadcast session.
 */
export async function GET(request: NextRequest) {
  try {
    const streams = await db.liveStreams.findMany({
      orderBy: [{ isLive: 'desc' }, { scheduledAt: 'asc' }],
      take: 20,
    })

    const supplierIds = [...new Set(streams.map(s => s.supplierId))]
    const suppliers = supplierIds.length > 0
      ? await db.supplierProfiles.findMany({
          where: { id: { in: supplierIds } },
          select: {
            id: true,
            companyName: true,
            ratingAvg: true,
            ratingCount: true,
            storeCustomization: { select: { logoUrl: true } },
          },
        })
      : []
    const suppMap = new Map(suppliers.map(s => [s.id, s]))

    const data = streams.map(s => {
      const supp = suppMap.get(s.supplierId)
      return {
        id: s.id,
        supplierId: s.supplierId,
        // Unknown data is returned as null — the client renders an honest
        // neutral state. No invented labels or constant ratings.
        supplierName: supp?.companyName ?? null,
        supplierLogo: supp?.storeCustomization?.logoUrl ?? null,
        // Real aggregate from supplier reviews; null-equivalent (0 count)
        // means the supplier has not been rated yet.
        supplierRating: supp && supp.ratingCount > 0 ? supp.ratingAvg : null,
        supplierRatingCount: supp?.ratingCount ?? 0,
        title: s.title,
        description: s.description,
        isLive: s.isLive,
        viewerCount: s.viewerCount,
        // Returned as-is (may be null) — clients render a neutral block,
        // external placeholder imagery is never injected.
        thumbnailUrl: s.thumbnailUrl,
        streamUrl: s.streamUrl,
        playbackUrl: s.playbackUrl,
        scheduledAt: s.scheduledAt.toISOString(),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Live shopping GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const CreateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(3).max(2000),
    scheduledAt: z.coerce.date().optional(),
    streamUrl: z.string().trim().max(500).optional(),
    thumbnailUrl: z.string().trim().max(500).optional(),
    featuredProductIds: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  // Task 142: the schedule belongs to a real STORE. The old POST wrote
  // auth.user.id (a users id) into liveStreams.supplierId — a
  // supplierProfiles id column — so the list's supplier join NEVER matched
  // and every created stream rendered a null supplier (the id-space trap,
  // fourth sighting). It also let ANY authenticated user (buyers included)
  // broadcast as any store, and stamped a scheduled session isLive:true.
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'live-shopping-create', 5, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(
        { error: 'Supplier profile required — only a store can schedule a broadcast', code: 'SUPPLIER_PROFILE_REQUIRED' },
        { status: 403 }
      )
    }

    const parsed = CreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? Object.values(flattened.fieldErrors)[0]?.[0] ?? 'Invalid payload', details: flattened.fieldErrors },
        { status: 400 }
      )
    }
    const { title, description, scheduledAt, streamUrl, thumbnailUrl, featuredProductIds } = parsed.data

    // Featured products must exist AND belong to THIS store — a broadcast
    // featuring someone else's goods would misrepresent their catalog.
    if (featuredProductIds && featuredProductIds.length > 0) {
      const owned = await db.products.findMany({
        where: { id: { in: featuredProductIds }, supplierId: profile.id },
        select: { id: true },
      })
      if (owned.length !== featuredProductIds.length) {
        return NextResponse.json({ error: 'Featured products must belong to your own store' }, { status: 403 })
      }
    }

    const stream = await db.liveStreams.create({
      data: {
        supplierId: profile.id,
        title,
        description,
        scheduledAt: scheduledAt ?? new Date(),
        streamUrl: streamUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        featuredProductIds: featuredProductIds?.length ? featuredProductIds.join(',') : null,
        // A schedule is not live — isLive flips through the owner's real
        // start action (PATCH /api/live-shopping/[id]), never at creation.
        isLive: false,
        viewerCount: 0,
      },
    })

    await db.auditLogs
      .create({
        data: {
          actorId: auth.user.id,
          action: 'live_stream_scheduled',
          entityType: 'liveStreams',
          entityId: stream.id,
          metadata: JSON.stringify({
            supplierId: profile.id,
            companyName: profile.companyName,
            title,
            scheduledAt: (scheduledAt ?? new Date()).toISOString(),
            featuredCount: featuredProductIds?.length ?? 0,
          }),
        },
      })
      .catch(() => { /* evidence, not a gate */ })

    return NextResponse.json({ success: true, data: stream }, { status: 201 })
  } catch (error) {
    console.error('Live shopping POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
