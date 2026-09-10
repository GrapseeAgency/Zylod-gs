import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/search/voice
 * Processes voice transcript, logs searchHistory, and boosts popular search score.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const body = await request.json()
    const query = (body.query || '').trim()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Save to search history if authenticated
    if (auth.authenticated && auth.user) {
      await db.searchHistory.create({
        data: {
          userId: auth.user.id,
          query,
          searchType: 'voice',
          resultCount: 1,
        }
      })
    }

    // Update popular searches
    const qLower = query.toLowerCase().slice(0, 100)
    const existing = await db.popularSearches.findFirst({ where: { query: qLower } })
    if (existing) {
      await db.popularSearches.update({
        where: { id: existing.id },
        data: {
          searchCount: { increment: 1 },
          trendingScore: { increment: 2.0 },
          lastSearchedAt: new Date(),
        }
      })
    } else {
      await db.popularSearches.create({
        data: {
          query: qLower,
          searchCount: 1,
          trendingScore: 2.0,
          lastSearchedAt: new Date(),
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Voice search recorded',
      query
    })
  } catch (error) {
    console.error('Voice search error:', error)
    return NextResponse.json({ error: 'Failed to process voice search' }, { status: 500 })
  }
}
