import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/suppliers/storefront — fetch supplier's storefront customization.
 * Requires supplier or admin auth.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id

    const supplier = await db.supplierProfiles.findUnique({
      where: { userId },
      select: {
        id: true, companyName: true, verificationStatus: true,
        ratingAvg: true, ratingCount: true,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier profile not found' }, { status: 404 })
    }

    let customization = await db.sellerStoreCustomizations.findUnique({
      where: { supplierId: supplier.id },
    })

    // Auto-create if missing
    if (!customization) {
      customization = await db.sellerStoreCustomizations.create({
        data: { supplierId: supplier.id },
      })
    }

    // Product counts
    const [totalProducts, activeProducts] = await Promise.all([
      db.products.count({ where: { supplierId: supplier.id } }),
      db.products.count({ where: { supplierId: supplier.id, isActive: true, isApproved: true } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        supplier: {
          id: supplier.id,
          companyName: supplier.companyName,
          ratingAvg: supplier.ratingAvg,
          ratingCount: supplier.ratingCount,
          verificationStatus: supplier.verificationStatus,
        },
        customization: {
          id: customization.id,
          bannerUrl: customization.bannerUrl,
          logoUrl: customization.logoUrl,
          theme: customization.theme,
          layout: customization.layout,
          font: customization.font,
          customSections: customization.customSections,
          showRatings: customization.showRatings,
          showContactInfo: customization.showContactInfo,
          showCategories: customization.showCategories,
          showRecentOrders: customization.showRecentOrders,
        },
        stats: { totalProducts, activeProducts },
      },
    })
  } catch (error) {
    console.error('Storefront GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/suppliers/storefront — update storefront customization.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const supplier = await db.supplierProfiles.findUnique({
      where: { userId: auth.user.id },
      select: { id: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier profile not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.bannerUrl !== undefined) updateData.bannerUrl = body.bannerUrl
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl
    if (body.theme !== undefined) updateData.theme = body.theme
    if (body.layout !== undefined) updateData.layout = body.layout
    if (body.font !== undefined) updateData.font = body.font
    if (body.customSections !== undefined) updateData.customSections = body.customSections
    if (body.showRatings !== undefined) updateData.showRatings = body.showRatings
    if (body.showContactInfo !== undefined) updateData.showContactInfo = body.showContactInfo
    if (body.showCategories !== undefined) updateData.showCategories = body.showCategories
    if (body.showRecentOrders !== undefined) updateData.showRecentOrders = body.showRecentOrders

    const customization = await db.sellerStoreCustomizations.upsert({
      where: { supplierId: supplier.id },
      create: {
        supplierId: supplier.id,
        bannerUrl: (body.bannerUrl as string) || null,
        logoUrl: (body.logoUrl as string) || null,
        theme: (body.theme as string) || 'default',
        layout: (body.layout as string) || 'grid',
        font: (body.font as string) || 'inter',
        showRatings: body.showRatings !== undefined ? (body.showRatings as boolean) : true,
        showContactInfo: body.showContactInfo !== undefined ? (body.showContactInfo as boolean) : true,
        showCategories: body.showCategories !== undefined ? (body.showCategories as boolean) : true,
        showRecentOrders: body.showRecentOrders !== undefined ? (body.showRecentOrders as boolean) : false,
      },
      update: updateData,
    })

    return NextResponse.json({ success: true, data: customization })
  } catch (error) {
    console.error('Storefront PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
