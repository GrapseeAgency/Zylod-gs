import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/profile/account — Real account metadata and stats for the logged-in user.
 * DELETE /api/profile/account — Real account deletion request (marks account suspended/deleted).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id

    const [ordersCount, productsCount, reviewsCount, user] = await Promise.all([
      db.orders.count({ where: { buyerId: userId } }),
      db.products.count({ where: { supplierId: userId } }),
      db.reviews.count({ where: { buyerId: userId } }),
      db.users.findUnique({
        where: { id: userId },
        select: { createdAt: true, accountStatus: true, userType: true, email: true, phone: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        userId,
        accountStatus: user?.accountStatus || 'active',
        userType: user?.userType,
        email: user?.email,
        phone: user?.phone,
        createdAt: user?.createdAt,
        ordersCount,
        productsCount,
        reviewsCount,
      },
    })
  } catch (error) {
    console.error('Account GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { confirmation } = body

    if (!confirmation || confirmation !== 'DELETE') {
      return NextResponse.json({ error: 'Confirmation text must be DELETE' }, { status: 400 })
    }

    const userId = auth.user.id

    // Soft-delete the account by setting accountStatus = 'suspended'
    await db.users.update({
      where: { id: userId },
      data: { accountStatus: 'suspended' },
    })

    // Revoke all active sessions
    await db.sessions.deleteMany({ where: { userId } }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'Account scheduled for deletion and sessions revoked.',
    })
  } catch (error) {
    console.error('Account DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}