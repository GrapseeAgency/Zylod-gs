'use client'

import React, { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { ProductCard, type HomeProduct } from './product-card'

/* ════════════════════════════════════════════════════════════════════
   Featured Products — REAL marketplace data only.

   t223 honesty fix: this section used to render a hardcoded
   MOCKUP_PRODUCTS array (fabricated ids like "prod-led-bulb", invented
   ratings/review counts and supplier names from the design mockup).
   Every card navigated to a product-detail id that does not exist in
   the database → "Product not found" dead end. The grid now loads the
   best-selling products from /api/products (real ids, real prices,
   real suppliers, real ratings) and renders honest loading / error /
   empty states — never fabricated rows.
   ════════════════════════════════════════════════════════════════════ */

interface ApiSupplier {
  companyName?: string | null
  verificationStatus?: string | null
}

interface ApiProduct {
  id: string
  name: string
  basePrice: number
  moq: number
  unit?: string | null
  ratingAvg?: number | null
  reviewCount?: number | null
  thumbnailUrl?: string | null
  isActive?: boolean
  supplier?: ApiSupplier | null
}

/** API row → card model. Every field is real or absent — no fallbacks. */
function toHomeProduct(p: ApiProduct): HomeProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.basePrice,
    moq: p.moq,
    unit: p.unit,
    ratingAvg: p.ratingAvg,
    reviewCount: p.reviewCount,
    thumbnailUrl: p.thumbnailUrl,
    supplierName: p.supplier?.companyName ?? null,
    // The DB's verified-supplier state is verificationStatus 'approved'
    // ('pending' suppliers correctly get no chip).
    supplierVerified: p.supplier?.verificationStatus === 'approved' || p.supplier?.verificationStatus === 'verified',
    isFavorited: false,
  }
}

/** Skeleton matching the real card's aspect so the grid doesn't jump. */
function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 overflow-hidden animate-pulse" aria-hidden>
      <div className="aspect-[144/104] bg-gray-100 dark:bg-gray-800" />
      <div className="px-2 pt-1.5 pb-2 space-y-1.5">
        <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-2.5 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  )
}

const SKELETONS = Array.from({ length: 12 }, (_, i) => i)

export function FeaturedSection() {
  const { navigate } = useNavigationStore()
  const [products, setProducts] = useState<HomeProduct[] | null>(null) // null = loading
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/products?sortBy=soldCount&sortOrder=desc&limit=12', {
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`products ${res.status}`)
        const body = await res.json()
        const rows: ApiProduct[] = Array.isArray(body.data) ? body.data : []
        if (cancelled) return
        setProducts(rows.filter((p) => p && p.id && p.isActive !== false).map(toHomeProduct))
      } catch {
        if (!cancelled) setLoadFailed(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Signed-in: seed real wishlist hearts onto the loaded (real) products.
  useEffect(() => {
    let cancelled = false

    const loadWishlist = async () => {
      if (!useAuthStore.getState().isAuthenticated) return
      try {
        const favRes = await fetch('/api/favorites', { credentials: 'include' })
        if (favRes.ok && !cancelled) {
          const favBody = await favRes.json()
          const list: Array<{ product?: { id?: string } }> = Array.isArray(favBody.data) ? favBody.data : []
          const favIds = new Set(list.map((f) => f.product?.id).filter(Boolean) as string[])
          if (favIds.size > 0) {
            setProducts((prev) =>
              prev ? prev.map((p) => (favIds.has(p.id) ? { ...p, isFavorited: true } : p)) : prev,
            )
          }
        }
      } catch {
        // Keep default wishlist state
      }
    }

    loadWishlist()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-labelledby="featured-products-heading">
      {/* Section header — red bar + title + View All */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-full" style={{ background: '#E31C3D' }} aria-hidden />
          <h2 id="featured-products-heading" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Featured products
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

      {/* Loading — skeletons in the real grid layout */}
      {products === null && !loadFailed && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 sm:gap-3 xl:gap-3.5">
          {SKELETONS.map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Failure — honest error with retry, never fabricated rows */}
      {loadFailed && (
        <FeaturedLoadError onRetry={() => { setLoadFailed(false); setProducts(null) }} />
      )}

      {/* Loaded */}
      {products !== null && !loadFailed && (
        products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No products are live in the marketplace yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 sm:gap-3 xl:gap-3.5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )
      )}
    </section>
  )
}

function FeaturedLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status" className="py-10 text-center space-y-2">
      <p className="text-sm text-muted-foreground">
        Featured products couldn&apos;t load right now.
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg border border-border px-4 py-2 hover:bg-muted/50 transition-colors"
        style={{ color: '#E31C3D' }}
      >
        Try again
      </button>
    </div>
  )
}

export default FeaturedSection
