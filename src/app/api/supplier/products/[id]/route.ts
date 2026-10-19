import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { productPayloadSchema } from '@/lib/product-contract'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { notifyBackInStock } from '@/lib/stock-alerts'
import { z } from 'zod'

/**
 * GET    /api/supplier/products/[id] — owner-or-admin product detail (401 unauth,
 *        404 for strangers so unapproved products never leak existence).
 * PATCH  /api/supplier/products/[id] — full canonical-contract replace with
 *        delete+recreate child strategies inside ONE transaction, plus an
 *        optional isActive-only quick toggle (schema-backed products.isActive).
 * DELETE /api/supplier/products/[id] — SOFT delete (isActive:false). Hard delete
 *        is forbidden: orderItems/cartItems/reviews reference products and
 *        order history must survive listing removal.
 *
 * All three are auth-first (401), rate-limited, and audit-logged on mutation.
 */

const WRITE_LIMIT = { limit: 30, windowMs: 5 * 60_000 }

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  priceTiers: { orderBy: { minQty: 'asc' as const } },
  images: { orderBy: { sortOrder: 'asc' as const } },
  videos: { orderBy: { sortOrder: 'asc' as const } },
  variants: { orderBy: { variantName: 'asc' as const } },
} satisfies Prisma.productsInclude

/** Load the product; 404 when missing OR when the requester is not the owner/admin. */
async function loadOwnedProduct(id: string, userId: string, isAdmin: boolean) {
  const product = await db.products.findUnique({ where: { id }, include: productInclude })
  if (!product) return { product: null as null | typeof product, notFound: true }
  if (!isAdmin) {
    const profile = await db.supplierProfiles.findUnique({ where: { userId }, select: { id: true } })
    if (!profile || product.supplierId !== profile.id) {
      // Same 404 as a missing product — no existence leak for foreign products.
      return { product: null as null | typeof product, notFound: true }
    }
  }
  return { product, notFound: false }
}

function summarizeProduct(p: {
  name: string
  basePrice: number
  stockQuantity: number
  isActive: boolean
  isApproved: boolean
  priceTiers: unknown[]
  images: unknown[]
  variants: unknown[]
  videos: unknown[]
}) {
  return {
    name: p.name,
    basePrice: p.basePrice,
    stockQuantity: p.stockQuantity,
    isActive: p.isActive,
    isApproved: p.isApproved,
    tierCount: p.priceTiers.length,
    imageCount: p.images.length,
    variantCount: p.variants.length,
    videoCount: p.videos.length,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const { product, notFound } = await loadOwnedProduct(id, auth.user.id, auth.user.userType === 'admin')
    if (notFound || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Supplier product GET error:', error)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-products-write', WRITE_LIMIT.limit, WRITE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const { product: existing, notFound } = await loadOwnedProduct(id, auth.user.id, auth.user.userType === 'admin')
    if (notFound || !existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    if (body === null || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Quick toggle mode: { isActive: boolean } alone — the real Hide/Show control
    // for the listings manager (products.isActive is schema-backed).
    const bodyKeys = Object.keys(body as Record<string, unknown>)
    if (bodyKeys.length === 1 && bodyKeys[0] === 'isActive') {
      const toggleSchema = z.object({ isActive: z.boolean() })
      const parsedToggle = toggleSchema.safeParse(body)
      if (!parsedToggle.success) {
        return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 })
      }
      const updated = await db.products.update({
        where: { id },
        data: { isActive: parsedToggle.data.isActive },
        include: productInclude,
      })
      await db.auditLogs.create({
        data: {
          actorId: auth.user.id,
          action: 'product_visibility_changed',
          entityType: 'products',
          entityId: id,
          metadata: JSON.stringify({
            before: { isActive: existing.isActive },
            after: { isActive: updated.isActive },
          }),
        },
      })
      return NextResponse.json({ success: true, data: updated, message: 'Listing visibility updated' })
    }

    // Full replace mode: the complete canonical contract (child collections are
    // replaced wholesale — tiers/images/videos/variants delete+recreate).
    const parsed = productPayloadSchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        {
          error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid product payload',
          issues: flattened.fieldErrors,
        },
        { status: 400 }
      )
    }
    const payload = parsed.data

    if (payload.categoryId !== existing.categoryId) {
      const category = await db.categories.findUnique({ where: { id: payload.categoryId }, select: { id: true } })
      if (!category) {
        return NextResponse.json({ error: 'Selected category does not exist' }, { status: 400 })
      }
    }

    const thumbnailUrl =
      payload.thumbnailUrl?.trim() || (payload.images.length > 0 ? payload.images[0].imageUrl : null)

    let updated
    try {
      updated = await db.$transaction(async (tx) => {
        // Replace strategies — children are rebuilt inside the same transaction
        // so a failure anywhere rolls the whole edit back.
        await tx.productPriceTiers.deleteMany({ where: { productId: id } })
        await tx.productImages.deleteMany({ where: { productId: id } })
        await tx.productVideos.deleteMany({ where: { productId: id } })
        // Variants can be referenced by cartItems/orderItems (FK restrict) — a
        // referenced variant surfaces as P2003 and rolls the edit back with a
        // real 409 rather than silently corrupting history.
        await tx.productVariants.deleteMany({ where: { productId: id } })

        return tx.products.update({
          where: { id },
          data: {
            name: payload.name,
            description: payload.description,
            categoryId: payload.categoryId,
            brand: payload.brand || null,
            sku: payload.sku || null,
            unit: payload.unit,
            // Task 55-c: bundle semantics (null = plain single units).
            bundleSize: payload.bundleSize ?? null,
            moq: payload.moq,
            maxOrderQty: payload.maxOrderQty ?? null,
            basePrice: payload.basePrice,
            currency: payload.currency,
            stockQuantity: payload.stockQuantity,
            // Task 57-b: seller-tuned PDP low-stock threshold (null = platform default 5).
            stockAlertThreshold: payload.stockAlertThreshold ?? null,
            isCustomizable: payload.isCustomizable ?? false,
            thumbnailUrl,
            priceTiers:
              payload.priceTiers.length > 0
                ? {
                    create: payload.priceTiers.map((t) => ({
                      minQty: t.minQty,
                      maxQty: t.maxQty ?? null,
                      pricePerUnit: t.pricePerUnit,
                    })),
                  }
                : undefined,
            images:
              payload.images.length > 0
                ? {
                    create: payload.images.map((img) => ({
                      imageUrl: img.imageUrl,
                      sortOrder: img.sortOrder,
                    })),
                  }
                : undefined,
            videos:
              payload.videos && payload.videos.length > 0
                ? {
                    create: payload.videos.map((video, index) => ({
                      videoUrl: video.url,
                      title: video.title ?? null,
                      // Task 67-c: honor the form index when the form sends one;
                      // fall back to array order for legacy payloads.
                      sortOrder: video.sortOrder ?? index,
                    })),
                  }
                : undefined,
            variants:
              payload.variants && payload.variants.length > 0
                ? {
                    create: payload.variants.map((v) => ({
                      variantName: v.variantName,
                      variantValue: v.variantValue,
                      sku: v.sku || null,
                      stockQuantity: v.stockQuantity,
                      priceOverride: v.priceOverride ?? null,
                    })),
                  }
                : undefined,
          },
          include: productInclude,
        })
      })
    } catch (txError) {
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === 'P2003'
      ) {
        return NextResponse.json(
          { error: 'Cannot replace variants: this product has variants referenced by carts or orders. Hide the listing instead.' },
          { status: 409 }
        )
      }
      throw txError
    }

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'product_updated',
        entityType: 'products',
        entityId: id,
        metadata: JSON.stringify({
          supplierId: existing.supplierId,
          before: summarizeProduct(existing),
          after: summarizeProduct(updated),
        }),
      },
    })

    // Real-time (Task 56-c): when the full-replace edit actually CHANGED the
    // product-level stock, push the canonical `product:stock` availability
    // event into the public product room from the REAL persisted after-row.
    // Identical before/after stock (or a stock-less isActive toggle) is a
    // no-op — nothing is broadcast. soldCount is not written by this route.
    if (existing.stockQuantity !== updated.stockQuantity) {
      void broadcastToRoom(`product:${id}`, 'product:stock', {
        productId: id,
        stockQuantity: updated.stockQuantity,
        unit: updated.unit,
        bundleSize: updated.bundleSize,
        inStock: updated.stockQuantity > 0,
      })
      // Task 61: only a genuine RESTOCK (increase) completes back-in-stock
      // watches. Decreases and no-ops never notify.
      if (updated.stockQuantity > existing.stockQuantity) {
        notifyBackInStock(id)
      }
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Product updated successfully',
    })
  } catch (error) {
    console.error('Supplier product PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-products-write', WRITE_LIMIT.limit, WRITE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const { product: existing, notFound } = await loadOwnedProduct(id, auth.user.id, auth.user.userType === 'admin')
    if (notFound || !existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // SOFT delete only — order history, carts and reviews must survive.
    const updated = await db.products.update({
      where: { id },
      data: { isActive: false },
      include: productInclude,
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'product_deleted',
        entityType: 'products',
        entityId: id,
        metadata: JSON.stringify({
          supplierId: existing.supplierId,
          softDelete: true,
          before: { isActive: existing.isActive, name: existing.name },
          after: { isActive: updated.isActive },
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: { id: updated.id, isActive: updated.isActive },
      message: 'Listing removed from the storefront (soft delete — order history preserved)',
    })
  } catch (error) {
    console.error('Supplier product DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove product' }, { status: 500 })
  }
}
