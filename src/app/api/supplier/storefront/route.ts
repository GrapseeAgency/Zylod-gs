import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')

    let targetSupplierId = supplierId

    if (!targetSupplierId) {
      const auth = await authenticateRequest(request)
      if (auth.authenticated && auth.user) {
        const profile = await db.supplierProfiles.findFirst({
          where: { userId: auth.user.id }
        })
        targetSupplierId = profile ? profile.id : auth.user.id
      }
    }

    if (!targetSupplierId) {
      const firstSupplier = await db.supplierProfiles.findFirst({
        include: {
          storeCustomization: true,
          products: {
            where: { isActive: true },
            take: 12,
            include: { priceTiers: true }
          },
          supplierReviews: { take: 5, include: { buyer: { select: { email: true, phone: true } } } },
          _count: { select: { products: true, supplierReviews: true } }
        }
      })

      if (firstSupplier) {
        return NextResponse.json({ success: true, data: firstSupplier })
      }

      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
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
          where: { isActive: true },
          take: 24,
          include: { priceTiers: true }
        },
        supplierReviews: { take: 10, include: { buyer: { select: { email: true, phone: true } } } },
        _count: { select: { products: true, supplierReviews: true } }
      }
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: supplier
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

    if (!supplier) {
      supplier = await db.supplierProfiles.create({
        data: {
          userId: auth.user.id,
          companyName: 'Wholesale Supplier',
          nidNumber: '0000000000',
          nidFrontImageUrl: '',
          nidBackImageUrl: '',
          tradeLicenseNumber: '000000',
          tradeLicenseImageUrl: '',
          tinNumber: '000000',
          bankAccountName: 'Wholesale Supplier',
          bankAccountNumber: '00000000',
          bankName: 'BRAC Bank',
          branch: 'Main'
        }
      })
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
