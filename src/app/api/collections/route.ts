import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { ownerProjection, mintShareToken } from '@/lib/collections'

/**
 * Task 97: THE COLLECTIONS RAIL — repaired. The old routes fabricated a
 * schema that never existed (buyerId / privacy / coverColor written into a
 * model with userId / isPublic / coverImage) behind `(db as any)` casts that
 * hid every mismatch from the compiler — EVERY list/create 500'd. Now the
 * routes speak the real schema (privacy PRIVATE|PUBLIC|SHARED, coverColor,
 * coverImageUrl) and follow the house contract: 401-first, rate limits,
 * Zod strict, no-leak 404s, audits. A buyer curating products can only pin
 * products that are ACTUALLY visible on the marketplace (isActive +
 * isApproved) — a phantom id and an unapproved id are the SAME honest 404.
 */

const createSchema = z.object({
  name: z.string().trim().min(1, 'Collection name is required').max(50),
  description: z.string().trim().max(200).optional().nullable(),
  privacy: z.enum(['PRIVATE', 'PUBLIC', 'SHARED']).default('PRIVATE'),
  // '' = the "no color" chip on the create form
  coverColor: z.string().regex(/^$|^#[0-9a-fA-F]{3,8}$/).optional(),
  productIds: z.array(z.string().min(1)).max(100).optional(),
}).strict() // Task 97 house mandate: unknown keys are a 400, not free Real Estate

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'collections-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const collections = await db.collections.findMany({
      where: { userId: auth.user.id },
      include: {
        _count: { select: { items: true } },
        items: {
          take: 4,
          include: { product: { select: { thumbnailUrl: true, name: true } } },
          orderBy: { addedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: collections.map(ownerProjection) })
  } catch (error) {
    console.error('Collections GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'collections-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const { name, description, privacy, coverColor, productIds } = parsed.data

    // Every requested product must be VISIBLE right now (isActive +
    // isApproved). A phantom id and a hidden id are the SAME 404 — the
    // collection rail must never become an existence oracle.
    if (productIds && productIds.length > 0) {
      const found = await db.products.findMany({
        where: { id: { in: productIds }, isActive: true, isApproved: true },
        select: { id: true },
      })
      if (found.length !== productIds.length) {
        return NextResponse.json({ error: 'Product not available' }, { status: 404 })
      }
    }

    const collection = await db.collections.create({
      data: {
        userId: auth.user.id,
        name,
        description: description || null,
        privacy,
        coverColor: coverColor || null,
        // SHARED mints its secret link token at birth.
        shareToken: privacy === 'SHARED' ? mintShareToken() : null,
        items: productIds?.length
          ? { create: productIds.map((productId) => ({ productId })) }
          : undefined,
      },
      include: { _count: { select: { items: true } } },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'collection_created',
        entityType: 'collections',
        entityId: collection.id,
        metadata: JSON.stringify({ name, privacy, itemCount: productIds?.length ?? 0 }),
      },
    })

    return NextResponse.json(
      { success: true, data: ownerProjection(collection), message: 'Collection created' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Collections POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
