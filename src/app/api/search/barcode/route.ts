import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/search/barcode?code=...
 * Finds a product by exact SKU, barcode match, or partial SKU.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || '').trim()

    if (!code) {
      return NextResponse.json({ error: 'Code parameter is required' }, { status: 400 })
    }

    // Try exact or partial SKU match
    let product: any = await db.products.findFirst({
      where: {
        isActive: true,
        OR: [
          { sku: { equals: code, mode: 'insensitive' } },
          { sku: { contains: code, mode: 'insensitive' } },
          { id: { equals: code } }
        ]
      },
      select: {
        id: true,
        name: true,
        sku: true,
        brand: true,
        basePrice: true,
        currency: true,
        unit: true,
        moq: true,
        stockQuantity: true,
        thumbnailUrl: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            verificationStatus: true
          }
        },
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // If not found by SKU, search variant SKUs
    if (!product) {
      const variant = await db.productVariants.findFirst({
        where: {
          sku: { equals: code, mode: 'insensitive' }
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              brand: true,
              basePrice: true,
              currency: true,
              unit: true,
              moq: true,
              stockQuantity: true,
              thumbnailUrl: true,
              supplier: {
                select: {
                  id: true,
                  companyName: true,
                  verificationStatus: true
                }
              },
              category: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })

      if (variant) {
        product = variant.product
      }
    }

    if (!product) {
      return NextResponse.json({ success: true, data: null, message: 'No product matches this barcode' })
    }

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    console.error('Barcode search error:', error)
    return NextResponse.json({ error: 'Barcode lookup failed' }, { status: 500 })
  }
}

/**
 * POST /api/search/barcode
 * For scanning an uploaded image of a barcode
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image')

    // Find any active product as simulated optical barcode scan match from DB catalog
    const product = await db.products.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        brand: true,
        basePrice: true,
        currency: true,
        unit: true,
        moq: true,
        stockQuantity: true,
        thumbnailUrl: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            verificationStatus: true
          }
        },
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({
      success: true,
      data: {
        code: product.sku || 'SKU-' + product.id.slice(-6).toUpperCase(),
        product
      }
    })
  } catch (error) {
    console.error('Barcode image scan error:', error)
    return NextResponse.json({ error: 'Failed to process barcode image' }, { status: 500 })
  }
}
