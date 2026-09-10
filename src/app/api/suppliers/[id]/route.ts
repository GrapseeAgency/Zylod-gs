import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/suppliers/[id] — supplier profile detail with stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supplier = await db.supplierProfiles.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, phone: true, accountStatus: true, createdAt: true } },
        warehouseAddress: true,
        warehouseLocations: { select: { id: true, city: true, district: true, addressLine1: true } },
        supplierReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            buyer: {
              select: {
                id: true,
                buyerProfile: { select: { fullName: true, businessName: true } },
              },
            },
          },
        },
        _count: {
          select: {
            products: { where: { isActive: true, isApproved: true } },
            supplierReviews: true,
            supportTickets: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: supplier.id,
        userId: supplier.userId,
        companyName: supplier.companyName,
        tradeLicenseNumber: supplier.tradeLicenseNumber,
        verificationStatus: supplier.verificationStatus,
        rejectionReason: supplier.rejectionReason,
        ratingAvg: supplier.ratingAvg,
        ratingCount: supplier._count.supplierReviews,
        productCount: supplier._count.products,
        warehouseCity: supplier.warehouseAddress?.city || '',
        warehouseDistrict: supplier.warehouseAddress?.district || '',
        additionalLocations: supplier.warehouseLocations,
        createdAt: supplier.createdAt,
        accountStatus: supplier.user.accountStatus,
        memberSince: supplier.user.createdAt,
        reviews: supplier.supplierReviews.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          buyer: {
            id: r.buyer.id,
            name: r.buyer.buyerProfile?.fullName || 'Anonymous',
            businessName: r.buyer.buyerProfile?.businessName || null,
          },
        })),
      },
    })
  } catch (error) {
    console.error('Supplier detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
