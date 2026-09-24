import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/live-shopping/[id]
 * Retrieve live stream room state, featured products, and live factory info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const stream = await db.liveStreams.findUnique({
      where: { id },
    })

    if (!stream) {
      return NextResponse.json({ error: 'Live stream session not found' }, { status: 404 })
    }

    const supplier = await db.supplierProfiles.findUnique({
      where: { id: stream.supplierId },
      select: { id: true, companyName: true, ratingAvg: true, ratingCount: true },
    })

    // Fetch featured products if specified
    const prodIds = stream.featuredProductIds
      ? stream.featuredProductIds.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const products = prodIds.length > 0
      ? await db.products.findMany({
          where: { id: { in: prodIds } },
          select: { id: true, name: true, basePrice: true, thumbnailUrl: true, stockQuantity: true },
        })
      : await db.products.findMany({
          where: { isActive: true },
          take: 4,
          select: { id: true, name: true, basePrice: true, thumbnailUrl: true, stockQuantity: true },
        })

    return NextResponse.json({
      success: true,
      data: {
        ...stream,
        supplierName: supplier?.companyName || null,
        supplierLogo: null as string | null,
        supplierRating: supplier?.ratingAvg ?? null,
        supplierRatingCount: supplier?.ratingCount ?? 0,
        featuredProducts: products,
        // REAL chat state: no persisted messages yet. Real-time chat is wired
        // via socket.io when the host goes live — never seeded with fake rows.
        liveMessages: [],
      },
    })
  } catch (error) {
    console.error('Live shopping stream GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
