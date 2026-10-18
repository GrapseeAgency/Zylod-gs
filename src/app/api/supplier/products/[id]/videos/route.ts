import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

/**
 * POST /api/supplier/products/[id]/videos — attach a video row to a product
 * the SESSION supplier owns (Task 55-c).
 *
 * Auth-first 401 → 20/min rate limit → resolveSupplierProfile 403 (same
 * helper pattern the other supplier routes use — a session without a real
 * supplierProfiles row never manages videos) → product ownership check with
 * a NO-LEAK 404 for missing OR foreign products → strict Zod body →
 * max-5-videos-per-product cap (409) → create + audit log.
 *
 * Body (Zod strict — unknown keys are rejected):
 *   videoUrl     required — must start with '/uploads/videos/' (the upload
 *                endpoint's path space) OR be an https:// URL (external hosts).
 *   title        optional, ≤ 140 chars
 *   thumbnailUrl optional, ≤ 500 chars
 *   sortOrder    optional int 0..99 (defaults to appending after existing rows)
 *
 * 201 → { success: true, data: video }
 */

const VIDEOS_PER_PRODUCT_CAP = 5

const attachVideoSchema = z
  .object({
    videoUrl: z
      .string()
      .trim()
      .min(1, 'videoUrl is required')
      .refine(
        (v) => v.startsWith('/uploads/videos/') || v.startsWith('https://'),
        'videoUrl must start with /uploads/videos/ or be an https:// URL'
      ),
    title: z.string().trim().max(140, 'Title must be 140 characters or fewer').optional(),
    thumbnailUrl: z.string().trim().max(500, 'Thumbnail URL must be 500 characters or fewer').optional(),
    sortOrder: z
      .number()
      .int('Sort order must be a whole number')
      .min(0, 'Sort order must be 0 or greater')
      .max(99, 'Sort order must be 99 or less')
      .optional(),
  })
  .strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-product-videos', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const profile = await db.supplierProfiles.findUnique({ where: { userId: auth.user.id } })
    if (!profile) {
      return NextResponse.json(
        { error: 'Complete seller registration before managing product videos' },
        { status: 403 }
      )
    }

    const product = await db.products.findUnique({ where: { id }, select: { id: true, supplierId: true } })
    if (!product || product.supplierId !== profile.id) {
      // Same 404 for missing AND foreign products — no existence leak.
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = attachVideoSchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        {
          error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid video payload',
          issues: flattened.fieldErrors,
        },
        { status: 400 }
      )
    }
    const payload = parsed.data

    const existingCount = await db.productVideos.count({ where: { productId: id } })
    if (existingCount >= VIDEOS_PER_PRODUCT_CAP) {
      return NextResponse.json(
        {
          error: `This product already has ${VIDEOS_PER_PRODUCT_CAP} videos — the maximum allowed. Delete one before adding another.`,
        },
        { status: 409 }
      )
    }

    const video = await db.productVideos.create({
      data: {
        productId: id,
        videoUrl: payload.videoUrl,
        title: payload.title ?? null,
        thumbnailUrl: payload.thumbnailUrl ?? null,
        sortOrder: payload.sortOrder ?? existingCount,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'product_video_attached',
        entityType: 'products',
        entityId: id,
        metadata: JSON.stringify({
          supplierId: profile.id,
          videoId: video.id,
          videoUrl: video.videoUrl,
          videoCount: existingCount + 1,
        }),
      },
    })

    return NextResponse.json({ success: true, data: video }, { status: 201 })
  } catch (error) {
    console.error('Supplier product video attach error:', error)
    return NextResponse.json({ error: 'Failed to attach the video' }, { status: 500 })
  }
}
