import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/press/[slug]
 * Returns full content of a single press release by slug.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const release = await db.pressReleases.findFirst({
      where: { slug, isPublished: true },
    })

    if (!release) {
      return NextResponse.json({ error: 'Press release not found' }, { status: 404 })
    }

    // Increment views
    await db.pressReleases.update({
      where: { id: release.id },
      data: { views: { increment: 1 } },
    })

    // Fetch related releases
    const related = await db.pressReleases.findMany({
      where: {
        isPublished: true,
        category: release.category,
        id: { not: release.id },
      },
      take: 3,
      orderBy: { publishedAt: 'desc' },
      select: { id: true, slug: true, title: true, summary: true, publishedAt: true, imageUrl: true },
    })

    return NextResponse.json({
      success: true,
      data: { ...release, related },
    })
  } catch (error) {
    console.error('Press release detail GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
