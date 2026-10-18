import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET  /api/profile/tax — real tax identifiers stored on the caller's
 *      supplierProfiles row + the tax-relevant verification documents they
 *      actually uploaded. Fields with no backend storage are reported as
 *      null/empty instead of fabricated values.
 * PUT/PATCH /api/profile/tax — persist { taxId, vatNumber } for suppliers
 *      WITH a profile. Buyers have no tax storage (no schema backing without
 *      a migration) so the write honestly reports 501 instead of echoing the
 *      body as fake success. Every change is audit-logged.
 */

const taxWriteSchema = z
  .object({
    taxId: z.string().trim().min(1).max(50).optional(),
    vatNumber: z.string().trim().min(1).max(50).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one of taxId or vatNumber is required',
  })

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-tax', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

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
        // No business-entity-type field exists anywhere in the schema — the
        // old hardcoded 'Private Enterprise' was fabricated. Honest null.
        businessEntityType: null,
        taxJurisdiction: 'Bangladesh (NBR)',
        filingStatus: user.accountStatus === 'active' ? 'Active' : 'Pending',
        documents: docs,
        // Factual absence: no exemption certificate is on file for anyone.
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

  const rl = checkRateLimit(request, 'profile-tax', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = taxWriteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }

    // Honest limitation: only supplierProfiles has tax storage. Buyer accounts
    // cannot persist tax data, so instead of the old fake success we report
    // the truth.
    if (auth.user.userType !== 'supplier') {
      return NextResponse.json(
        { error: 'Not implemented yet — requires backend support' },
        { status: 501 }
      )
    }

    const existing = await db.supplierProfiles.findUnique({ where: { userId: auth.user.id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'A supplier profile is required before tax information can be saved' },
        { status: 403 }
      )
    }

    const updated = await db.supplierProfiles.update({
      where: { userId: auth.user.id },
      data: {
        tradeLicenseNumber: parsed.data.taxId || undefined,
        tinNumber: parsed.data.vatNumber || undefined,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'profile_tax_updated',
        entityType: 'supplierProfiles',
        entityId: updated.id,
        metadata: JSON.stringify({
          keys: Object.keys(parsed.data),
          before: { tradeLicenseNumber: existing.tradeLicenseNumber, tinNumber: existing.tinNumber },
          after: { tradeLicenseNumber: updated.tradeLicenseNumber, tinNumber: updated.tinNumber },
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Tax information updated',
      data: {
        taxId: updated.tradeLicenseNumber,
        vatNumber: updated.tinNumber,
      },
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
