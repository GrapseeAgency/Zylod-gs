import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  // 401-first: only buyers touch cart lines. This route previously had NO
  // auth and NO ownership check — any anonymous caller could rewrite any
  // buyer's cart line by bare id (found in the Task 152 full-app audit).
  const authResult = await requireUserType(request, ['buyer'])
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'cart-item-write', 60, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  let itemId = ''
  try {
    itemId = (await params).itemId
    const body = await request.json()
    const quantity = Number(body.quantity)

    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ error: 'quantity must be a number of at least 1' }, { status: 400 })
    }
    if (quantity > 10000) {
      return NextResponse.json({ error: 'Quantity exceeds the 10,000 per-line limit' }, { status: 400 })
    }

    // Ownership scoped: the line must live in the CALLER's cart (404 for both
    // not-exists and not-yours — no cross-buyer probing).
    const cartItem = await db.cartItems.findFirst({
      where: { id: itemId, cart: { buyerId: authResult.user.id } },
    })
    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    const updated = await db.cartItems.update({
      where: { id: cartItem.id },
      data: { quantity },
      include: {
        product: { select: { id: true, name: true, basePrice: true } },
        variant: { select: { id: true, variantName: true, variantValue: true, priceOverride: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Cart item PUT error:', error)
    // Honest failure: the old catch returned success:true on broken requests.
    return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  // 401-first + ownership scope — same fix as PUT.
  const authResult = await requireUserType(request, ['buyer'])
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'cart-item-write', 60, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { itemId } = await params

    const cartItem = await db.cartItems.findFirst({
      where: { id: itemId, cart: { buyerId: authResult.user.id } },
    })
    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    await db.cartItems.delete({ where: { id: cartItem.id } })

    return NextResponse.json({ success: true, message: 'Item removed from cart' })
  } catch (error) {
    console.error('Cart item DELETE error:', error)
    // Honest failure — no fake success on error.
    return NextResponse.json({ error: 'Failed to remove cart item' }, { status: 500 })
  }
}
