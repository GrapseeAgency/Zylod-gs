import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const user = await db.users.findUnique({
      where: { id: userId },
      include: {
        buyerProfile: true,
        supplierProfile: {
          include: {
            verificationDocuments: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isSupplier = user.userType === 'supplier'
    const docs = user.supplierProfile?.verificationDocuments || []

    const profileData = {
      legalEntityName: isSupplier ? user.supplierProfile?.companyName || '' : user.buyerProfile?.businessName || '',
      tradeLicenseNumber: isSupplier ? user.supplierProfile?.tradeLicenseNumber || '' : '',
      industryCategory: isSupplier ? 'Wholesale & Manufacturing' : user.buyerProfile?.businessType || 'Wholesale',
      streetAddress: 'Tejgaon Industrial Area',
      city: 'Dhaka',
      postalCode: '1208',
      documents: docs.map((doc) => ({
        id: doc.id,
        name: doc.documentType,
        size: doc.fileSize || 'N/A',
        type: 'pdf',
        status: doc.status,
        url: doc.fileUrl,
      })),
    }

    return NextResponse.json({ success: true, data: profileData })
  } catch (error) {
    console.error('Business GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleBusinessUpdate(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const body = await request.json()

    if (auth.user.userType === 'supplier') {
      const existing = await db.supplierProfiles.findUnique({ where: { userId } })
      if (existing) {
        await db.supplierProfiles.update({
          where: { userId },
          data: {
            companyName: body.legalEntityName || undefined,
            tradeLicenseNumber: body.tradeLicenseNumber || undefined,
          },
        })
      }
    } else {
      await db.buyerProfiles.upsert({
        where: { userId },
        create: {
          userId,
          fullName: auth.user.email || 'Buyer',
          businessName: body.legalEntityName,
          businessType: body.industryCategory || 'wholesaler',
        },
        update: {
          businessName: body.legalEntityName || undefined,
          businessType: body.industryCategory || undefined,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Business profile updated successfully',
      data: body,
    })
  } catch (error) {
    console.error('Business update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return handleBusinessUpdate(request)
}

export async function PATCH(request: NextRequest) {
  return handleBusinessUpdate(request)
}