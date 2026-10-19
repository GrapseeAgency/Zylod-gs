import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * DELETE /api/supplier/products/[id]/videos/[videoId] — remove a video from a
 * product the SESSION supplier owns (Task 55-c).
 *
 * Auth-first 401 → 20/min rate limit → product ownership check with a
 * NO-LEAK 404 (missing product, foreign product, and missing video all read
 * the same) → delete the productVideos row → if the stored videoUrl points at
 * the local uploads space ('/uploads/videos/…'), unlink the backing file.
 *
 * Honest cleanup: a missing file does NOT fail the request (the row deletion
 * is the source of truth) — the response carries `fileUnlinked` so callers
 * can see exactly what happened on disk. The row is deleted first, so a
 * filesystem hiccup never resurrects a video the seller asked to remove.
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-product-videos-delete', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id, videoId } = await params

    const profile = await db.supplierProfiles.findUnique({ where: { userId: auth.user.id } })
    if (!profile) {
      // Without a real supplier profile this user owns zero products — the
      // same 404 as any foreign/missing product (no existence leak).
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const product = await db.products.findUnique({ where: { id }, select: { id: true, supplierId: true } })
    if (!product || product.supplierId !== profile.id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const video = await db.productVideos.findFirst({ where: { id: videoId, productId: id } })
    if (!video) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    await db.productVideos.delete({ where: { id: video.id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'product_video_detached',
        entityType: 'products',
        entityId: id,
        metadata: JSON.stringify({
          supplierId: profile.id,
          videoId: video.id,
          videoUrl: video.videoUrl,
        }),
      },
    })

    // Best-effort unlink of locally-stored files. External https:// media is
    // left untouched (Zylod does not own that storage). The directory is the
    // SAME resolution the upload route uses — VIDEO_UPLOAD_DIR override first,
    // public/uploads/videos default — or a volume-backed deployment would
    // write in one place and delete in another.
    let fileUnlinked = false
    if (video.videoUrl.startsWith('/uploads/videos/')) {
      const uploadDir =
        process.env.VIDEO_UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads', 'videos')
      const base = path.basename(video.videoUrl)
      const target = path.join(uploadDir, base)
      if (path.resolve(target).startsWith(path.resolve(uploadDir) + path.sep)) {
        try {
          await unlink(target)
          fileUnlinked = true
        } catch (fsError) {
          if ((fsError as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Video file unlink error:', fsError)
          }
          // ENOENT: the file is already gone — the cleanup is still honest.
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Video removed from the product',
      data: { id: video.id, productId: id, fileUnlinked },
    })
  } catch (error) {
    console.error('Supplier product video delete error:', error)
    return NextResponse.json({ error: 'Failed to remove the video' }, { status: 500 })
  }
}
