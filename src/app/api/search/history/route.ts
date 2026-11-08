import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/* ══════════════════════════════════════════════════════════════════════
   THE SEARCH-HISTORY CIRCUIT (t292 full repair).

   THE BUG CLASS (the Task 104 `as any` family, in reverse): seven UI
   surfaces (recently-searched, search-home, search-suggestions,
   search-history, search-voice-history, voice-search, generic-info)
   GET/DELETE this route, but it had NO POST — the `searchHistory` table
   had zero writers, so every "Recent searches" rail was permanently
   empty for every buyer. The GET ALSO ordered by `searchedAt` — a column
   the schema has NEVER had (it is `createdAt`) — so even the readers
   500'd the moment the table got a row, hidden behind `(db as any)`
   casts. And /api/search/popular's POST (the text-search trending
   feeder) had zero callers, so the trending page only ever grew from
   voice searches.

   THE REPAIR:
   • GET    — orderBy createdAt (the real column), typed db.searchHistory.
   • POST   — the missing writer: upserts the buyer's (query, searchType)
              row (re-search bumps recency + resultCount), prunes the
              newest-50 cap, and — for text searches — bumps
              popularSearches with the same trending math the voice route
              uses, so TEXT searches finally feed the trending page too.
   • DELETE — unchanged semantics, typed model.
   Guests stay 401 on all three (buyer-scoped by design — the recently-
   viewed doctrine; the seven reader surfaces all gate on sign-in).
   ══════════════════════════════════════════════════════════════════════ */

const HISTORY_CAP = 50
const VALID_SEARCH_TYPES = ['text', 'voice', 'image', 'qr', 'barcode']

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const history = await db.searchHistory.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    return NextResponse.json({ success: true, data: history })
  } catch (error) {
    console.error('SearchHistory GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'search-history-record', 120, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (query.length === 0) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    // The schema column is a 1:1 with the model comment: text | voice | image | qr | barcode
    const searchType =
      typeof body.searchType === 'string' && VALID_SEARCH_TYPES.includes(body.searchType)
        ? body.searchType
        : 'text'
    const resultCount =
      typeof body.resultCount === 'number' && Number.isFinite(body.resultCount) && body.resultCount >= 0
        ? Math.floor(body.resultCount)
        : 0
    const selectedItemId = typeof body.selectedItemId === 'string' && body.selectedItemId.length > 0 ? body.selectedItemId : null
    const selectedItemType =
      typeof body.selectedItemType === 'string' &&
      ['product', 'supplier', 'category'].includes(body.selectedItemType)
        ? body.selectedItemType
        : null
    const filters = typeof body.filters === 'string' && body.filters.length > 0 ? body.filters.slice(0, 2000) : null

    // Upsert on (userId, query, searchType) — a re-search bumps recency.
    // No @@unique covers this triple, so findFirst-then-update (same
    // pattern the voice route uses for popularSearches).
    const existing = await db.searchHistory.findFirst({
      where: { userId: auth.user.id, query, searchType },
    })
    let row
    if (existing) {
      row = await db.searchHistory.update({
        where: { id: existing.id },
        data: { createdAt: new Date(), resultCount, selectedItemId, selectedItemType, filters },
      })
    } else {
      row = await db.searchHistory.create({
        data: { userId: auth.user.id, query, searchType, resultCount, selectedItemId, selectedItemType, filters },
      })
    }

    // Prune beyond the cap (oldest first) — history is context, not a landfill.
    const keep = await db.searchHistory.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_CAP,
      select: { id: true },
    })
    if (keep.length === HISTORY_CAP) {
      const keepIds = new Set(keep.map((k) => k.id))
      await db.searchHistory.deleteMany({
        where: { userId: auth.user.id, id: { notIn: Array.from(keepIds) } },
      })
    }

    // Text searches feed the trending page (the voice route's math, now
    // applied to the 99% case). Voice/image/qr/barcode already bump
    // popularSearches in their own routes.
    if (searchType === 'text') {
      const q = query.toLowerCase().slice(0, 100)
      try {
        const pop = await db.popularSearches.findFirst({ where: { query: q } })
        if (pop) {
          const recencyBoost = 1 / (1 + (Date.now() - pop.lastSearchedAt.getTime()) / (1000 * 60 * 60 * 24))
          const newScore = (pop.searchCount + 1) * 0.5 + recencyBoost * 50
          await db.popularSearches.update({
            where: { id: pop.id },
            data: { searchCount: { increment: 1 }, lastSearchedAt: new Date(), trendingScore: newScore },
          })
        } else {
          await db.popularSearches.create({
            data: { query: q, searchCount: 1, trendingScore: 1, lastSearchedAt: new Date() },
          })
        }
      } catch (popError) {
        // Trending is derived context — a popularSearches hiccup must never
        // fail the buyer's own history write.
        console.error('SearchHistory popularSearches bump error:', popError)
      }
    }

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('SearchHistory POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'search-history-clear', 20, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const term = searchParams.get('term')
    if (term) {
      await db.searchHistory.deleteMany({ where: { userId: auth.user.id, query: term } })
    } else {
      await db.searchHistory.deleteMany({ where: { userId: auth.user.id } })
    }
    return NextResponse.json({ success: true, message: 'Search history cleared' })
  } catch (error) {
    console.error('SearchHistory DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
