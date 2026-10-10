import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/attachments/[id] — serves the raw bytes of one evidence photo.
 *
 * Access rules (enforced here, not assumed):
 * - authenticateRequest FIRST → 401. Authentication is required EVEN for an
 *   unknown id — an unauthenticated caller can never use this endpoint to
 *   probe which photo ids exist.
 * - The requester must be the photo's uploading buyer (evidencePhotos.buyerId)
 *   OR an admin (auth.user.userType === 'admin' — the same admin detection
 *   used by /api/returns/[id] and /api/complaints/[id]). Anyone else gets a
 *   404 — the endpoint does not reveal that the photo exists.
 * - Unknown id → 404.
 * - Responds with the real bytes and the real stored Content-Type,
 *   Cache-Control 'private, max-age=3600' (private: only the authorized
 *   requester may cache it) and the exact Content-Length.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return Response.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'attachments-get', 120, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const photo = await db.evidencePhotos.findUnique({
      where: { id },
      select: {
        data: true,
        mimeType: true,
        sizeBytes: true,
        buyerId: true,
      },
    })

    // Owner-or-admin; every other caller gets the same 404 as an unknown id —
    // no existence leak, no way to enumerate other buyers' evidence.
    if (!photo || (photo.buyerId !== auth.user.id && auth.user.userType !== 'admin')) {
      return Response.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Copy into a plain Uint8Array so no Buffer-view pooling can over-expose
    // adjacent bytes, and hand the exact stored length to Content-Length.
    const body = new Uint8Array(photo.data)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': photo.mimeType,
        'Content-Length': String(photo.sizeBytes),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('Attachment serve error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
