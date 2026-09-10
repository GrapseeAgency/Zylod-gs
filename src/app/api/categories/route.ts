import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiCache } from '@/lib/api-cache'

export async function GET() {
  try {
    const { data: tree } = await withApiCache('categories:tree', { ttlMs: 5 * 60_000, staleMs: 24 * 60 * 60_000 }, async () => {
      const categories = await db.categories.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              children: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
              _count: { select: { products: { where: { isActive: true, isApproved: true } } } },
            },
          },
          _count: { select: { products: { where: { isActive: true, isApproved: true } } } },
        },
      })

      // One groupBy for ALL categories — supplier count per category derived in JS.
      // (The previous per-category groupBy meant ~20 extra DB round-trips per request.)
      const supplierGroups = await db.products.groupBy({
        by: ['categoryId', 'supplierId'],
        where: { isActive: true, isApproved: true },
      })
      const suppliersPerCategory = new Map<string, Set<string>>()
      for (const g of supplierGroups) {
        if (!g.categoryId) continue
        let set = suppliersPerCategory.get(g.categoryId)
        if (!set) {
          set = new Set()
          suppliersPerCategory.set(g.categoryId, set)
        }
        set.add(g.supplierId)
      }

      // Only return top-level categories (no parentId)
      const rootCategories = categories.filter(c => !c.parentId)

      return rootCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        iconUrl: cat.iconUrl,
        sortOrder: cat.sortOrder,
        productCount: cat._count.products,
        supplierCount: suppliersPerCategory.get(cat.id)?.size ?? 0,
        children: cat.children.map(child => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          iconUrl: child.iconUrl,
          sortOrder: child.sortOrder,
          productCount: child._count.products,
          children: child.children.map(grandchild => ({
            id: grandchild.id,
            name: grandchild.name,
            slug: grandchild.slug,
            iconUrl: grandchild.iconUrl,
            sortOrder: grandchild.sortOrder,
          })),
        })),
      }))
    })

    return NextResponse.json({ success: true, data: tree })
  } catch (error) {
    console.error('Categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
