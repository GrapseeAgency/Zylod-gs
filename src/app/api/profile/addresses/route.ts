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

    const addresses = await db.addresses.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    })

    return NextResponse.json({ success: true, data: addresses })
  } catch (error) {
    console.error('Addresses GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const body = await request.json()
    const { label, addressLine1, addressLine2, city, district, postalCode, country, lat, lng, isDefault } = body

    if (!label || !addressLine1 || !city || !district || !postalCode) {
      return NextResponse.json({ error: 'label, addressLine1, city, district, and postalCode are required' }, { status: 400 })
    }

    // If this is the default address, unset any existing default
    if (isDefault) {
      await db.addresses.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const address = await db.addresses.create({
      data: {
        userId,
        label,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        district,
        postalCode,
        country: country || 'Bangladesh',
        lat: lat || null,
        lng: lng || null,
        isDefault: isDefault || false,
      },
    })

    // If this is first address, auto-set as default
    const addressCount = await db.addresses.count({ where: { userId } })
    if (addressCount === 1) {
      await db.addresses.update({
        where: { id: address.id },
        data: { isDefault: true },
      })
    }

    return NextResponse.json({ success: true, data: address }, { status: 201 })
  } catch (error) {
    console.error('Address POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
