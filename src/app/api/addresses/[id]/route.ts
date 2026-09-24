import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * REAL single-address API — ownership enforced against the session user.
 * PUT    /api/addresses/[id] → update (only your own address)
 * DELETE /api/addresses/[id] → delete (only your own address)
 */

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserType(request, ['buyer', 'supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const { id } = await params

    const existing = await db.addresses.findFirst({ where: { id, userId: auth.user.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const addressLine1 = str(body.address_line1) || str(body.addressLine1) || str(body.streetLine1)
    const city = str(body.city)
    const postalCode = str(body.postal_code) || str(body.postalCode)
    if (!addressLine1 || !city || !postalCode) {
      return NextResponse.json({ error: 'address_line1, city and postal_code are required' }, { status: 400 })
    }

    const isDefault = Boolean(body.is_default ?? body.isDefault)

    const address = await db.$transaction(async (tx) => {
      if (isDefault) {
        await tx.addresses.updateMany({ where: { userId: auth.user!.id, isDefault: true }, data: { isDefault: false } })
      }
      return tx.addresses.update({
        where: { id: existing.id },
        data: {
          label: str(body.label) || existing.label,
          companyName: str(body.company_name ?? body.companyName) || null,
          contactName: str(body.contact_name ?? body.contactName) || null,
          contactPhone: str(body.contact_phone ?? body.contactPhone) || null,
          addressLine1,
          addressLine2: str(body.address_line2 ?? body.addressLine2 ?? body.streetLine2) || null,
          city,
          district: str(body.district ?? body.area) || city,
          postalCode,
          country: str(body.country) || existing.country,
          ...(isDefault ? { isDefault: true } : {}),
        },
      })
    })

    return NextResponse.json({ success: true, data: address })
  } catch (error) {
    console.error('Address PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserType(request, ['buyer', 'supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const { id } = await params

    const existing = await db.addresses.findFirst({ where: { id, userId: auth.user.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    await db.addresses.delete({ where: { id: existing.id } })

    // Promote a remaining address to default if none is flagged
    const hasDefault = await db.addresses.findFirst({ where: { userId: auth.user.id, isDefault: true } })
    if (!hasDefault) {
      const remaining = await db.addresses.findFirst({
        where: { userId: auth.user.id },
        orderBy: { label: 'asc' },
      })
      if (remaining) {
        await db.addresses.update({ where: { id: remaining.id }, data: { isDefault: true } })
      }
    }

    return NextResponse.json({ success: true, data: { id: existing.id, deleted: true } })
  } catch (error) {
    console.error('Address DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
