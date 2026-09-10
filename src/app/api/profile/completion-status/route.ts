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

    const user = await db.users.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let completionStatus: Record<string, unknown> = {
      userId,
      userType: user.userType,
      overallCompletionPct: 0,
      sections: [],
    }

    if (user.userType === 'buyer') {
      const profile = await db.buyerProfiles.findUnique({ where: { userId } })
      const addresses = await db.addresses.findMany({ where: { userId } })

      const sections = [
        {
          name: 'personal_info',
          label: 'Personal Information',
          completionPct: profile ? (profile.fullName ? 100 : 0) : 0,
          isComplete: !!profile?.fullName,
          fields: {
            fullName: !!profile?.fullName,
            businessName: !!profile?.businessName,
            businessType: !!profile?.businessType,
          },
        },
        {
          name: 'contact_verification',
          label: 'Contact Verification',
          completionPct: (user.isEmailVerified && user.isPhoneVerified) ? 100 : (user.isEmailVerified || user.isPhoneVerified ? 50 : 0),
          isComplete: user.isEmailVerified && user.isPhoneVerified,
          fields: {
            emailVerified: user.isEmailVerified,
            phoneVerified: user.isPhoneVerified,
          },
        },
        {
          name: 'delivery_address',
          label: 'Delivery Address',
          completionPct: addresses.length > 0 ? 100 : 0,
          isComplete: addresses.length > 0,
          fields: {
            hasDefaultAddress: addresses.some(a => a.isDefault),
            totalAddresses: addresses.length,
          },
        },
      ]

      const overallPct = sections.reduce((sum, s) => sum + s.completionPct, 0) / sections.length
      completionStatus.overallCompletionPct = Math.round(overallPct)
      completionStatus.sections = sections
    } else if (user.userType === 'supplier') {
      const profile = await db.supplierProfiles.findUnique({ where: { userId } })

      if (!profile) {
        return NextResponse.json({ success: true, data: completionStatus })
      }

      const sections = [
        {
          name: 'company_info',
          label: 'Company Information',
          completionPct: profile.companyName ? 100 : 0,
          isComplete: !!profile.companyName,
          fields: { companyName: !!profile.companyName },
        },
        {
          name: 'kyc_documents',
          label: 'KYC Documents',
          completionPct: (profile.nidFrontImageUrl && profile.tradeLicenseImageUrl) ? 100 : 0,
          isComplete: !!profile.nidFrontImageUrl && !!profile.tradeLicenseImageUrl,
          fields: {
            nidFront: !!profile.nidFrontImageUrl,
            nidBack: !!profile.nidBackImageUrl,
            tradeLicense: !!profile.tradeLicenseImageUrl,
          },
        },
        {
          name: 'bank_details',
          label: 'Bank Details',
          completionPct: (profile.bankAccountName && profile.bankAccountNumber) ? 100 : 0,
          isComplete: !!profile.bankAccountName && !!profile.bankAccountNumber,
          fields: {
            bankAccountName: !!profile.bankAccountName,
            bankAccountNumber: !!profile.bankAccountNumber,
            bankName: !!profile.bankName,
          },
        },
        {
          name: 'verification',
          label: 'Verification Status',
          completionPct: profile.verificationStatus === 'approved' ? 100 : (profile.verificationStatus === 'under_review' ? 50 : 0),
          isComplete: profile.verificationStatus === 'approved',
          fields: { verificationStatus: profile.verificationStatus },
        },
      ]

      const overallPct = sections.reduce((sum, s) => sum + s.completionPct, 0) / sections.length
      completionStatus.overallCompletionPct = Math.round(overallPct)
      completionStatus.sections = sections
    }

    return NextResponse.json({ success: true, data: completionStatus })
  } catch (error) {
    console.error('Profile completion status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
