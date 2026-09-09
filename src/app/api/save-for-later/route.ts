import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id

    const items = await db.savedForLater.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            currency: true,
            unit: true,
            moq: true,
            stockQuantity: true,
            ratingAvg: true,
            reviewCount: true,
            thumbnailUrl: true,
            isActive: true,
            supplier: {
              select: {
                companyName: true,
                
                verificationStatus: true,
              },
            },
            priceTiers: {
              orderBy: { minQty: 'asc' },
              take: 3,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: items,
      meta: { count: items.length },
    })
  } catch (error) {
    console.error('SaveForLater GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const body = await request.json()
    const { productId, variantId, quantity = 1, movedFrom = 'cart' } = body

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const item = await db.savedForLater.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, variantId, quantity, movedFrom },
      update: { quantity, movedFrom },
    })

    return NextResponse.json({
      success: true,
      data: item,
      message: 'Item saved for later',
    })
  } catch (error) {
    console.error('SaveForLater POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    await db.savedForLater.deleteMany({ where: { userId, productId } })

    return NextResponse.json({ success: true, message: 'Item removed from saved for later' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
