import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { certificationStatus } from '@/lib/certifications'
import { shapePublic as shapeWarehouse } from '@/lib/warehouses'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')

    let targetSupplierId: string | null = supplierId

    if (!targetSupplierId) {
      const auth = await authenticateRequest(request)
      if (auth.authenticated && auth.user) {
        // With a session and no explicit supplierId → the caller's OWN storefront.
        const profile = await db.supplierProfiles.findFirst({
          where: { userId: auth.user.id },
          select: { id: true },
        })
        targetSupplierId = profile ? profile.id : null
      }
    }

    // HONEST 404 — no session (or session without a supplier profile) and no
    // explicit supplierId means there is nothing to show. The old
    // "first supplier in the DB" fallback is gone: guests must never be
    // served an arbitrary supplier's store as if it were theirs.
    if (!targetSupplierId) {
      return NextResponse.json(
        { error: supplierId ? 'Supplier not found' : 'No storefront specified — pass ?supplierId= to view a store' },
        { status: 404 }
      )
    }

    const supplier = await db.supplierProfiles.findFirst({
      where: {
        OR: [
          { id: targetSupplierId },
          { userId: targetSupplierId }
        ]
      },
      include: {
        storeCustomization: true,
        products: {
          // Public read: only APPROVED and active listings are visible on a
          // storefront — pending/rejected moderation items stay private.
          where: { isActive: true, isApproved: true },
          take: 24,
          include: { priceTiers: true }
        },
        supplierReviews: {
          take: 10,
          include: { buyer: { select: { buyerProfile: { select: { fullName: true, businessName: true } } } } }
        },
        _count: { select: { products: true, supplierReviews: true } }
      }
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Task 96: THE STOREFRONT TRUST ROLLUP — Task 92's productCertifications
    // rail aggregated across this supplier's PUBLIC products (the exact
    // visibility contract the storefront itself uses: isActive + isApproved —
    // a pending/rejected listing's certs never advertise trust). Every status
    // is server-computed by the SAME vocabulary the PDP tab uses, expired
    // rows are counted and badged (never silently dropped), and the recent
    // list carries real product attribution so a buyer can tap through to
    // the product's own certification tab. Empty = the honest zero, never a
    // fabricated claim.
    const certRows = await db.productCertifications.findMany({
      where: {
        product: { supplierId: supplier.id, isActive: true, isApproved: true },
      },
      orderBy: { issuedAt: 'desc' },
      include: { product: { select: { id: true, name: true } } },
    })
    const certStats = { active: 0, expiring_soon: 0, expired: 0 } as Record<string, number>
    const issuers = new Set<string>()
    for (const row of certRows) {
      certStats[certificationStatus(row.expiresAt)] += 1
      if (row.issuedBy.trim()) issuers.add(row.issuedBy.trim())
    }
    const certificationRollup = {
      total: certRows.length,
      active: certStats.active,
      expiringSoon: certStats.expiring_soon,
      expired: certStats.expired,
      issuers: Array.from(issuers).sort((a, b) => a.localeCompare(b)),
      recent: certRows.slice(0, 6).map((row) => ({
        id: row.id,
        certName: row.certName,
        issuedBy: row.issuedBy,
        issuedAt: row.issuedAt.toISOString(),
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        status: certificationStatus(row.expiresAt),
        productId: row.product.id,
        productName: row.product.name,
      })),
    }

    // Task 98: THE WAREHOUSE RAIL (public side) — the supplier's ACTIVE
    // ship-from locations. Inactive rows never advertise a place that
    // doesn't operate; the storefront's visibility contract again.
    const warehouseRows = await db.warehouseLocations.findMany({
      where: { supplierId: supplier.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    /* PUBLIC PROJECTION — this endpoint serves guests. The old code returned
       the raw supplierProfiles row, leaking KYC data (NID, trade license,
       TIN, bank details, rejection internals) AND reviewer emails/phones via
       supplierReviews.buyer. Only public storefront fields may leave here. */
    const publicData = {
      id: supplier.id,
      companyName: supplier.companyName,
      verificationStatus: supplier.verificationStatus,
      ratingAvg: supplier.ratingAvg,
      ratingCount: supplier.ratingCount,
      memberSince: supplier.createdAt,
      storeCustomization: supplier.storeCustomization,
      products: supplier.products,
      certificationRollup,
      warehouses: warehouseRows.map(shapeWarehouse),
      reviews: (supplier.supplierReviews || []).map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        // Display name only — never the reviewer's email or phone.
        buyerName:
          r.buyer?.buyerProfile?.businessName ||
          r.buyer?.buyerProfile?.fullName ||
          'Verified buyer',
      })),
      counts: supplier._count,
      // Kept as _count for the storefront page's existing consumption.
      _count: supplier._count,
    }

    return NextResponse.json({
      success: true,
      data: publicData
    })
  } catch (error) {
    console.error('Storefront GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      bannerUrl,
      logoUrl,
      theme,
      layout,
      font,
      customSections,
      showRatings,
      showContactInfo,
      showCategories
    } = body

    let supplier = await db.supplierProfiles.findFirst({
      where: { userId: auth.user.id }
    })

    // SECURITY + de-fake campaign: never fabricate a supplier profile (the old
    // code auto-created one with dummy KYC — 'Wholesale Supplier',
    // nid '0000000000', 'BRAC Bank'). Only real suppliers with a real profile
    // may customize a storefront; everyone else gets an honest 403.
    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier profile required. Only registered suppliers can customize a storefront.' },
        { status: 403 }
      )
    }

    const custom = await db.sellerStoreCustomizations.upsert({
      where: { supplierId: supplier.id },
      create: {
        supplierId: supplier.id,
        bannerUrl,
        logoUrl,
        theme: theme || 'default',
        layout: layout || 'grid',
        font: font || 'inter',
        customSections: typeof customSections === 'string' ? customSections : JSON.stringify(customSections || {}),
        showRatings: showRatings ?? true,
        showContactInfo: showContactInfo ?? true,
        showCategories: showCategories ?? true
      },
      update: {
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(theme !== undefined && { theme }),
        ...(layout !== undefined && { layout }),
        ...(font !== undefined && { font }),
        ...(customSections !== undefined && {
          customSections: typeof customSections === 'string' ? customSections : JSON.stringify(customSections)
        }),
        ...(showRatings !== undefined && { showRatings }),
        ...(showContactInfo !== undefined && { showContactInfo }),
        ...(showCategories !== undefined && { showCategories })
      }
    })

    return NextResponse.json({
      success: true,
      data: custom,
      message: 'Storefront updated successfully'
    })
  } catch (error) {
    console.error('Storefront PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
