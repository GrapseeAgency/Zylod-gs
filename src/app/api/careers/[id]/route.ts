import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/careers/[id]
 * Returns full details of a job listing by id or slug.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Support both id and slug lookups
    const job = await db.jobListings.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        isActive: true,
      },
      include: {
        _count: { select: { applications: true } },
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found or no longer active' }, { status: 404 })
    }

    // Increment view — use applicationCount as proxy
    const similarJobs = await db.jobListings.findMany({
      where: {
        isActive: true,
        department: job.department,
        id: { not: job.id },
      },
      take: 3,
      select: {
        id: true, title: true, slug: true,
        department: true, locationType: true, employmentType: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...job,
        applicationCount: job._count.applications,
        similarJobs,
        isExpired: job.expiresAt ? new Date(job.expiresAt) < new Date() : false,
      },
    })
  } catch (error) {
    console.error('Career job detail GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
