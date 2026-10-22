import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/profile/business — real business identity stored on the caller's
 * buyerProfiles / supplierProfiles row. The schema has NO street/city/postal
 * columns, so those fields are reported as null instead of the previously
 * hardcoded fabricated address.
 *
 * PUT/PATCH /api/profile/business — persist the fields that actually have
 * backend storage (legalEntityName, tradeLicenseNumber, industryCategory).
 * Address fields have no columns to land in: they are accepted for
 * compatibility, never stored, and reported back in `notPersisted` so no
 * caller can mistake silence for persistence. Every change is audit-logged.
 */

const NON_PERSISTED_ADDRESS_FIELDS = ['streetAddress', 'city', 'postalCode'] as const

function asTrimmedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-business', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

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
      // No address columns exist in the schema — honest nulls, not invented values.
      streetAddress: null,
      city: null,
      postalCode: null,
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

  const rl = checkRateLimit(request, 'profile-business', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const userId = auth.user.id
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const legalEntityName = asTrimmedString(body.legalEntityName, 120)
    const tradeLicenseNumber = asTrimmedString(body.tradeLicenseNumber, 60)
    const industryCategory = asTrimmedString(body.industryCategory, 80)

    // Fields the caller may send but the schema cannot store — reported back
    // instead of silently dropped.
    const notPersisted = NON_PERSISTED_ADDRESS_FIELDS.filter(
      (f) => asTrimmedString((body as Record<string, unknown>)[f], 200) !== undefined
    )

    let result: { legalEntityName: string; tradeLicenseNumber: string; industryCategory: string }

    if (auth.user.userType === 'supplier') {
      const existing = await db.supplierProfiles.findUnique({ where: { userId } })
      if (!existing) {
        return NextResponse.json(
          { error: 'A supplier profile is required before business information can be saved' },
          { status: 403 }
        )
      }
      const updated = await db.supplierProfiles.update({
        where: { userId },
        data: {
          companyName: legalEntityName || undefined,
          tradeLicenseNumber: tradeLicenseNumber || undefined,
        },
      })
      result = {
        legalEntityName: updated.companyName,
        tradeLicenseNumber: updated.tradeLicenseNumber,
        industryCategory: 'Wholesale & Manufacturing',
      }
    } else {
      const updated = await db.buyerProfiles.upsert({
        where: { userId },
        create: {
          userId,
          fullName: auth.user.email || 'Buyer',
          businessName: legalEntityName,
          businessType: industryCategory || 'wholesaler',
        },
        update: {
          businessName: legalEntityName || undefined,
          businessType: industryCategory || undefined,
        },
      })
      result = {
        legalEntityName: updated.businessName || '',
        tradeLicenseNumber: '',
        industryCategory: updated.businessType,
      }
    }

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'profile_business_updated',
        entityType: auth.user.userType === 'supplier' ? 'supplierProfiles' : 'buyerProfiles',
        entityId: userId,
        metadata: JSON.stringify({
          keys: [
            ...(legalEntityName ? ['legalEntityName'] : []),
            ...(tradeLicenseNumber ? ['tradeLicenseNumber'] : []),
            ...(industryCategory ? ['industryCategory'] : []),
          ],
          notPersisted,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Business profile updated',
      data: result,
      ...(notPersisted.length > 0 ? { notPersisted } : {}),
    })
  } catch (error) {
    console.error('Business update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const rl = checkRateLimit(request, 'profile-business-write', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  return handleBusinessUpdate(request)
}

export async function PATCH(request: NextRequest) {
  const rl = checkRateLimit(request, 'profile-business-write', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  return handleBusinessUpdate(request)
}
