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

    const tin = user.supplierProfile?.tradeLicenseNumber || ''
    const docs = (user.supplierProfile?.verificationDocuments || [])
      .filter((d) => d.documentType.toLowerCase().includes('tax') || d.documentType.toLowerCase().includes('tin'))
      .map((d) => ({
        id: d.id,
        name: d.documentType,
        type: 'TIN/VAT',
        date: d.uploadedAt.toISOString().slice(0, 10),
        size: d.fileSize || 'N/A',
      }))

    return NextResponse.json({
      success: true,
      data: {
        taxId: tin || 'Not Set',
        vatNumber: user.supplierProfile?.tinNumber || 'N/A',
        businessEntityType: 'Private Enterprise',
        taxJurisdiction: 'Bangladesh (NBR)',
        filingStatus: user.accountStatus === 'active' ? 'Active' : 'Pending',
        documents: docs,
        exemption: { status: 'Not Applied', hasCertificate: false },
        complianceAlerts: [],
      },
    })
  } catch (error) {
    console.error('Tax GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleTaxUpdate(request: NextRequest) {
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
            tradeLicenseNumber: body.taxId || undefined,
            tinNumber: body.vatNumber || undefined,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tax information updated successfully',
      data: body,
    })
  } catch (error) {
    console.error('Tax update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return handleTaxUpdate(request)
}

export async function PATCH(request: NextRequest) {
  return handleTaxUpdate(request)
}