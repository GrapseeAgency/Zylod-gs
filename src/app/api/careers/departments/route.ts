import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/careers/departments
 * Returns all departments with job counts and metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const jobs = await db.jobListings.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { department: true, locationType: true, employmentType: true },
    })

    const deptMap: Record<string, { total: number; remote: number; hybrid: number; onsite: number }> = {}

    for (const j of jobs) {
      if (!deptMap[j.department]) {
        deptMap[j.department] = { total: 0, remote: 0, hybrid: 0, onsite: 0 }
      }
      deptMap[j.department].total++
      if (j.locationType === 'remote') deptMap[j.department].remote++
      else if (j.locationType === 'hybrid') deptMap[j.department].hybrid++
      else deptMap[j.department].onsite++
    }

    const departments = Object.entries(deptMap).map(([name, stats]) => ({
      name,
      ...stats,
    })).sort((a, b) => b.total - a.total)

    return NextResponse.json({
      success: true,
      data: {
        departments,
        totalOpenings: jobs.length,
        totalDepartments: departments.length,
      },
    })
  } catch (error) {
    console.error('Career departments GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
