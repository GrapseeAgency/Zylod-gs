import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { id } = await params
    const collection = await (db as any).collections.findFirst({
      where: { id, userId: auth.user.id },
      include: {
        _count: { select: { items: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, slug: true, basePrice: true, currency: true,
                unit: true, moq: true, thumbnailUrl: true, stockQuantity: true,
                supplier: { select: { companyName: true, verificationStatus: true } },
              }
            }
          },
          orderBy: { addedAt: 'desc' }
        }
      }
    })
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: collection })
  } catch (error) {
    console.error('Collection GET error:', error)
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
    const { name, description, privacy, coverColor, coverImageUrl } = body
    const collection = await (db as any).collections.updateMany({
      where: { id, userId: auth.user.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(privacy && { privacy }),
        ...(coverColor !== undefined && { coverColor }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
      }
    })
    return NextResponse.json({ success: true, data: collection, message: 'Collection updated' })
  } catch (error) {
    console.error('Collection PATCH error:', error)
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
    await (db as any).collections.deleteMany({ where: { id, userId: auth.user.id } })
    return NextResponse.json({ success: true, message: 'Collection deleted' })
  } catch (error) {
    console.error('Collection DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
