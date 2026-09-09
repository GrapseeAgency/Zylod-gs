import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(
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
    const { productId } = body
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
    const collection = await (db as any).collections.findFirst({ where: { id, userId: auth.user.id } })
    if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    const item = await (db as any).collectionItems.upsert({
      where: { collectionId_productId: { collectionId: id, productId } },
      create: { collectionId: id, productId },
      update: {},
    })
    return NextResponse.json({ success: true, data: item, message: 'Product added to collection' })
  } catch (error) {
    console.error('CollectionItems POST error:', error)
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
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })
    const collection = await (db as any).collections.findFirst({ where: { id, userId: auth.user.id } })
    if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    await (db as any).collectionItems.deleteMany({ where: { collectionId: id, productId } })
    return NextResponse.json({ success: true, message: 'Product removed from collection' })
  } catch (error) {
    console.error('CollectionItems DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
