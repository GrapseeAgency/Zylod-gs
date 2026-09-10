import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const address = await db.addresses.findUnique({ where: { id } })
    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    // If setting as default, unset existing default
    if (body.isDefault) {
      await db.addresses.updateMany({
        where: { userId: address.userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const updateData: Record<string, unknown> = {}
    if (body.label) updateData.label = body.label
    if (body.addressLine1) updateData.addressLine1 = body.addressLine1
    if (body.addressLine2) updateData.addressLine2 = body.addressLine2
    if (body.city) updateData.city = body.city
    if (body.district) updateData.district = body.district
    if (body.postalCode) updateData.postalCode = body.postalCode
    if (body.country) updateData.country = body.country
    if (body.lat) updateData.lat = body.lat
    if (body.lng) updateData.lng = body.lng
    if (body.isDefault) updateData.isDefault = body.isDefault

    const updated = await db.addresses.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Address PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const address = await db.addresses.findUnique({ where: { id } })
    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    await db.addresses.delete({ where: { id } })

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const remaining = await db.addresses.findFirst({ where: { userId: address.userId } })
      if (remaining) {
        await db.addresses.update({ where: { id: remaining.id }, data: { isDefault: true } })
      }
    }

    return NextResponse.json({ success: true, message: 'Address deleted' })
  } catch (error) {
    console.error('Address DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
