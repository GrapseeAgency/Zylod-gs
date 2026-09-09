import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { itemId } = await params
    const item = await db.wishlists.findFirst({
      where: { id: itemId, buyerId: auth.user.id },
      include: {
        product: {
          include: {
            supplier: { select: { id: true, companyName: true, verificationStatus: true, ratingAvg: true } },
            priceTiers: { orderBy: { minQty: 'asc' } },
            images: { take: 5 },
          }
        }
      }
    })
    if (!item) return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('WishlistItem GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { itemId } = await params
    const body = await request.json()
    const { note } = body
    const item = await db.wishlists.updateMany({
      where: { id: itemId, buyerId: auth.user.id },
      data: { note }
    })
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('WishlistItem PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { itemId } = await params
    await db.wishlists.deleteMany({ where: { id: itemId, buyerId: auth.user.id } })
    return NextResponse.json({ success: true, message: 'Removed from wishlist' })
  } catch (error) {
    console.error('WishlistItem DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
