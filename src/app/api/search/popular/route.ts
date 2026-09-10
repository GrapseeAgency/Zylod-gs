import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/search/popular?limit=20&category=...
 * Returns popular/trending searches from the DB ordered by trendingScore desc
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 30)))
    const category = searchParams.get('category') || undefined

    const where = category ? { category } : {}

    const popular = await db.popularSearches.findMany({
      where,
      orderBy: [{ trendingScore: 'desc' }, { searchCount: 'desc' }],
      take: limit,
      select: {
        id: true,
        query: true,
        searchCount: true,
        clickCount: true,
        trendingScore: true,
        category: true,
        lastSearchedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: popular,
      total: popular.length,
    })
  } catch (error) {
    console.error('Popular searches GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch popular searches' }, { status: 500 })
  }
}

/**
 * POST /api/search/popular — increment search count for a query
 * Body: { query: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query } = body
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const q = query.trim().toLowerCase().slice(0, 100)

    // Upsert: create if not exists, else increment
    const existing = await db.popularSearches.findFirst({ where: { query: q } })
    if (existing) {
      // Increment count and recompute trendingScore (simple: recent searches boost score)
      const recencyBoost = 1 / (1 + (Date.now() - existing.lastSearchedAt.getTime()) / (1000 * 60 * 60 * 24))
      const newScore = (existing.searchCount + 1) * 0.5 + recencyBoost * 50

      await db.popularSearches.update({
        where: { id: existing.id },
        data: {
          searchCount: { increment: 1 },
          lastSearchedAt: new Date(),
          trendingScore: newScore,
        },
      })
    } else {
      await db.popularSearches.create({
        data: {
          query: q,
          searchCount: 1,
          trendingScore: 1,
          lastSearchedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Popular searches POST error:', error)
    return NextResponse.json({ error: 'Failed to update popular searches' }, { status: 500 })
  }
}
