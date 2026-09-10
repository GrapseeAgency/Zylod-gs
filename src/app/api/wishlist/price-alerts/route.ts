import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const alerts = await (db as any).wishlistPriceAlerts.findMany({
      where: { buyerId: auth.user.id },
      include: {
        product: {
          select: {
            id: true, name: true, basePrice: true, currency: true, unit: true, thumbnailUrl: true,
            supplier: { select: { companyName: true } }
          }
        }
      }
    })
    return NextResponse.json({ success: true, data: alerts })
  } catch (error) {
    console.error('PriceAlerts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { productId, targetPrice, dropPercent } = body
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
    const alert = await (db as any).wishlistPriceAlerts.upsert({
      where: { buyerId_productId: { buyerId: auth.user.id, productId } },
      create: { buyerId: auth.user.id, productId, targetPrice, dropPercent, isActive: true },
      update: { targetPrice, dropPercent, isActive: true }
    })
    return NextResponse.json({ success: true, data: alert })
  } catch (error) {
    console.error('PriceAlerts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
