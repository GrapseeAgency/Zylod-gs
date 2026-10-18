import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * Seller RFQ inbox — detail API (Task 51-d). Sibling of GET /api/supplier/rfqs.
 *
 * Visibility is consistent with the list route: rfqRequests has NO supplierId
 * column (marketplace-open requests — see the list route's linkage decision),
 * so any authenticated supplier may view any request, exactly like the list
 * shows any request of any real status (open | quoted | awarded | closed |
 * expired). Admin bypasses as trusted role.
 *
 * Contract:
 *  - requireUserType(['supplier','admin']) → 401 FIRST, then 60/min rate limit.
 *  - Suppliers resolve their real profile via resolveSupplierProfile — none →
 *    403 SUPPLIER_PROFILE_REQUIRED (same as the list route).
 *  - Unknown id → 404 'RFQ request not found' (no existence games needed —
 *    the request is not supplier-targeted, so there is nothing to leak).
 *  - Buyer identity LIMITED to buyerProfiles.fullName (privacy rule from
 *    Task 50) — never email/phone/address.
 *  - myQuote (Task 52-a): the requesting supplier's OWN quote on this RFQ
 *    (null when none, or for admins — admins do not quote). Lets the UI
 *    pre-fill the Respond dialog for an edit instead of guessing.
 *  - RESPONDING: POST /api/supplier/rfqs/[id]/quote now exists (Task 52-a —
 *    the first rfqQuotes writer). This GET remains read-only.
 */

const READ_LIMIT = { limit: 60, windowMs: 60_000 }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // AUTH FIRST — 401 before any rate limiting.
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Supplier authentication required' }, { status: 401 })
  }

  // Rate limit AFTER auth — 60 reads per minute per client.
  const rl = checkRateLimit(request, 'supplier-rfq-detail', READ_LIMIT.limit, READ_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  const isAdmin = auth.user.userType === 'admin'
  let supplierScope: string | null = null
  if (!isAdmin) {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }
    supplierScope = profile.id
  }

  try {
    const { id } = await params

    const rfq = await db.rfqRequests.findUnique({
      where: { id },
      include: {
        items: true,
        _count: { select: { quotes: true } },
        buyer: { select: { buyerProfile: { select: { fullName: true } } } },
      },
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }

    // myQuote — the caller's own quote on this RFQ (suppliers only; admins
    // do not quote, so theirs is honestly null rather than fabricated).
    let myQuote: Record<string, unknown> | null = null
    if (supplierScope) {
      const own = await db.rfqQuotes.findFirst({
        where: { rfqId: rfq.id, supplierId: supplierScope },
      })
      if (own) {
        myQuote = {
          id: own.id,
          rfqId: own.rfqId,
          supplierId: own.supplierId,
          pricePerUnit: own.pricePerUnit,
          totalPrice: own.totalPrice,
          deliveryDays: own.deliveryDays,
          message: own.message,
          status: own.status,
          createdAt: own.createdAt.toISOString(),
        }
      }
    }

    const data = {
      id: rfq.id,
      title: rfq.title,
      description: rfq.description,
      categorySlug: rfq.categorySlug,
      quantity: rfq.quantity,
      unit: rfq.unit,
      targetPrice: rfq.targetPrice,
      deliveryCity: rfq.deliveryCity,
      deadline: rfq.deadline,
      status: rfq.status,
      itemCount: rfq.items.length,
      quoteCount: rfq._count.quotes,
      // PRIVACY: display name only — the users row's email/phone never cross this boundary.
      buyer: { displayName: rfq.buyer?.buyerProfile?.fullName ?? null },
      items: rfq.items,
      myQuote,
      createdAt: rfq.createdAt,
      updatedAt: rfq.updatedAt,
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Supplier RFQ detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
