'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  Search, QrCode, Bell, ShoppingCart, Heart,
  Package, Wrench, Sparkles, Layers, ShieldCheck, Flame, Cog, Drill, Hammer, Factory
} from 'lucide-react'

interface Product {
  id: string
  name: string
  slug: string
  description: string
  base_price: number
  moq: number
  unit: string
  discount_percent: number
  supplier_id: string
  supplier_name: string
  supplier_slug: string
  images: { url: string }[]
  tags: string[]
  sku?: string
}

function normalizeProduct(raw: Record<string, unknown>): Product {
  const supplier = raw.supplier as { companyName?: string; slug?: string } | undefined
  const images = raw.images as { url: string }[] | undefined
  return {
    id: (raw.id as string) ?? '',
    name: (raw.name as string) ?? '',
    slug: (raw.slug as string) ?? '',
    description: (raw.description as string) ?? '',
    base_price: (raw.base_price as number) ?? (raw.basePrice as number) ?? 0,
    moq: (raw.moq as number) ?? 1,
    unit: (raw.unit as string) ?? 'Units',
    discount_percent: (raw.discount_percent as number) ?? (raw.discountPercent as number) ?? 0,
    supplier_id: (raw.supplier_id as string) ?? (raw.supplierId as string) ?? '',
    supplier_name: (raw.supplier_name as string) ?? (supplier?.companyName ?? ''),
    supplier_slug: (raw.supplier_slug as string) ?? (supplier?.slug ?? ''),
    images: Array.isArray(images) ? images : [],
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    sku: (raw.sku as string) || (raw.tags?.[0] as string) || 'SKU-001',
  }
}

interface CategoryChip {
  name: string
  slug: string
  icon: string
}

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  'power-tools': <Drill className="h-5 w-5" />,
  'abrasives': <Hammer className="h-5 w-5" />,
  'accessories': <Cog className="h-5 w-5" />,
  'machinery': <Factory className="h-5 w-5" />,
  'hardware': <Wrench className="h-5 w-5" />,
  'industrial': <Factory className="h-5 w-5" />,
}

export function SearchResultsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const pageParams = _pageParams || storeParams || {}
  const initialQuery = pageParams.query || pageParams.search || 'Precision Grinders'

  const [query, setQuery] = useState(initialQuery)
  const [activeSearch, setActiveSearch] = useState(initialQuery)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(10)

  useEffect(() => {
    let mounted = true
    const fetchResults = async () => {
      setLoading(true)
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch(`/api/products?search=${encodeURIComponent(activeSearch)}&limit=50`),
          fetch('/api/categories?limit=6')
        ])

        if (prodRes.ok) {
          const prodData = await prodRes.json()
          const items = Array.isArray(prodData.data) ? prodData.data.map(normalizeProduct) : []
          if (mounted) setProducts(items)
        }

        if (catRes.ok) {
          const catData = await catRes.json()
          const cats = Array.isArray(catData.data || catData) ? (catData.data || catData) : []
          if (mounted) setCategories(cats)
        }
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchResults()
    return () => { mounted = false }
  }, [activeSearch])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setActiveSearch(query.trim())
    }
  }

  const handleAddToCart = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    addItem({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.images[0]?.url || null,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: product.moq,
      unitPrice: product.base_price,
      totalPrice: product.base_price * product.moq,
      moq: product.moq,
      maxOrderQty: null,
      supplierId: product.supplier_id,
      supplierName: product.supplier_name,
      supplierSlug: product.supplier_slug,
      unit: product.unit,
      priceTiers: [],
    })
  }, [addItem])

  const handleToggleWishlist = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    toggleItem({
      id: product.id,
      name: product.name,
      price: product.base_price,
      originalPrice: product.base_price,
      moq: product.moq,
      unit: product.unit,
      supplier: product.supplier_name,
      location: '',
      category: '',
      customizable: false
    })
  }, [toggleItem])

  const visibleProducts = useMemo(() => products.slice(0, visibleCount), [products, visibleCount])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:px-6">
        <div className="flex items-center justify-between mb-3 md:hidden">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700 hover:text-slate-900" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700 hover:text-slate-900 relative" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center md:max-w-3xl md:mx-auto">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, categories..."
            className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus-visible:ring-primary"
          />
          <button type="button" className="absolute right-3 p-1 text-slate-400 hover:text-slate-600">
            <QrCode className="h-4 w-4" />
          </button>
        </form>
      </header>

      {/* Query Info & Suggestions */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 md:px-6">
        <p className="text-xs text-slate-500">
          Showing results for &ldquo;<span className="font-semibold text-slate-800">{activeSearch}</span>&rdquo;
        </p>
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className="text-slate-400">Did you mean:</span>
          <button
            onClick={() => {
              setQuery('Professional Grinders')
              setActiveSearch('Professional Grinders')
            }}
            className="text-primary font-semibold hover:underline"
          >
            Professional Grinders
          </button>
        </div>
      </div>

      {/* Related Categories */}
      {categories.length > 0 && (
        <section className="px-4 py-4 md:px-6 md:max-w-5xl mx-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Related Categories
          </h3>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            {categories.slice(0, 4).map((c, i) => (
              <button
                key={c.id || c.slug || i}
                onClick={() => navigate('category-products', { category: c.slug })}
                className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:shadow-md transition-all min-w-[96px] shrink-0"
              >
                <div className="w-11 h-11 rounded-full bg-red-50 text-primary flex items-center justify-center mb-1.5 text-lg">
                  {CATEGORY_ICON_MAP[c.slug] || (i % 2 === 0 ? <Wrench className="h-5 w-5" /> : <Cog className="h-5 w-5" />)}
                </div>
                <span className="text-xs font-semibold text-slate-700 text-center line-clamp-1">
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Product Results List */}
      <main className="px-4 pt-2 md:px-6 md:max-w-5xl md:mx-auto md:w-full md:pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">
            Products ({products.length})
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 border border-slate-100 flex gap-3">
                <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-5 w-24 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No results found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              We couldn't find any products matching &ldquo;{activeSearch}&rdquo;. Try another term or browse categories.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs font-semibold text-primary border-primary"
              onClick={() => navigate('category-browser')}
            >
              Browse All Categories
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleProducts.map((product, idx) => {
              const inWish = isInWishlist(product.id)
              const isBestSeller = idx === 0
              const highPrice = product.base_price * 1.08

              return (
                <div
                  key={product.id}
                  onClick={() => navigate('product-detail', { productId: product.id })}
                  className="relative bg-white rounded-2xl border border-slate-100 p-3 shadow-2xs hover:shadow-md transition-all flex gap-3.5 cursor-pointer items-start"
                >
                  {/* Left Thumbnail with Badge */}
                  <div className="relative w-24 h-24 rounded-xl bg-slate-100 shrink-0 overflow-hidden">
                    {product.images?.[0]?.url ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="h-8 w-8" />
                      </div>
                    )}
                    {isBestSeller && (
                      <div className="absolute top-0 left-0 bg-primary text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-br-md shadow-xs">
                        Best Seller
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0 pr-6">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                      {product.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Model: {product.sku || product.tags?.[0] || 'STD-4530'}
                    </p>

                    <div className="mt-2">
                      <div className="text-sm font-black text-primary">
                        {formatPrice(product.base_price)} - {formatPrice(highPrice)}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        MOQ: {product.moq} {product.unit}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Wishlist top-right, Cart bottom-right) */}
                  <button
                    onClick={(e) => handleToggleWishlist(e, product)}
                    className="absolute top-3 right-3 p-1 text-slate-400 hover:text-primary transition-colors"
                  >
                    <Heart className={`h-4 w-4 ${inWish ? 'fill-primary text-primary' : ''}`} />
                  </button>

                  <button
                    onClick={(e) => handleAddToCart(e, product)}
                    className="absolute bottom-3 right-3 p-2 rounded-full bg-red-50 text-primary hover:bg-primary hover:text-white transition-colors"
                    title="Add to cart"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Load More Results */}
        {!loading && visibleCount < products.length && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setVisibleCount((c) => c + 10)}
              className="text-xs font-bold text-primary hover:underline py-2 px-4 rounded-full"
            >
              Load More Results
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
