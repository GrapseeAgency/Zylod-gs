'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, ChevronRight, Sparkles } from 'lucide-react'

/* ─── Map DB category slugs to navigation page IDs ─── */
const CATEGORY_PAGE_MAP: Record<string, string> = {
  'textiles-fabrics': 'textiles-fabrics',
  'agriculture-food': 'agriculture-food',
  'electronics': 'electronics',
  'construction': 'construction',
  'packaging': 'packaging',
  'home-garden': 'home-garden',
  'gifts-crafts': 'gifts-crafts',
  'beauty-personal-care': 'beauty-personal-care',
  'promotional-items': 'promotional-items',
  'automotive': 'automotive',
  'medical-supplies': 'medical-supplies',
  'mobile-accessories': 'mobile-accessories',
  'led-lighting': 'led-lighting',
  'spices': 'spices',
  'garments': 'garments',
  'sports-fitness': 'sports-fitness',
  'books-stationery': 'books-stationery',
  'toys': 'toys',
  'jewelry': 'jewelry',
  'furniture': 'furniture',
}

/* ─── Category icon palette (visual only — counts are live) ─── */
const CATEGORY_COLORS = ['#E53935', '#388E3C', '#1976D2', '#F57C00', '#7B1FA2', '#00897B', '#C62828', '#AD1457', '#EF6C00', '#455A64', '#004D40', '#1565C0', '#FF8F00', '#6A1B9A']

interface SidebarCategory {
  id: string
  name: string
  slug: string
  color: string
  productCount: number
  supplierCount: number
  children: { id: string; name: string; slug: string; productCount: number }[]
}

export function CategorySidebar() {
  const { navigate } = useNavigationStore()
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [categories, setCategories] = useState<SidebarCategory[]>([])
  const [supplierCount, setSupplierCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setCategories(json.data.map((c: any, i: number) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
            productCount: c.productCount || 0,
            supplierCount: c.supplierCount || 0,
            children: (c.children || []).map((ch: any) => ({
              id: ch.id, name: ch.name, slug: ch.slug, productCount: ch.productCount || 0,
            })),
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch('/api/suppliers?limit=1')
      .then(r => r.json())
      .then(json => { if (json.success) setSupplierCount(json.pagination?.total || 0) })
      .catch(() => {})
  }, [])

  return (
    <aside className="hidden lg:block w-[220px] shrink-0 relative z-20">
      {/* All Categories Card */}
      <Card className="border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div
          className="px-4 py-3 border-b border-gray-100 bg-primary"
        >
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Package className="h-4 w-4" />
            All Categories
          </h2>
        </div>
        <div className="py-0.5 bg-card">
          {loading ? (
            <div className="p-2 space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : (
            categories.map((cat) => {
              const isHovered = hoveredCategory === cat.id
              return (
                <div
                  key={cat.id}
                  className="relative"
                  onMouseEnter={() => setHoveredCategory(cat.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <div
                    className="flex items-center gap-2 px-3.5 py-2 cursor-pointer transition-all duration-150 group border-l-3"
                    style={{
                      background: isHovered ? '#FFF5F5' : 'transparent',
                      borderLeftWidth: '3px',
                    }}
                    onClick={() => navigate(CATEGORY_PAGE_MAP[cat.slug] || cat.slug)}
                  >
                    <span
                      className="h-4 w-4 rounded shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ background: cat.color }}
                    >
                      {cat.name.charAt(0)}
                    </span>
                    <span
                      className={`text-[12.5px] flex-1 truncate font-medium transition-colors ${isHovered ? 'text-primary' : 'text-foreground'}`}
                    >
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{cat.productCount}</span>
                    <ChevronRight
                      className={`h-3 w-3 shrink-0 transition-colors ${isHovered ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </div>

                  {/* ─── Flyout Mega-Menu ─── */}
                  {isHovered && (
                    <div
                      className="absolute left-full top-0 ml-0 w-[480px] bg-card border border-gray-200 shadow-xl rounded-lg z-50 p-5"
                      style={{ minHeight: '200px' }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <span className="h-5 w-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ background: cat.color }}>
                          {cat.name.charAt(0)}
                        </span>
                        <h3 className="text-base font-bold text-foreground">{cat.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${cat.color}15`, color: cat.color }}>
                          {cat.productCount} products
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        {cat.children.map((sub) => (
                          <button
                            key={sub.id}
                            className="flex items-center justify-between py-2 px-3 rounded-md text-[12px] text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer group/sub"
                            onClick={() => navigate(CATEGORY_PAGE_MAP[sub.slug] || CATEGORY_PAGE_MAP[cat.slug] || cat.slug)}
                          >
                            <span className="font-medium">{sub.name}</span>
                            <span className="text-[10px] text-gray-400 group-hover/sub:text-red-400">{sub.productCount}</span>
                          </button>
                        ))}
                        {cat.children.length === 0 && (
                          <p className="text-[11px] text-gray-400 col-span-2">No subcategories yet.</p>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4">
                        <Button
                          size="sm"
                          className="text-xs font-semibold bg-primary text-primary-foreground"
                          onClick={() => navigate(CATEGORY_PAGE_MAP[cat.slug] || cat.slug)}
                        >
                          View All {cat.name}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-medium"
                          style={{ borderColor: cat.color, color: cat.color }}
                          onClick={() => navigate('suppliers')}
                        >
                          Find Suppliers
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* Small promo banner */}
      <Card className="mt-3 border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 text-center bg-gradient-to-br from-primary/5 to-card">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p className="text-xs font-bold mb-1 text-foreground">New Supplier?</p>
          <p className="text-[11px] text-gray-500 mb-3">
            {supplierCount !== null ? `Join ${supplierCount} verified suppliers on Zylod` : 'Register your business on Zylod'}
          </p>
          <Button
            size="sm"
            className="w-full text-xs font-semibold bg-primary text-primary-foreground"
            onClick={() => navigate('register-supplier')}
          >
            Register Now
          </Button>
        </div>
      </Card>

    </aside>
  )
}
