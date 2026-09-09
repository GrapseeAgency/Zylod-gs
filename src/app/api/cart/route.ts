import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, requireUserType } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Require authentication - only buyers can view cart
    const authResult = await requireUserType(request, ['buyer'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

    const buyerId = authResult.user.id

    // Find or create cart
    let cart = await db.carts.findFirst({
      where: { buyerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
                supplier: { select: { id: true, companyName: true } },
              },
            },
            variant: true,
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    })

    if (!cart) {
      cart = await db.carts.create({
        data: { buyerId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: { take: 1 },
                  supplier: { select: { id: true, companyName: true } },
                },
              },
              variant: true,
            },
          },
        },
      })
    }

    // Group items by supplier
    const groupedBySupplier = cart.items.reduce((groups, item) => {
      const supplierId = item.supplierId
      if (!groups[supplierId]) {
        groups[supplierId] = {
          supplierId,
          supplierName: item.product.supplier?.companyName || 'Unknown',
          items: [],
          subtotal: 0,
        }
      }
      groups[supplierId].items.push(item)
      groups[supplierId].subtotal += item.quantity * (item.variant?.priceOverride || item.product.basePrice)
      return groups
    }, {} as Record<string, { supplierId: string; supplierName: string; items: typeof cart.items; subtotal: number }>)

    const totalAmount = Object.values(groupedBySupplier).reduce((sum, g) => sum + g.subtotal, 0)

    return NextResponse.json({
      success: true,
      data: {
        cartId: cart.id,
        totalItems: cart.items.length,
        totalAmount,
        suppliers: Object.values(groupedBySupplier),
      },
    })
  } catch (error) {
    console.error('Cart GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication - only buyers can add to cart
    const authResult = await requireUserType(request, ['buyer'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

    const buyerId = authResult.user.id
    const body = await request.json()
    const { productId, variantId, quantity, supplierId } = body

    if (!productId || !quantity || !supplierId) {
      return NextResponse.json({ error: 'productId, quantity, and supplierId are required' }, { status: 400 })
    }

    // Validate quantity is positive integer
    const safeQuantity = Math.max(1, Math.min(10000, Math.floor(Number(quantity))))
    if (isNaN(safeQuantity)) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    }

    // Verify product exists and is active
    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, isApproved: true, stockQuantity: true, moq: true },
    })

    if (!product || !product.isActive || !product.isApproved) {
      return NextResponse.json({ error: 'Product not available' }, { status: 404 })
    }

    // Check stock
    if (safeQuantity > product.stockQuantity) {
      return NextResponse.json({ error: 'Quantity exceeds available stock', stockAvailable: product.stockQuantity }, { status: 400 })
    }

    // Check MOQ
    if (safeQuantity < product.moq) {
      return NextResponse.json({ error: `Minimum order quantity is ${product.moq}`, moq: product.moq }, { status: 400 })
    }

    // Find or create cart
    let cart = await db.carts.findFirst({ where: { buyerId } })
    if (!cart) {
      cart = await db.carts.create({ data: { buyerId } })
    }

    // Check if item already exists in cart
    const existingItem = await db.cartItems.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
      },
    })

    if (existingItem) {
      // Update quantity
      const updated = await db.cartItems.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + safeQuantity },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    // Add new item
    const cartItem = await db.cartItems.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        quantity: safeQuantity,
        supplierId,
      },
    })

    return NextResponse.json({ success: true, data: cartItem }, { status: 201 })
  } catch (error) {
    console.error('Cart POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
