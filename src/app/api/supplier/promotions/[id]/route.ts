import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const promo = await db.sellerPromotions.findUnique({
      where: { id }
    })
    if (!promo) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: promo })
  } catch (error) {
    console.error('Promotion GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const { status, name, discountValue, endDate } = body

    const updated = await db.sellerPromotions.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(name && { name: name.trim() }),
        ...(discountValue !== undefined && { discountValue: parseFloat(discountValue) }),
        ...(endDate && { endDate: new Date(endDate) })
      }
    })
    return NextResponse.json({ success: true, data: updated, message: 'Promotion updated' })
  } catch (error) {
    console.error('Promotion PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { id } = await params
    await db.sellerPromotions.delete({
      where: { id }
    })
    return NextResponse.json({ success: true, message: 'Promotion deleted' })
  } catch (error) {
    console.error('Promotion DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}