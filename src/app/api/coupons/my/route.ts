import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/coupons/my
 * User's claimed coupons vault with status filters (active, used, expired).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') || 'active'
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      userId: auth.user.id,
    }

    if (status === 'active') {
      where.status = 'active'
      where.validUntil = { gte: new Date() }
    } else if (status === 'used') {
      where.status = 'used'
    } else if (status === 'expired') {
      where.OR = [
        { status: 'expired' },
        { validUntil: { lt: new Date() }, status: 'active' },
      ]
    }

    const [userCoupons, total] = await Promise.all([
      db.userCoupons.findMany({
        where,
        orderBy: { claimedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.userCoupons.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: userCoupons,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('My coupons GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}