import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, requireUserType } from '@/lib/auth'
import { resolveUnitPrice, PricingError } from '@/lib/wholesale-pricing'
import { roundQty } from '@/lib/product-contract'

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
                priceTiers: { orderBy: { minQty: 'asc' } },
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
                  priceTiers: { orderBy: { minQty: 'asc' } },
                  supplier: { select: { id: true, companyName: true } },
                },
              },
              variant: true,
            },
          },
        },
      })
    }

    // ─── SERVER TRUTH PRICING ───
    // Every line is priced by the canonical wholesale pricing rule
    // (variant priceOverride → matching tier → basePrice). The buyer never
    // sets the unit price — client-cached prices are ignored entirely.
    // Lines whose product was hidden/unapproved/deleted are flagged so the
    // buyer sees an honest per-line problem instead of a stale price.
    type CartLine = (typeof cart.items)[number]
    type PricedLine = CartLine & {
      unitPrice: number | null
      totalPrice: number | null
      priceSource?: string
      pricingIssue: string | null
    }
    const pricedItems: PricedLine[] = []
    for (const item of cart.items) {
      if (!item.product.isActive || !item.product.isApproved) {
        pricedItems.push({
          ...item,
          unitPrice: null,
          totalPrice: null,
          pricingIssue: 'Product is no longer available',
        })
        continue
      }
      try {
        const resolved = await resolveUnitPrice(
          db,
          item.productId,
          item.quantity,
          item.variant
            ? { id: item.variant.id, productId: item.variant.productId, priceOverride: item.variant.priceOverride }
            : null
        )
        pricedItems.push({
          ...item,
          unitPrice: resolved.unitPrice,
          totalPrice: resolved.unitPrice * item.quantity,
          priceSource: resolved.priceSource,
          pricingIssue: null,
        })
      } catch (pricingError) {
        if (pricingError instanceof PricingError) {
          pricedItems.push({
            ...item,
            unitPrice: null,
            totalPrice: null,
            pricingIssue: pricingError.message,
          })
          continue
        }
        throw pricingError
      }
    }

    // Group items by supplier — subtotals use ONLY the server-resolved prices
    const groupedBySupplier = pricedItems.reduce((groups, item) => {
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
      if (item.totalPrice != null) {
        groups[supplierId].subtotal += item.totalPrice
      }
      return groups
    }, {} as Record<string, { supplierId: string; supplierName: string; items: typeof pricedItems; subtotal: number }>)

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
    const { productId, variantId, quantity } = body

    if (!productId || !quantity) {
      return NextResponse.json({ error: 'productId, quantity are required' }, { status: 400 })
    }

    // Validate quantity: unit-bearing decimal (kg: 2.5 is valid), 2 dp max.
    const safeQuantity = roundQty(Number(quantity))
    if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    }
    if (safeQuantity > 10000) {
      return NextResponse.json({ error: 'Quantity exceeds the 10,000 per-line limit' }, { status: 400 })
    }

    // Verify product exists and is active
    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, isApproved: true, stockQuantity: true, moq: true, maxOrderQty: true, supplierId: true },
    })

    if (!product || !product.isActive || !product.isApproved) {
      return NextResponse.json({ error: 'Product not available' }, { status: 404 })
    }

    // SECURITY: the cart line's supplier always comes from the product row —
    // a client-sent supplierId is never trusted.
    const supplierId = product.supplierId

    // Check stock (variant stock is checked against the variant row when set)
    let availableStock: number
    if (variantId) {
      const variant = await db.productVariants.findUnique({ where: { id: variantId } })
      if (!variant || variant.productId !== productId) {
        return NextResponse.json({ error: 'Invalid variant for this product' }, { status: 400 })
      }
      availableStock = variant.stockQuantity
      if (safeQuantity > availableStock) {
        return NextResponse.json({ error: 'Quantity exceeds available stock', stockAvailable: availableStock }, { status: 400 })
      }
    } else {
      availableStock = product.stockQuantity
      if (safeQuantity > availableStock) {
        return NextResponse.json({ error: 'Quantity exceeds available stock', stockAvailable: availableStock }, { status: 400 })
      }
    }

    // MOQ kept in force on the cart add path
    if (safeQuantity < product.moq) {
      return NextResponse.json({ error: `Minimum order quantity is ${product.moq}`, moq: product.moq }, { status: 400 })
    }

    // Max order quantity (real limit, enforced server-side)
    if (product.maxOrderQty != null && safeQuantity > product.maxOrderQty) {
      return NextResponse.json(
        { error: `Maximum order quantity is ${product.maxOrderQty}`, maxOrderQty: product.maxOrderQty },
        { status: 422 }
      )
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
      // Update quantity — merged line re-checks stock so repeated adds can
      // never push a line past real availability.
      const newQty = roundQty(existingItem.quantity + safeQuantity)
      if (newQty > availableStock) {
        return NextResponse.json(
          { error: 'Quantity exceeds available stock', stockAvailable: availableStock },
          { status: 400 }
        )
      }
      const updated = await db.cartItems.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
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
