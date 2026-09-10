import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/live-shopping
 * List ongoing and scheduled factory live broadcasts.
 *
 * POST /api/live-shopping
 * Supplier creates a new live broadcast session.
 */
export async function GET(request: NextRequest) {
  try {
    const streams = await db.liveStreams.findMany({
      orderBy: [{ isLive: 'desc' }, { scheduledAt: 'asc' }],
      take: 20,
    })

    const supplierIds = [...new Set(streams.map(s => s.supplierId))]
    const suppliers = supplierIds.length > 0
      ? await db.supplierProfiles.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, companyName: true },
        })
      : []
    const suppMap = new Map(suppliers.map(s => [s.id, s]))

    const data = streams.map(s => {
      const supp = suppMap.get(s.supplierId)
      return {
        id: s.id,
        supplierId: s.supplierId,
        supplierName: supp?.companyName || 'Verified Factory',
        supplierLogo: null as string | null,
        supplierRating: 4.9,
        title: s.title,
        description: s.description,
        isLive: s.isLive,
        viewerCount: s.viewerCount,
        thumbnailUrl: s.thumbnailUrl || 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=600&q=80',
        streamUrl: s.streamUrl,
        playbackUrl: s.playbackUrl,
        scheduledAt: s.scheduledAt.toISOString(),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Live shopping GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, scheduledAt, streamUrl, thumbnailUrl, featuredProductIds } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 })
    }

    const stream = await db.liveStreams.create({
      data: {
        supplierId: auth.user.id,
        title,
        description,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        streamUrl: streamUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        featuredProductIds: featuredProductIds || null,
        isLive: true,
        viewerCount: 1,
      },
    })

    return NextResponse.json({ success: true, data: stream }, { status: 201 })
  } catch (error) {
    console.error('Live shopping POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
