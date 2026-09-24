'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Bell, Sparkles, Package, ArrowRight,
  AlertCircle, RefreshCw, SearchX, Boxes
} from 'lucide-react'

interface SimilarProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  unit: string
  moq: number
  stock: number
  image: string | null
  category: { id: string; name: string; slug: string } | null
  matchPercentage: number
  bulkPrice: number
  avgRating: number
  totalReviews: number
}

export function SimilarProductsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentProductName, setCurrentProductName] = useState<string | null>(null)
  const [products, setProducts] = useState<SimilarProduct[]>([])

  const fetchSimilar = useCallback(async () => {
    if (!productId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${productId}/similar?limit=8`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || `Failed to load similar products (${res.status})`)
        setProducts([])
        return
      }
      setCurrentProductName(data?.data?.currentProduct?.name || null)
      setProducts(Array.isArray(data?.data?.similarProducts) ? data.data.similarProducts : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading similar products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchSimilar()
  }, [fetchSimilar])

  /* ─── No product selected — honest state ─── */
  if (!productId) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        </header>
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            <SearchX className="h-9 w-9 text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900">No product selected</h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Similar products are shown for a specific product. Open a product first and we&apos;ll
            list alternatives from the same category.
          </p>
          <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto">
            <Button
              onClick={() => navigate('explore')}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl shadow-md"
            >
              Explore Products
            </Button>
            <Button
              variant="outline"
              onClick={goBack}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-10 rounded-2xl"
            >
              Go Back
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-xl mx-auto md:max-w-3xl md:px-6 md:py-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-wider mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Similar Products</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
            {loading ? 'Loading…' : products.length > 0 ? `Alternatives to “${currentProductName}”` : 'Similar Products'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Live listings from the same category as this product. Match percentages are computed from
            real price data — nothing here is pre-generated.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-2xs flex flex-col items-start gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900">Couldn&apos;t load similar products</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={fetchSimilar}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-white text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
                <Skeleton className="h-36 w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty — marketplace has no similar products yet */}
        {!loading && !error && products.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Package className="h-9 w-9 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">No similar products found yet</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              There are no other products in this category right now. New supplier listings appear
              here in real time as soon as they are approved.
            </p>
            <Button
              onClick={() => navigate('explore')}
              className="mt-5 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md inline-flex items-center gap-1.5"
            >
              Browse All Products
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Product cards */}
        {!loading && !error && products.length > 0 && (
          <div className="space-y-4">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate('product-detail', { productId: p.id })}
                className="w-full text-left bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Image */}
                  <div className="relative h-40 w-full md:h-44 md:w-52 shrink-0 bg-slate-100 overflow-hidden">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 w-full h-full">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    {typeof p.matchPercentage === 'number' && (
                      <Badge className="absolute top-3 right-3 bg-white/90 text-slate-800 border-none text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs">
                        {p.matchPercentage}% price match
                      </Badge>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-2.5 flex-1 min-w-0">
                    {p.category?.name && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {p.category.name}
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{p.name}</h3>

                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-base font-black text-primary">
                        {formatPrice(p.basePrice)}
                        <span className="text-xs font-normal text-slate-400"> / {p.unit}</span>
                      </span>
                      {typeof p.bulkPrice === 'number' && p.bulkPrice > 0 && p.bulkPrice !== p.basePrice && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Bulk: {formatPrice(p.bulkPrice)} / {p.unit}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium flex-wrap">
                      <span>MOQ: {p.moq.toLocaleString()} {p.unit}</span>
                      {p.totalReviews > 0 && (
                        <span>
                          ★ {p.avgRating.toFixed(1)} ({p.totalReviews} review{p.totalReviews === 1 ? '' : 's'})
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary pt-1">
                      View Product <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Honest note */}
        {!loading && !error && products.length > 0 && (
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">Live catalog data</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                This list updates automatically as suppliers add or remove products. Prices and stock
                are fetched from the marketplace in real time.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default SimilarProductsPage
