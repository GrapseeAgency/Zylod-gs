import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/products/[id]/frequently-bought — related products for the PDP.
 *
 * HONEST DATA CONTRACT (Task 129): there is no co-purchase analytics table,
 * so the endpoint claims exactly what it computes — the seller's OTHER live,
 * approved products first, then other suppliers' products in the SAME
 * category. Every row carries the REAL source reason ('From this supplier'
 * | 'Same category') and real pricing (basePrice — the PDP's tier engine
 * still rules at checkout). The old invented `bundleOffer` (a modeled 10%
 * "savings" with no checkout teeth) was removed: pricing on Zylod is never
 * invented.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '4', 10) || 4, 1), 10)

    const currentProduct = await db.products.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        supplierId: true,
        basePrice: true,
        currency: true,
        unit: true,
      },
    })

    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const productInclude = {
      supplier: {
        select: {
          id: true,
          companyName: true,
          verificationStatus: true,
        },
      },
      images: {
        where: { sortOrder: 0 },
        take: 1,
      },
    } as const

    const [sameSupplierProducts, sameCategoryProducts] = await Promise.all([
      db.products.findMany({
        where: {
          supplierId: currentProduct.supplierId,
          id: { not: id },
          isActive: true,
          isApproved: true,
        },
        include: productInclude,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.products.findMany({
        where: {
          categoryId: currentProduct.categoryId,
          supplierId: { not: currentProduct.supplierId },
          id: { not: id },
          isActive: true,
          isApproved: true,
        },
        include: productInclude,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const related = [
      ...sameSupplierProducts.map((p) => ({ p, reason: 'From this supplier' })),
      ...sameCategoryProducts.map((p) => ({ p, reason: 'Same category' })),
    ]
      .filter((entry, idx, arr) => arr.findIndex((x) => x.p.id === entry.p.id) === idx)
      .slice(0, limit)
      .map(({ p, reason }) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        basePrice: p.basePrice,
        currency: p.currency,
        unit: p.unit,
        moq: p.moq,
        stock: p.stockQuantity,
        image: p.images[0]?.imageUrl ?? p.thumbnailUrl ?? null,
        supplier: {
          companyName: p.supplier.companyName,
          verificationStatus: p.supplier.verificationStatus,
        },
        reason,
      }))

    return NextResponse.json({
      success: true,
      data: {
        related,
        note: related.length === 0
          ? 'No other live products from this supplier or in this category yet.'
          : undefined,
      },
    })
  } catch (error) {
    console.error('Related products GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
