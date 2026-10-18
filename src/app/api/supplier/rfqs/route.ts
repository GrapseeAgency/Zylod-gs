import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * Seller RFQ inbox — list API (Task 51-d, the severed chain's read side).
 *
 * Buyers create requests via POST /api/rfq (rfqRequests + rfqItems rows).
 * Sellers until now had NO way to see them.
 *
 * LINKAGE DECISION (schema evidence): the rfqRequests model has NO supplierId
 * column and no targeting table (its only relation edges are buyer→users,
 * items→rfqItems, quotes→rfqQuotes). RFQs are therefore MARKETPLACE-OPEN:
 * any supplier may see open requests and quote on them. The categorySlug
 * column exists but is a buyer-supplied free-text-ish slug, not supplier
 * targeting — it is returned on each row so sellers can self-filter.
 *
 * Contract:
 *  - requireUserType(['supplier','admin']) → 401 FIRST, then 60/min rate limit.
 *  - Suppliers resolve their real profile via resolveSupplierProfile — none →
 *    403 SUPPLIER_PROFILE_REQUIRED (the lib's documented convention). Admin
 *    bypasses as trusted role.
 *  - Default view: status = 'open' (the real schema values are
 *    open | quoted | awarded | closed | expired — documented on the model).
 *    ?status=<value|all> filters; ?all=true (ADMIN ONLY) ignores the status
 *    filter and returns everything.
 *  - ?q= title search (contains — SQLite LIKE, ASCII case-insensitive).
 *  - ?page/?limit pagination (limit clamped 1..100) + real total.
 *  - Buyer identity is LIMITED to buyerProfiles.fullName (privacy rule from
 *    Task 50) — never email/phone/address. buyerId cuids are not exposed.
 */

const READ_LIMIT = { limit: 60, windowMs: 60_000 }

/** The exact status values the rfqRequests schema documents. */
const RFQ_STATUSES = ['open', 'quoted', 'awarded', 'closed', 'expired'] as const

export async function GET(request: NextRequest) {
  // AUTH FIRST — 401 before any rate limiting or param validation.
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Supplier authentication required' }, { status: 401 })
  }

  // Rate limit AFTER auth — 60 reads per minute per client.
  const rl = checkRateLimit(request, 'supplier-rfq-list', READ_LIMIT.limit, READ_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  const isAdmin = auth.user.userType === 'admin'
  if (!isAdmin) {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }
  }

  try {
    const { searchParams } = request.nextUrl

    const page = Math.max(1, Math.floor(Number(searchParams.get('page') || 1)) || 1)
    const limit = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get('limit') || 20)) || 20))
    const skip = (page - 1) * limit

    // Status filter — validated against the REAL schema values.
    const allParam = searchParams.get('all') === 'true' && isAdmin
    const statusParam = searchParams.get('status') || ''
    let statusFilter: string | null = 'open' // marketplace default: what sellers can act on
    if (allParam) {
      statusFilter = null // admin ?all=true sees everything
    } else if (statusParam) {
      if (statusParam === 'all') {
        statusFilter = null
      } else if (!(RFQ_STATUSES as readonly string[]).includes(statusParam)) {
        return NextResponse.json(
          { error: `Invalid status. Allowed values: ${RFQ_STATUSES.join(' | ')} | all` },
          { status: 400 }
        )
      } else {
        statusFilter = statusParam
      }
    }

    const q = (searchParams.get('q') || '').trim()

    const where: Record<string, unknown> = {}
    if (statusFilter) where.status = statusFilter
    if (q) where.title = { contains: q }

    const [rfqs, total] = await Promise.all([
      db.rfqRequests.findMany({
        where,
        orderBy: { createdAt: 'desc' }, // newest first
        skip,
        take: limit,
        include: {
          items: true,
          _count: { select: { quotes: true } },
          buyer: { select: { buyerProfile: { select: { fullName: true } } } },
        },
      }),
      db.rfqRequests.count({ where }),
    ])

    const data = rfqs.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      categorySlug: r.categorySlug,
      quantity: r.quantity,
      unit: r.unit,
      targetPrice: r.targetPrice,
      deliveryCity: r.deliveryCity,
      deadline: r.deadline,
      status: r.status,
      itemCount: r.items.length,
      quoteCount: r._count.quotes,
      // PRIVACY: display name only — the users row's email/phone never cross this boundary.
      buyer: { displayName: r.buyer?.buyerProfile?.fullName ?? null },
      items: r.items,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Supplier RFQ list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
