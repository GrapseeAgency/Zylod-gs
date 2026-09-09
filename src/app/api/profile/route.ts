import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const user = await db.users.findUnique({
      where: { id: userId },
      include: {
        buyerProfile: true,
        supplierProfile: true,
        addresses: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        userType: user.userType,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        createdAt: user.createdAt,
        buyerProfile: user.buyerProfile,
        supplierProfile: user.supplierProfile,
        addresses: user.addresses,
      },
    })
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const body = await request.json()
    const updateData = body

    const user = await db.users.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user fields
    const userUpdate: Record<string, unknown> = {}
    if (updateData.email) userUpdate.email = updateData.email
    if (updateData.phone) userUpdate.phone = updateData.phone

    if (Object.keys(userUpdate).length > 0) {
      await db.users.update({ where: { id: userId }, data: userUpdate })
    }

    // Update buyer profile if applicable
    if (user.userType === 'buyer' && updateData.buyerProfile) {
      const bp = updateData.buyerProfile as Record<string, unknown>
      const bpUpdate: Record<string, unknown> = {}
      if (bp.fullName) bpUpdate.fullName = bp.fullName
      if (bp.businessName) bpUpdate.businessName = bp.businessName
      if (bp.businessType) bpUpdate.businessType = bp.businessType

      // Calculate profile completion
      const totalFields = ['fullName', 'businessName', 'businessType']
      const filledFields = totalFields.filter(f => bpUpdate[f] || bp[f])
      bpUpdate.profileCompletionPct = Math.round((filledFields.length / totalFields.length) * 100)
      bpUpdate.isProfileComplete = filledFields.length === totalFields.length

      if (Object.keys(bpUpdate).length > 0) {
        await db.buyerProfiles.update({ where: { userId }, data: bpUpdate })
      }
    }

    // Update supplier profile if applicable
    if (user.userType === 'supplier' && updateData.supplierProfile) {
      const sp = updateData.supplierProfile as Record<string, unknown>
      const spUpdate: Record<string, unknown> = {}
      if (sp.companyName) spUpdate.companyName = sp.companyName
      if (sp.bankAccountName) spUpdate.bankAccountName = sp.bankAccountName
      if (sp.bankAccountNumber) spUpdate.bankAccountNumber = sp.bankAccountNumber
      if (sp.bankName) spUpdate.bankName = sp.bankName
      if (sp.branch) spUpdate.branch = sp.branch

      if (Object.keys(spUpdate).length > 0) {
        await db.supplierProfiles.update({ where: { userId }, data: spUpdate })
      }
    }

    // Fetch updated user
    const updatedUser = await db.users.findUnique({
      where: { id: userId },
      include: { buyerProfile: true, supplierProfile: true, addresses: true },
    })

    return NextResponse.json({ success: true, data: updatedUser })
  } catch (error) {
    console.error('Profile PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
