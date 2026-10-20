import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sharedProjection } from '@/lib/collections'

/**
 * Task 97: THE SHARED-LINK PROMISE, finally kept. The schema carried a
 * shareToken column "for public shared link" from day one — no route ever
 * served it. A guest holding the secret token opens a SHARED collection
 * read-only. A phantom token and a token whose collection is no longer
 * SHARED are the SAME 404: flipping a collection back to PRIVATE must
 * genuinely break every old link, not serve it to whoever kept the URL.
 * No owner identity, no token reflection in the payload.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = checkRateLimit(request, 'collections-shared-read', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { token } = await params
    const collection = await db.collections.findUnique({
      where: { shareToken: token },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, slug: true, basePrice: true, currency: true,
                unit: true, moq: true, thumbnailUrl: true, stockQuantity: true,
                supplier: { select: { companyName: true } },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    })
    // Only SHARED opens by link — PRIVATE/PUBLIC never serve their rows here.
    if (!collection || collection.privacy !== 'SHARED') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: sharedProjection(collection) })
  } catch (error) {
    console.error('Shared collection GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
