import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const user = await db.users.findUnique({
      where: { id: auth.user.id },
      include: {
        buyerProfile: true,
        supplierProfile: true,
        _count: {
          select: {
            orders: true,
            reviews: true,
            quoteRequests: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isSupplier = user.userType === 'supplier'

    let profileCompletionPct = user.userType === 'buyer'
      ? (user.buyerProfile?.profileCompletionPct ?? 0)
      : isSupplier
        ? (user.supplierProfile?.verificationStatus === 'approved' ? 100 : 60)
        : 0

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        userType: user.userType,
        email: user.email,
        phone: user.phone,
        fullName: user.buyerProfile?.fullName || user.supplierProfile?.companyName || user.email?.split('@')[0] || null,
        avatarUrl: (user as any).avatarUrl || null,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        accountStatus: user.accountStatus,
        isProfileComplete: profileCompletionPct >= 100,
        profileCompletionPct,
        buyerProfile: user.buyerProfile
          ? {
              fullName: user.buyerProfile.fullName,
              businessName: user.buyerProfile.businessName,
              businessType: user.buyerProfile.businessType,
            }
          : null,
        supplierProfile: user.supplierProfile
          ? {
              companyName: user.supplierProfile.companyName,
              contactPersonName: user.supplierProfile.bankAccountName,
              verificationStatus: user.supplierProfile.verificationStatus,
              rejectionReason: user.supplierProfile.rejectionReason,
              slug: user.supplierProfile.companyName?.toLowerCase().replace(/\s+/g, '-') || 'supplier',
              ratingAvg: user.supplierProfile.ratingAvg,
              ratingCount: user.supplierProfile.ratingCount,
              tradeLicenseNumber: user.supplierProfile.tradeLicenseNumber,
            }
          : null,
        stats: {
          totalOrders: user._count.orders,
          totalReviews: user._count.reviews,
          totalQuoteRequests: user._count.quoteRequests,
        },
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error('Profile me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleProfileUpdate(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { fullName, email, phone, companyName, businessName, businessType, tradeLicenseNumber } = body

    const userUpdates: Record<string, unknown> = {}
    if (email) userUpdates.email = email
    if (phone) userUpdates.phone = phone

    if (Object.keys(userUpdates).length > 0) {
      await db.users.update({
        where: { id: auth.user.id },
        data: userUpdates,
      })
    }

    if (auth.user.userType === 'buyer') {
      await db.buyerProfiles.upsert({
        where: { userId: auth.user.id },
        create: {
          userId: auth.user.id,
          fullName: fullName || auth.user.email?.split('@')[0] || 'Buyer',
          businessName: businessName || fullName,
          businessType: businessType || 'wholesaler',
        },
        update: {
          fullName: fullName || undefined,
          businessName: businessName || undefined,
          businessType: businessType || undefined,
        },
      })
    }

    if (auth.user.userType === 'supplier') {
      const existing = await db.supplierProfiles.findUnique({ where: { userId: auth.user.id } })
      if (existing) {
        await db.supplierProfiles.update({
          where: { userId: auth.user.id },
          data: {
            companyName: companyName || fullName || undefined,
            tradeLicenseNumber: tradeLicenseNumber || undefined,
          },
        })
      }
    }

    const updated = await db.users.findUnique({
      where: { id: auth.user.id },
      include: { buyerProfile: true, supplierProfile: true },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Profile updated successfully',
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return handleProfileUpdate(request)
}

export async function PATCH(request: NextRequest) {
  return handleProfileUpdate(request)
}
