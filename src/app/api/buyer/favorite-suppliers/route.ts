import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// GET /api/buyer/favorite-suppliers — list all suppliers the current buyer follows
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const rows = await db.favoriteSuppliers.findMany({
      where: { buyerId: auth.user.id },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            verificationStatus: true,
            ratingAvg: true,
            ratingCount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { count: rows.length },
    })
  } catch (error) {
    console.error('favorite-suppliers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
