import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * PUT    /api/profile/addresses/[id] — update ONE of the signed-in user's own addresses.
 * DELETE /api/profile/addresses/[id] — delete ONE of the signed-in user's own addresses.
 *
 * SECURITY (Task 52-c audit fix): this route previously had NO authentication
 * at all — anyone who learned an address id could update or delete any other
 * user's address. Both verbs now authenticate first (401), and a foreign or
 * unknown id returns the SAME 404 so address ids cannot be probed.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-addresses-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const address = await db.addresses.findUnique({ where: { id } })
    if (!address || address.userId !== auth.user.id) {
      // Same 404 for unknown AND foreign addresses — no existence leak.
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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No editable address fields were provided' }, { status: 400 })
    }

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
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-addresses-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const address = await db.addresses.findUnique({ where: { id } })
    if (!address || address.userId !== auth.user.id) {
      // Same 404 for unknown AND foreign addresses — no existence leak.
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
