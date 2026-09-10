import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { items } = body // [{ productId, quantity }]
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 })
    }
    const results = await Promise.all(
      items.map(async ({ productId, quantity }: { productId: string; quantity: number }) => {
        const product = await db.products.findUnique({
          where: { id: productId },
          select: { moq: true, basePrice: true, currency: true }
        })
        if (!product) return { productId, error: 'Product not found' }
        const qty = Math.max(quantity, product.moq)
        return (db as any).cartItems.upsert({
          where: { cartId_productId: { cartId: auth.user!.id, productId } },
          create: { cartId: auth.user!.id, productId, quantity: qty },
          update: { quantity: qty }
        })
      })
    )
    return NextResponse.json({ success: true, data: results, message: `${items.length} items added to cart` })
  } catch (error) {
    console.error('CartBulk POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
