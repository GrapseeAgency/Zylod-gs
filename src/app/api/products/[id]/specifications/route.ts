import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify product exists
    const product = await db.products.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const specifications = await db.productSpecifications.findMany({
      where: { productId: id },
      orderBy: { sortOrder: 'asc' },
    })

    // Group specifications by category for better organization
    const groupedSpecs: Record<string, Array<{ specName: string; specValue: string }>> = {}
    const ungrouped: Array<{ specName: string; specValue: string }> = []

    // Simple categorization logic based on spec name patterns
    const categoryPatterns: Record<string, string[]> = {
      'Physical Properties': ['weight', 'dimension', 'size', 'length', 'width', 'height', 'thickness', 'diameter', 'volume', 'capacity'],
      'Material & Composition': ['material', 'fabric', 'composition', 'content', 'fill', 'fiber', 'blend', 'ingredients'],
      'Color & Appearance': ['color', 'colour', 'finish', 'pattern', 'texture', 'shade', 'print'],
      'Performance': ['durability', 'strength', 'resistance', 'waterproof', 'breathable', 'thermal', 'insulation', 'absorbency'],
      'Certification & Compliance': ['certif', 'standard', 'compliance', 'iso', 'bsti', 'fda', 'gots', 'oecko'],
      'Packaging & Shipping': ['package', 'packing', 'carton', 'pallet', 'shipping', 'container', 'box', 'wrap'],
    }

    for (const spec of specifications) {
      const specNameLower = spec.specName.toLowerCase()
      let categorized = false

      for (const [category, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(p => specNameLower.includes(p))) {
          if (!groupedSpecs[category]) groupedSpecs[category] = []
          groupedSpecs[category].push({
            specName: spec.specName,
            specValue: spec.specValue,
          })
          categorized = true
          break
        }
      }

      if (!categorized) {
        ungrouped.push({
          specName: spec.specName,
          specValue: spec.specValue,
        })
      }
    }

    // Add ungrouped specs as "General" category
    if (ungrouped.length > 0) {
      groupedSpecs['General'] = ungrouped
    }

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
        },
        specifications: specifications.map(s => ({
          id: s.id,
          specName: s.specName,
          specValue: s.specValue,
          sortOrder: s.sortOrder,
        })),
        groupedSpecifications: groupedSpecs,
        totalSpecs: specifications.length,
      },
    })
  } catch (error) {
    console.error('Product specifications GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
