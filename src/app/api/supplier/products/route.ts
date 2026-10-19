import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { productPayloadSchema, slugifyProductName } from '@/lib/product-contract'
import crypto from 'crypto'

/**
 * GET  /api/supplier/products — list the SESSION supplier's own products.
 *      Admins may pass ?all=true to list every product on the marketplace.
 * POST /api/supplier/products — create a product (canonical contract, Zod-validated).
 *
 * Auth-first (401 for anonymous / non-supplier callers), rate-limited, Zod-validated.
 * The old POST auto-fabricated a dummy-KYC supplierProfile ('Wholesale Supplier',
 * NID 0000000000) — that is GONE: a session user without a real supplierProfiles
 * row gets an honest 403 and NO rows are ever invented (de-fake mandate).
 *
 * New products are created with isApproved=false (schema default) so they land
 * in the admin moderation queue — creation never self-approves.
 */

const WRITE_LIMIT = { limit: 30, windowMs: 5 * 60_000 }
const LIST_LIMIT = { limit: 60, windowMs: 60_000 }

/** Resolve the session user's REAL supplierProfiles row (userId is @unique). */
function resolveSupplierProfile(userId: string) {
  return db.supplierProfiles.findUnique({ where: { userId } })
}

/** Generate a collision-safe slug: products.slug is indexed but not unique in the schema. */
async function buildUniqueSlug(name: string): Promise<string> {
  const base = slugifyProductName(name)
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${crypto.randomBytes(4).toString('hex')}`
    const existing = await db.products.findFirst({ where: { slug: candidate }, select: { id: true } })
    if (!existing) return candidate
  }
  // Practically unreachable (random 32-bit suffix) — honest fallback still unique enough.
  return `${base}-${crypto.randomBytes(8).toString('hex')}`
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-products-list', LIST_LIMIT.limit, LIST_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const categoryId = searchParams.get('categoryId')?.trim()
    const all = searchParams.get('all') === 'true' && auth.user.userType === 'admin'

    const where: {
      supplierId?: string
      isActive?: boolean
      isApproved?: boolean
      stockQuantity?: Record<string, number>
      name?: Record<string, string>
      categoryId?: string
    } = {}

    if (all) {
      // Admin bulk view — every supplier's products.
    } else {
      const profile = await resolveSupplierProfile(auth.user.id)
      if (!profile) {
        // Honest empty result: without a supplier profile this user owns zero products.
        return NextResponse.json({
          success: true,
          data: { items: [], total: 0, page, limit, totalPages: 0 },
        })
      }
      where.supplierId = profile.id
    }

    // Real moderation/listing states derived from isApproved + isActive only.
    if (status === 'active') where.isActive = true
    else if (status === 'inactive') where.isActive = false
    else if (status === 'pending') {
      where.isApproved = false
      where.isActive = true
    } else if (status === 'approved') {
      where.isApproved = true
      where.isActive = true
    } else if (status === 'out_of_stock') where.stockQuantity = { lte: 0 }

    if (search) where.name = { contains: search }
    if (categoryId) where.categoryId = categoryId

    const [items, total] = await Promise.all([
      db.products.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          priceTiers: { orderBy: { minQty: 'asc' } },
          images: { orderBy: { sortOrder: 'asc' } },
          videos: { orderBy: { sortOrder: 'asc' } },
          variants: { orderBy: { variantName: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.products.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Supplier products GET error:', error)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json().catch(() => null)
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

    // REAL supplier resolution — never fabricate a profile (de-fake mandate).
    const profile = await resolveSupplierProfile(auth.user.id)
    if (!profile) {
      return NextResponse.json(
        { error: 'Complete seller registration before creating products' },
        { status: 403 }
      )
    }

    // Real FK pre-check so sellers get an honest 400 instead of a Prisma P2003 500.
    const category = await db.categories.findUnique({ where: { id: payload.categoryId }, select: { id: true } })
    if (!category) {
      return NextResponse.json({ error: 'Selected category does not exist' }, { status: 400 })
    }

    const slug = await buildUniqueSlug(payload.name)
    const thumbnailUrl =
      payload.thumbnailUrl?.trim() || (payload.images.length > 0 ? payload.images[0].imageUrl : null)

    const product = await db.products.create({
      data: {
        supplierId: profile.id,
        categoryId: payload.categoryId,
        name: payload.name,
        slug,
        description: payload.description,
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
        isApproved: false, // moderation queue decides visibility — creation never self-approves
        isActive: true,
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
      include: {
        category: { select: { id: true, name: true, slug: true } },
        priceTiers: { orderBy: { minQty: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        videos: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { variantName: 'asc' } },
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'product_created',
        entityType: 'products',
        entityId: product.id,
        metadata: JSON.stringify({
          supplierId: profile.id,
          name: product.name,
          basePrice: product.basePrice,
          currency: product.currency,
          stockQuantity: product.stockQuantity,
          unit: product.unit,
          bundleSize: product.bundleSize,
          tierCount: payload.priceTiers.length,
          imageCount: payload.images.length,
          variantCount: payload.variants?.length ?? 0,
          isApproved: false,
        }),
      },
    })

    return NextResponse.json(
      { success: true, data: product, message: 'Product created — it is pending admin review before buyers can see it' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Supplier products POST error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
