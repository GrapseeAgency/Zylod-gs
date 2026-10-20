import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Task 97: per-item membership on an owned collection. ADD only accepts
 * products that are visible on the marketplace right now (isActive +
 * isApproved) — phantom, unapproved and hidden are the SAME honest 404, so
 * the rail can never be used to probe listing states. Adding twice is
 * idempotent (200 alreadyAdded, not an error). Removal of an absent item
 * is an honest 404, not a silent success.
 */

const addSchema = z.object({
  productId: z.string().min(1),
})

export async function POST(
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
    const parsed = addSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'productId required' },
        { status: 400 }
      )
    }
    const { productId } = parsed.data

    const collection = await db.collections.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true },
    })
    if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

    const product = await db.products.findFirst({
      where: { id: productId, isActive: true, isApproved: true },
      select: { id: true },
    })
    if (!product) return NextResponse.json({ error: 'Product not available' }, { status: 404 })

    const existing = await db.collectionItems.findUnique({
      where: { collectionId_productId: { collectionId: collection.id, productId } },
    })
    if (existing) {
      return NextResponse.json({
        success: true, data: existing, alreadyAdded: true,
        message: 'Product is already in this collection',
      })
    }

    const item = await db.collectionItems.create({
      data: { collectionId: collection.id, productId },
    })
    // Keep updatedAt honest — lists sort by it.
    await db.collections.update({ where: { id: collection.id }, data: { updatedAt: new Date() } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'collection_item_added',
        entityType: 'collectionItems',
        entityId: item.id,
        metadata: JSON.stringify({ collectionId: collection.id, productId }),
      },
    })
    return NextResponse.json({ success: true, data: item, message: 'Product added to collection' }, { status: 201 })
  } catch (error) {
    console.error('CollectionItems POST error:', error)
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
    const productId = request.nextUrl.searchParams.get('productId')
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

    const collection = await db.collections.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true },
    })
    if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

    const removed = await db.collectionItems.deleteMany({
      where: { collectionId: collection.id, productId },
    })
    if (removed.count === 0) {
      return NextResponse.json({ error: 'Product not in this collection' }, { status: 404 })
    }
    await db.collections.update({ where: { id: collection.id }, data: { updatedAt: new Date() } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'collection_item_removed',
        entityType: 'collectionItems',
        entityId: collection.id,
        metadata: JSON.stringify({ collectionId: collection.id, productId }),
      },
    })
    return NextResponse.json({ success: true, message: 'Product removed from collection' })
  } catch (error) {
    console.error('CollectionItems DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
