import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/admin/users — list all users with profiles (ADMIN ONLY)
 * Query params: page, limit, role (buyer|supplier|admin), status, search
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (role) where.userType = role
    if (status) where.accountStatus = status
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { phone: { contains: search } },
        { buyerProfile: { fullName: { contains: search } } },
        { supplierProfile: { companyName: { contains: search } } },
      ]
    }

    const [users, total] = await Promise.all([
      db.users.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, userType: true, email: true, phone: true, accountStatus: true,
          createdAt: true, isEmailVerified: true, isPhoneVerified: true,
          buyerProfile: { select: { fullName: true, businessName: true, businessType: true, profileCompletionPct: true } },
          supplierProfile: { select: { id: true, companyName: true, verificationStatus: true, ratingAvg: true } },
          _count: { select: { orders: true, reviews: true, quoteRequests: true } },
        },
      }),
      db.users.count({ where }),
    ])

    const data = users.map(u => ({
      id: u.id,
      userType: u.userType,
      email: u.email,
      phone: u.phone,
      accountStatus: u.accountStatus,
      createdAt: u.createdAt,
      isEmailVerified: u.isEmailVerified,
      isPhoneVerified: u.isPhoneVerified,
      fullName: u.buyerProfile?.fullName || null,
      businessName: u.buyerProfile?.businessName || null,
      companyName: u.supplierProfile?.companyName || null,
      verificationStatus: u.supplierProfile?.verificationStatus || null,
      ratingAvg: u.supplierProfile?.ratingAvg || 0,
      orderCount: u._count.orders,
      reviewCount: u._count.reviews,
      quoteRequestCount: u._count.quoteRequests,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Admin users GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users — update user account status (suspend/reactivate)
 * Body: { userId, action: 'suspend' | 'activate' | 'ban', reason?: string }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { userId, action, reason } = body

    if (!userId || !['suspend', 'activate', 'ban'].includes(action)) {
      return NextResponse.json({ error: 'userId and valid action are required' }, { status: 400 })
    }

    const accountStatus = action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : 'active'

    const user = await db.users.update({
      where: { id: userId },
      data: { accountStatus },
    })

    // Log the action
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: `user_${action}`,
        entityType: 'users',
        entityId: userId,
        metadata: JSON.stringify({ reason, accountStatus }),
      },
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('Admin users PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
