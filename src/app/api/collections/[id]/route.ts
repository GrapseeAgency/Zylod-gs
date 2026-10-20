import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { ownerProjection, mintShareToken } from '@/lib/collections'

/**
 * Task 97: single-collection owner rail. Foreign id = phantom id = the SAME
 * 404 (no-leak). PATCH accepts optional productIds — the FULL desired item
 * set (the create/edit form's contract): additions are created, strays are
 * removed, all inside one transaction with the same visible-product guard.
 * Turning a collection SHARED mints its secret-link token if it has none.
 */

const patchSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  privacy: z.enum(['PRIVATE', 'PUBLIC', 'SHARED']).optional(),
  coverColor: z.string().regex(/^$|^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  productIds: z.array(z.string().min(1)).max(200).optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'collections-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const collection = await db.collections.findFirst({
      where: { id, userId: auth.user.id },
      include: {
        _count: { select: { items: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, slug: true, basePrice: true, currency: true,
                unit: true, moq: true, maxOrderQty: true, thumbnailUrl: true, stockQuantity: true,
                bundleSize: true, weightKg: true,
                // supplier.id rides along so the detail page can add the
                // line to the REAL cart store (which keys by supplier).
                supplier: { select: { id: true, companyName: true, verificationStatus: true } },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    })
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: ownerProjection(collection) })
  } catch (error) {
    console.error('Collection GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'collections-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const { name, description, privacy, coverColor, productIds } = parsed.data

    const existing = await db.collections.findFirst({
      where: { id, userId: auth.user.id },
      include: { items: { select: { productId: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Visible-product guard for the replacement set (same 404 as POST).
    if (productIds) {
      if (productIds.length > 0) {
        const found = await db.products.findMany({
          where: { id: { in: productIds }, isActive: true, isApproved: true },
          select: { id: true },
        })
        if (found.length !== new Set(productIds).size) {
          return NextResponse.json({ error: 'Product not available' }, { status: 404 })
        }
      }
    }

    const nextPrivacy = privacy ?? existing.privacy
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.collections.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description: description || null }),
          ...(privacy !== undefined && {
            privacy,
            // First flight to SHARED mints the secret token.
            ...(privacy === 'SHARED' && !existing.shareToken
              ? { shareToken: mintShareToken() }
              : {}),
          }),
          ...(coverColor !== undefined && { coverColor: coverColor || null }),
        },
      })
      if (productIds) {
        const current = new Set(existing.items.map((i) => i.productId))
        const desired = new Set(productIds)
        const toAdd = productIds.filter((p) => !current.has(p))
        const toRemove = existing.items.filter((i) => !desired.has(i.productId)).map((i) => i.productId)
        if (toAdd.length > 0) {
          await tx.collectionItems.createMany({
            data: toAdd.map((productId) => ({ collectionId: existing.id, productId })),
          })
        }
        if (toRemove.length > 0) {
          await tx.collectionItems.deleteMany({
            where: { collectionId: existing.id, productId: { in: toRemove } },
          })
        }
        await tx.auditLogs.create({
          data: {
            actorId: auth.user!.id,
            action: 'collection_items_synced',
            entityType: 'collections',
            entityId: existing.id,
            metadata: JSON.stringify({ added: toAdd.length, removed: toRemove.length, total: desired.size }),
          },
        })
      }
      return row
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'collection_updated',
        entityType: 'collections',
        entityId: updated.id,
        metadata: JSON.stringify({
          ...(name !== undefined && { name: { from: existing.name, to: updated.name } }),
          ...(privacy !== undefined && { privacy: { from: existing.privacy, to: updated.privacy } }),
        }),
      },
    })

    const fresh = await db.collections.findUnique({
      where: { id: updated.id },
      include: { _count: { select: { items: true } } },
    })
    return NextResponse.json({ success: true, data: ownerProjection(fresh!), message: 'Collection updated' })
  } catch (error) {
    console.error('Collection PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'collections-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const removed = await db.collections.deleteMany({ where: { id, userId: auth.user.id } })
    if (removed.count === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'collection_deleted',
        entityType: 'collections',
        entityId: id,
        metadata: JSON.stringify({}),
      },
    })
    return NextResponse.json({ success: true, message: 'Collection deleted' })
  } catch (error) {
    console.error('Collection DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
