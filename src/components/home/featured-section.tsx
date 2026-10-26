'use client'

import React, { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { ProductCard, type HomeProduct } from './product-card'
import { ProductCardSkeleton } from '@/components/shared/loading-skeletons'

/* ════════════════════════════════════════════════════════════════════
   Featured Products — hand-built to the owner's mockup (t211).

   • Red bar + bold heading + "View All" → real all-products page.
   • 12 REAL products from /api/products (top sold), rendered in a grid
     that breathes: 6 columns only on ≥1536px screens (where the mockup
     puts 6), 4 columns on large screens, 3 on small tablets, 2 on
     phones. The t210 "gross / tight" complaint came from forcing 6
     columns at 1280px — fixed here by width-aware breakpoints.
   • For signed-in buyers the heart states are seeded from the real
     wishlist (GET /api/favorites).
   ════════════════════════════════════════════════════════════════════ */

interface ApiProduct {
  id: string
  name: string
  basePrice: number
  moq: number
  unit?: string | null
  ratingAvg?: number | null
  reviewCount?: number | null
  thumbnailUrl?: string | null
  supplier?: { companyName: string; verificationStatus?: string }
}

function mapApiProduct(p: ApiProduct): HomeProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.basePrice,
    moq: p.moq,
    unit: p.unit ?? null,
    ratingAvg: p.ratingAvg ?? null,
    reviewCount: p.reviewCount ?? null,
    thumbnailUrl: p.thumbnailUrl ?? null,
    supplierName: p.supplier?.companyName ?? null,
    supplierVerified: p.supplier?.verificationStatus === 'approved',
    isFavorited: false,
  }
}

export function FeaturedSection() {
  const { navigate } = useNavigationStore()
  const [products, setProducts] = useState<HomeProduct[] | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/products?page=1&limit=12&sortBy=soldCount&sortOrder=desc')
        const body = await res.json()
        if (cancelled) return
        const items: ApiProduct[] = Array.isArray(body.data) ? body.data : (body.data?.products ?? [])
        setProducts(items.map(mapApiProduct))

        // Signed-in: seed real wishlist hearts.
        if (useAuthStore.getState().isAuthenticated && items.length > 0) {
          const favRes = await fetch('/api/favorites', { credentials: 'include' })
          if (favRes.ok && !cancelled) {
            const favBody = await favRes.json()
            const list: Array<{ product?: { id?: string } }> = Array.isArray(favBody.data) ? favBody.data : []
            const favIds = new Set(list.map((f) => f.product?.id).filter(Boolean) as string[])
            if (favIds.size > 0) {
              setProducts((prev) =>
                prev ? prev.map((p) => (favIds.has(p.id) ? { ...p, isFavorited: true } : p)) : prev
              )
            }
          }
        }
      } catch {
        if (!cancelled) setProducts([])
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-labelledby="featured-products-heading">
      {/* Section header — red bar + title + View All (mockup) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full" style={{ background: '#E31C3D' }} aria-hidden />
          <h2 id="featured-products-heading" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Featured Products
          </h2>
        </div>
        <button
          onClick={() => navigate('category-products', { category: 'all' })}
          className="group inline-flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
          style={{ color: '#E31C3D' }}
        >
          View All <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      </div>

      {/* Width-aware grid — 6 cols only where the mockup's 1536px layout applies */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
        {products === null
          ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>

      {/* Real empty state (API reachable but zero products) */}
      {products !== null && products.length === 0 && (
        <div className="py-14 text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            No products to show yet.
          </p>
          <button
            onClick={() => navigate('category-products', { category: 'all' })}
            className="mt-2 text-sm font-semibold hover:underline"
            style={{ color: '#E31C3D' }}
          >
            Browse all products
          </button>
        </div>
      )}
    </section>
  )
}
