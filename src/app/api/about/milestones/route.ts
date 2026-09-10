import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/about/milestones
 * Returns company milestones timeline.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined

    const milestones = await db.companyMilestones.findMany({
      where: {
        isPublished: true,
        ...(year ? { year } : {}),
      },
      orderBy: [{ year: 'asc' }, { sortOrder: 'asc' }],
    })

    const years = [...new Set(milestones.map(m => m.year))].sort()

    return NextResponse.json({
      success: true,
      data: { milestones, years, total: milestones.length },
    })
  } catch (error) {
    console.error('Milestones GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
