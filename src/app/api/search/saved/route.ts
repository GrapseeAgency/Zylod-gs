import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/search/saved
 * Returns saved searches for the authenticated user or public defaults
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const userId = auth.authenticated && auth.user ? auth.user.id : null

    const saved = await db.searchFilters.findMany({
      where: userId ? {
        OR: [
          { userId },
          { isDefault: true }
        ]
      } : { isDefault: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: saved
    })
  } catch (error) {
    console.error('Saved searches GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 })
  }
}

/**
 * POST /api/search/saved
 * Creates a new saved search filter configuration
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { name, filterConfig } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const saved = await db.searchFilters.create({
      data: {
        userId: auth.user.id,
        name: name.trim(),
        filterConfig: typeof filterConfig === 'string' ? filterConfig : JSON.stringify(filterConfig || {}),
        isDefault: false
      }
    })

    return NextResponse.json({
      success: true,
      data: saved
    })
  } catch (error) {
    console.error('Saved searches POST error:', error)
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 })
  }
}
