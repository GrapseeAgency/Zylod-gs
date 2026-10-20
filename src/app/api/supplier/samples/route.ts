import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { parseAddressSnapshot } from '@/lib/addresses'

/**
 * GET /api/supplier/samples — the SELLER side of the sample rail (Task 90):
 * every sample request for the signed-in supplier's products, newest first.
 *
 * 401-first (authenticateRequest), then the supplier-profile resolution
 * (403 SUPPLIER_PROFILE_REQUIRED — the same shape every seller rail uses),
 * then 'supplier-samples-list' 60/min. Scope comes from the REAL profile id
 * (sampleOrders.supplierId) — a supplier can never see another seller's
 * requests. Rows embed the product, the buyer's real display name, and the
 * shipping address from the immutable creation snapshot (honestly flagged
 * fromSnapshot:true when the live address row is gone — Task 87's read
 * shape; there is no live-address preference here because the address book
 * belongs to the buyer, not to the supplier reading it).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }

  const rl = checkRateLimit(request, 'supplier-samples-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rows = await db.sampleOrders.findMany({
      where: { supplierId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: { id: true, name: true, slug: true, thumbnailUrl: true, unit: true, basePrice: true },
        },
        buyer: {
          select: { buyerProfile: { select: { fullName: true } } },
        },
      },
    })

    const samples = rows.map((s) => {
      const snapshot = parseAddressSnapshot(s.shippingAddressSnapshot)
      return {
        id: s.id,
        quantity: s.quantity,
        status: s.status,
        samplePrice: s.samplePrice,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        product: s.product
          ? {
              id: s.product.id,
              name: s.product.name,
              slug: s.product.slug,
              thumbnail: s.product.thumbnailUrl,
              unit: s.product.unit,
              basePrice: s.product.basePrice,
            }
          : null,
        buyerName: s.buyer?.buyerProfile?.fullName ?? null,
        shippingAddress: snapshot,
        fromSnapshot: Boolean(snapshot),
      }
    })

    const stats = {
      total: samples.length,
      requested: samples.filter((s) => s.status === 'requested').length,
      shipped: samples.filter((s) => s.status === 'shipped').length,
      delivered: samples.filter((s) => s.status === 'delivered').length,
      cancelled: samples.filter((s) => s.status === 'cancelled').length,
    }

    return NextResponse.json({ success: true, data: { samples, stats } })
  } catch (err) {
    console.error('GET /api/supplier/samples error:', err)
    return NextResponse.json({ error: 'Failed to load sample requests' }, { status: 500 })
  }
}
