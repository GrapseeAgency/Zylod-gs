import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter')
    const search = searchParams.get('search')

    let supplier = await db.supplierProfiles.findFirst({
      where: { userId: auth.user.id }
    })

    const supplierId = supplier ? supplier.id : auth.user.id

    const where: any = {
      OR: [
        { supplierId: supplierId },
        { supplierId: auth.user.id }
      ]
    }

    if (filter === 'low_stock') {
      where.stockQuantity = { gt: 0, lte: 20 }
    } else if (filter === 'out_of_stock') {
      where.stockQuantity = { lte: 0 }
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const products = await db.products.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        stockQuantity: true,
        unit: true,
        moq: true,
        thumbnailUrl: true,
        isActive: true,
        category: { select: { name: true } },
        updatedAt: true
      },
      orderBy: { stockQuantity: 'asc' }
    })

    const totalSkus = products.length
    const lowStockCount = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= 20).length
    const outOfStockCount = products.filter(p => p.stockQuantity <= 0).length
    const totalInventoryUnits = products.reduce((acc, p) => acc + p.stockQuantity, 0)

    return NextResponse.json({
      success: true,
      data: {
        items: products,
        summary: {
          totalSkus,
          lowStockCount,
          outOfStockCount,
          totalInventoryUnits
        }
      }
    })
  } catch (error) {
    console.error('Supplier inventory GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 })
    }

    const results = await Promise.all(
      updates.map(async (u: any) => {
        const { productId, newQuantity, delta } = u
        if (!productId) return null

        if (newQuantity !== undefined) {
          return db.products.update({
            where: { id: productId },
            data: { stockQuantity: Math.max(0, parseInt(newQuantity)) }
          })
        } else if (delta !== undefined) {
          return db.products.update({
            where: { id: productId },
            data: { stockQuantity: { increment: parseInt(delta) } }
          })
        }
        return null
      })
    )

    return NextResponse.json({
      success: true,
      message: 'Inventory updated successfully',
      data: results.filter(Boolean)
    })
  } catch (error) {
    console.error('Supplier inventory PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
