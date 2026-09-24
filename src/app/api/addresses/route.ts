import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * REAL addresses API — no mock data, no fallbacks.
 * GET  /api/addresses  → authenticated user's addresses
 * POST /api/addresses  → create address for authenticated user
 * Ownership is enforced server-side: userId always comes from the session.
 */

type AnyRecord = Record<string, unknown>

// Client pages were written against a snake_case contract; expose both shapes
// so every consumer reads real values (no silent undefined fallbacks).
function serializeAddress(a: AnyRecord) {
  return {
    id: a.id,
    userId: a.userId,
    label: a.label,
    companyName: a.companyName ?? null,
    contactName: a.contactName ?? null,
    contactPhone: a.contactPhone ?? null,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2 ?? null,
    city: a.city,
    district: a.district,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
    // snake_case aliases (legacy client contract)
    company_name: a.companyName ?? null,
    contact_name: a.contactName ?? null,
    contact_phone: a.contactPhone ?? null,
    address_line1: a.addressLine1,
    address_line2: a.addressLine2 ?? null,
    postal_code: a.postalCode,
    is_default: a.isDefault,
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['buyer', 'supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const addresses = await db.addresses.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
    })

    return NextResponse.json({ success: true, data: addresses.map(serializeAddress) })
  } catch (error) {
    console.error('Addresses GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'addresses-post', 20, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['buyer', 'supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const label = str(body.label) || str(body.name)
    const addressLine1 = str(body.address_line1) || str(body.addressLine1) || str(body.streetLine1)
    const addressLine2 = str(body.address_line2) || str(body.addressLine2) || str(body.streetLine2)
    const city = str(body.city)
    const district = str(body.district) || str(body.area)
    const postalCode = str(body.postal_code) || str(body.postalCode)
    const country = str(body.country) || 'Bangladesh'
    const companyName = str(body.company_name) || str(body.companyName)
    const contactName = str(body.contact_name) || str(body.contactName)
    const contactPhone = str(body.contact_phone) || str(body.contactPhone)
    const isDefault = Boolean(body.is_default ?? body.isDefault)

    const missing: string[] = []
    if (!label) missing.push('label')
    if (!addressLine1) missing.push('address_line1')
    if (!city) missing.push('city')
    if (!postalCode) missing.push('postal_code')
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required field(s): ${missing.join(', ')}` }, { status: 400 })
    }

    const existingCount = await db.addresses.count({ where: { userId } })
    const makeDefault = isDefault || existingCount === 0

    const address = await db.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.addresses.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
      }
      return tx.addresses.create({
        data: {
          userId,
          label,
          companyName: companyName || null,
          contactName: contactName || null,
          contactPhone: contactPhone || null,
          addressLine1,
          addressLine2: addressLine2 || null,
          city,
          district: district || city,
          postalCode,
          country,
          isDefault: makeDefault,
        },
      })
    })

    return NextResponse.json({ success: true, data: serializeAddress(address) }, { status: 201 })
  } catch (error) {
    console.error('Addresses POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
