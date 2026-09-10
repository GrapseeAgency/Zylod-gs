import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/careers
 * Lists all active job openings. Filterable by department, locationType, employmentType.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department') || undefined
    const locationType = searchParams.get('locationType') || undefined
    const employmentType = searchParams.get('employmentType') || undefined
    const featured = searchParams.get('featured') === 'true'

    const jobs = await db.jobListings.findMany({
      where: {
        isActive: true,
        ...(department ? { department } : {}),
        ...(locationType ? { locationType } : {}),
        ...(employmentType ? { employmentType } : {}),
        ...(featured ? { isFeatured: true } : {}),
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        department: true,
        locationType: true,
        location: true,
        employmentType: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        isFeatured: true,
        applicationCount: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Department stats
    const deptCounts = jobs.reduce((acc: Record<string, number>, j) => {
      acc[j.department] = (acc[j.department] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        jobs,
        total: jobs.length,
        departmentCounts: deptCounts,
        departments: Object.keys(deptCounts),
      },
    })
  } catch (error) {
    console.error('Careers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
