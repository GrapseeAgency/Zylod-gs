'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  Search, QrCode, Bell, Heart,
  ArrowRight, Package, AlertCircle, RefreshCw, BookOpen
} from 'lucide-react'

interface CatalogProduct {
  id: string
  name: string
  basePrice: number
  moq: number
  soldCount: number
  unit: string
  image: string | null
  supplierName: string
  categoryName: string
  categorySlug: string
}

interface CategoryPill {
  name: string
  slug: string
  productCount: number
}

export function WholesaleCatalogPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<CategoryPill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCatalog = useCallback(async (categorySlug: string) => {
    setLoading(true)
    setError(null)
    try {
      const url =
        categorySlug && categorySlug !== 'all'
          ? `/api/products?limit=20&category=${encodeURIComponent(categorySlug)}`
          : '/api/products?limit=20'
      const res = await fetch(url)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || `Failed to load catalog (${res.status})`)
        setProducts([])
        return
      }
      const items = Array.isArray(data?.data) ? data.data : []
      setProducts(
        items.map((p: Record<string, unknown>): CatalogProduct => {
          const images = p.images as Array<{ imageUrl?: string }> | undefined
          const category = p.category as { name?: string; slug?: string } | undefined
          const supplier = p.supplier as { companyName?: string } | undefined
          return {
            id: String(p.id ?? ''),
            name: String(p.name ?? ''),
            basePrice: typeof p.basePrice === 'number' ? p.basePrice : 0,
            moq: typeof p.moq === 'number' ? p.moq : 1,
            soldCount: typeof p.soldCount === 'number' ? p.soldCount : 0,
            unit: String(p.unit ?? 'pcs'),
            image: images?.[0]?.imageUrl || (p.thumbnailUrl as string | null) || null,
            supplierName: supplier?.companyName || '',
            categoryName: category?.name || '',
            categorySlug: category?.slug || '',
          }
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading catalog')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  /* Real category pills from the live categories tree */
  useEffect(() => {
    let mounted = true
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json().catch(() => null)
        if (!mounted) return
        if (res.ok && Array.isArray(data?.data)) {
          setCategories(
            data.data
              .filter((c: { productCount?: number }) => (c.productCount ?? 0) > 0)
              .map((c: { name: string; slug: string; productCount: number }) => ({
                name: c.name,
                slug: c.slug,
                productCount: c.productCount,
              }))
          )
        }
      } catch {
        // categories are optional filters — page still works with "All Products"
      }
    }
    loadCategories()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    fetchCatalog(activeCategory)
  }, [fetchCatalog, activeCategory])

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products
    const q = searchQuery.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, searchQuery])

  const handleToggleWishlist = useCallback((e: React.MouseEvent, p: CatalogProduct) => {
    e.stopPropagation()
    toggleItem({
      id: p.id,
      name: p.name,
      price: p.basePrice,
      originalPrice: p.basePrice,
      moq: p.moq,
      unit: p.unit,
      supplier: p.supplierName,
      location: '',
      category: p.categoryName,
      customizable: false,
    })
  }, [toggleItem])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="md:hidden p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog..."
            className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus-visible:ring-primary"
          />
          <button className="absolute right-3 p-1 text-slate-400 hover:text-slate-600">
            <QrCode className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6">
        {/* Honest page intro — no invented stats or banners */}
        <div className="rounded-3xl bg-white border border-slate-200 p-5 flex items-start gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 leading-tight">Wholesale Catalog</h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Every listing below is live from the marketplace — real suppliers, real prices, real
              stock. Nothing on this page is pre-generated.
            </p>
          </div>
        </div>

        {/* Category Pills — real categories only */}
        {(categories.length > 0 || activeCategory === 'all') && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Products
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActiveCategory(c.slug)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === c.slug
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Products Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h3 className="text-sm font-black text-slate-900">Product Catalog</h3>
            <p className="text-[10px] text-slate-400">Live from verified supplier listings</p>
          </div>
          <button
            onClick={() => navigate('explore')}
            className="text-xs font-bold text-primary flex items-center gap-0.5 hover:underline"
          >
            Explore <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-2xs flex flex-col items-start gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900">Couldn&apos;t load the catalog</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => fetchCatalog(activeCategory)}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-white text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 border border-slate-100 space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty — honest */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Package className="h-9 w-9 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">
              {products.length === 0 ? 'No products in the catalog yet' : 'No products match your search'}
            </h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {products.length === 0
                ? 'Suppliers haven\u2019t listed any approved products yet. As soon as listings go live, they\u2019ll appear here in real time.'
                : 'Try a different search term or category.'}
            </p>
            {products.length === 0 && (
              <Button
                onClick={() => navigate('explore')}
                className="mt-5 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md"
              >
                Explore Zylod
              </Button>
            )}
          </div>
        )}

        {/* Product Grid */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredProducts.map((p) => {
              const inWish = isInWishlist(p.id)
              return (
                <div
                  key={p.id}
                  onClick={() => navigate('product-detail', { productId: p.id })}
                  className="bg-white rounded-2xl border border-slate-100 p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative aspect-square rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden mb-2">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 w-full h-full">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <button
                      onClick={(e) => handleToggleWishlist(e, p)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-xs text-slate-600 hover:text-primary transition-colors"
                    >
                      <Heart className={`h-3.5 w-3.5 ${inWish ? 'fill-primary text-primary' : ''}`} />
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                      {p.name}
                    </h4>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-primary">
                        {formatPrice(p.basePrice)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">/{p.unit}</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-50 gap-2">
                      <span className="truncate">MOQ: {p.moq.toLocaleString()}</span>
                      {p.soldCount > 0 && <span className="shrink-0">{p.soldCount.toLocaleString()} sold</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default WholesaleCatalogPage
