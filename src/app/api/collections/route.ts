import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const collections = await (db as any).collections.findMany({
      where: { buyerId: auth.user.id },
      include: {
        _count: { select: { items: true } },
        items: {
          take: 4,
          include: {
            product: { select: { thumbnailUrl: true, name: true } }
          },
          orderBy: { addedAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    return NextResponse.json({ success: true, data: collections })
  } catch (error) {
    console.error('Collections GET error:', error)
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
    const { name, description, privacy, productIds, coverColor, coverImageUrl } = body
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
    }
    const collection = await (db as any).collections.create({
      data: {
        buyerId: auth.user.id,
        name: name.trim(),
        description: description?.trim(),
        privacy: privacy || 'PRIVATE',
        coverColor,
        coverImageUrl,
        items: productIds?.length ? {
          create: productIds.map((productId: string) => ({ productId }))
        } : undefined
      },
      include: { _count: { select: { items: true } } }
    })
    return NextResponse.json({ success: true, data: collection, message: 'Collection created' }, { status: 201 })
  } catch (error) {
    console.error('Collections POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
