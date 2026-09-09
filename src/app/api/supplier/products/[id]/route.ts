import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await db.products.findUnique({
      where: { id },
      include: {
        category: true,
        priceTiers: { orderBy: { minQty: 'asc' } },
        variants: true,
        images: { orderBy: { sortOrder: 'asc' } },
        supplier: {
          select: {
            id: true,
            companyName: true,
            ratingAvg: true
          }
        },
        _count: { select: { reviews: true, orderItems: true } }
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    console.error('Supplier product GET error:', error)
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
    const {
      name,
      description,
      categoryId,
      basePrice,
      unit,
      moq,
      stockQuantity,
      thumbnailUrl,
      isActive,
      priceTiers
    } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (basePrice !== undefined) updateData.basePrice = parseFloat(basePrice)
    if (unit !== undefined) updateData.unit = unit
    if (moq !== undefined) updateData.moq = parseInt(moq)
    if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity)
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    if (Array.isArray(priceTiers)) {
      await db.productPriceTiers.deleteMany({ where: { productId: id } })
      if (priceTiers.length > 0) {
        await db.productPriceTiers.createMany({
          data: priceTiers.map((t: any) => ({
            productId: id,
            minQty: parseInt(t.minQty) || 1,
            maxQty: t.maxQty ? parseInt(t.maxQty) : null,
            unitPrice: parseFloat(t.unitPrice || t.pricePerUnit || 0),
            pricePerUnit: parseFloat(t.unitPrice || t.pricePerUnit || 0)
          }))
        })
      }
    }

    const updated = await db.products.update({
      where: { id },
      data: updateData,
      include: {
        priceTiers: true,
        images: true,
        category: true
      }
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Product updated successfully'
    })
  } catch (error) {
    console.error('Supplier product PATCH error:', error)
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
    await db.products.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    })
  } catch (error) {
    console.error('Supplier product DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
