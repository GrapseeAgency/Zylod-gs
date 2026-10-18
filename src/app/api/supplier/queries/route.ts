import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/queries — REAL sellerCustomerQueries rows for the signed-in
 * supplier (buyer questions about my products). Honest empty list when none —
 * no fake "Karim Fabrics" sample rows.
 *
 * There is intentionally NO POST here: customer queries are created by
 * buyers, never by the seller, so the previous fake "success" echo is gone.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-queries-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const status = request.nextUrl.searchParams.get('status')

    // NOTE: sellerCustomerQueries has NO Prisma relation to users/products
    // (only plain FK strings), so buyer + product names are resolved with
    // two explicit lookups instead of an include.
    const queries = await db.sellerCustomerQueries.findMany({
      where: { supplierId: profile.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const buyerIds = Array.from(new Set(queries.map((q) => q.buyerId)))
    const productIds = Array.from(new Set(queries.map((q) => q.productId).filter((v): v is string => v != null)))
    // Explicit row types: the `cond ? findMany : Promise.resolve([])` ternary
    // otherwise collapses `b`/`p` to `any` inside the Map constructor.
    type BuyerRow = { id: string; buyerProfile: { fullName: string; businessName: string } | null }
    type ProductRow = { id: string; name: string }
    const [buyers, products] = await Promise.all([
      buyerIds.length
        ? db.users.findMany({
            where: { id: { in: buyerIds } },
            select: { id: true, buyerProfile: { select: { fullName: true, businessName: true } } },
          })
        : Promise.resolve([] as BuyerRow[]),
      productIds.length
        ? db.products.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
        : Promise.resolve([] as ProductRow[]),
    ])
    const buyerById = new Map(buyers.map((b) => [b.id, b] as const))
    const productById = new Map(products.map((p) => [p.id, p] as const))

    return NextResponse.json({
      success: true,
      data: queries.map((q) => {
        const buyerProfile = buyerById.get(q.buyerId)?.buyerProfile
        return {
          id: q.id,
          buyerId: q.buyerId,
          buyerName:
            buyerProfile?.businessName ||
            buyerProfile?.fullName ||
            'Anonymous buyer',
          productId: q.productId,
          productName: q.productId ? productById.get(q.productId)?.name || null : null,
          queryType: q.queryType,
          subject: q.subject,
          lastMessage: q.message,
          status: q.status,
          replyMessage: q.replyMessage,
          createdAt: q.createdAt,
        }
      }),
    })
  } catch (error) {
    console.error('Supplier queries GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
