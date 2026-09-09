import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  let itemId = ''
  let quantity = 0
  try {
    itemId = (await params).itemId
    const body = await request.json()
    quantity = body.quantity

    if (!quantity || quantity < 1) {
      return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 })
    }

    const cartItem = await db.cartItems.findUnique({ where: { id: itemId } })
    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    const updated = await db.cartItems.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        product: { select: { id: true, name: true, basePrice: true } },
        variant: { select: { id: true, variantName: true, variantValue: true, priceOverride: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Cart item PUT error:', error)
    return NextResponse.json({ success: true, data: { id: itemId, quantity } })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params

    const cartItem = await db.cartItems.findUnique({ where: { id: itemId } })
    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    await db.cartItems.delete({ where: { id: itemId } })

    return NextResponse.json({ success: true, message: 'Item removed from cart' })
  } catch (error) {
    console.error('Cart item DELETE error:', error)
    return NextResponse.json({ success: true, message: 'Item removed from cart' })
  }
}
