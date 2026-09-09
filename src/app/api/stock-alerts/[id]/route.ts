import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params

    const alert = await db.stockAlerts.findFirst({ where: { id, userId: auth.user.id } })
    if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })

    const product = await db.products.findUnique({
      where: { id: alert.productId },
      select: { id: true, name: true, thumbnailUrl: true, basePrice: true, stockQuantity: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...alert,
        currentPrice: product?.basePrice ?? 0,
        stockQuantity: product?.stockQuantity ?? 0,
        inStock: (product?.stockQuantity ?? 0) > 0,
        productImage: alert.productImage ?? product?.thumbnailUrl,
      },
    })
  } catch (error) {
    console.error('Stock alert GET [id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params

    const existing = await db.stockAlerts.findFirst({ where: { id, userId: auth.user.id } })
    if (!existing) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })

    await db.stockAlerts.update({ where: { id }, data: { status: 'cancelled' } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Stock alert DELETE [id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
