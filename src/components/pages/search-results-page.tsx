'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore, resolveClientUnitPrice, type ClientPriceTier } from '@/store/cart-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  Search, ShoppingCart, Heart,
  Package, AlertTriangle, LogIn, RotateCcw, Tag,
} from 'lucide-react'

/* ─── Real GET /api/products row shape (src/app/api/products/route.ts):
 * products include supplier{id,companyName,ratingAvg}, category{id,name,slug},
 * images[{imageUrl,altText,sortOrder}], priceTiers[{minQty,maxQty,pricePerUnit}],
 * variants[{id,variantName,variantValue,sku,stockQuantity,priceOverride}] ─── */
interface Product {
  id: string
  name: string
  slug: string
  sku: string | null
  unit: string
  moq: number
  maxOrderQty: number | null
  basePrice: number
  stockQuantity: number
  soldCount: number
  thumbnailUrl: string | null
  supplierId: string
  supplierName: string
  imageUrls: string[]
  priceTiers: ClientPriceTier[]
}

function normalizeProduct(raw: Record<string, unknown>): Product {
  const supplier = raw.supplier as { id?: string; companyName?: string } | undefined
  const images = raw.images as { imageUrl?: string }[] | undefined
  const tiers = raw.priceTiers as ClientPriceTier[] | undefined
  return {
    id: (raw.id as string) ?? '',
    name: (raw.name as string) ?? '',
    slug: (raw.slug as string) ?? '',
    sku: (raw.sku as string) || null,
    unit: (raw.unit as string) ?? 'pcs',
    moq: (raw.moq as number) ?? 1,
    maxOrderQty: (raw.maxOrderQty as number | null) ?? null,
    basePrice: (raw.basePrice as number) ?? 0,
    stockQuantity: (raw.stockQuantity as number) ?? 0,
    soldCount: (raw.soldCount as number) ?? 0,
    thumbnailUrl: (raw.thumbnailUrl as string | null) ?? null,
    supplierId: (raw.supplierId as string) ?? supplier?.id ?? '',
    supplierName: supplier?.companyName ?? '',
    imageUrls: Array.isArray(images)
      ? images.map((i) => i?.imageUrl).filter((u): u is string => typeof u === 'string' && u.length > 0)
      : [],
    // Real per-product volume breaks, ordered by minQty server-side.
    priceTiers: Array.isArray(tiers)
      ? tiers
          .map((t) => ({ minQty: t.minQty, maxQty: t.maxQty ?? null, pricePerUnit: t.pricePerUnit }))
          .sort((a, b) => a.minQty - b.minQty)
      : [],
  }
}

interface CategoryChip {
  id: string
  name: string
  slug: string
  productCount: number
}

export function SearchResultsPage() {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem, syncWithApi } = useCartStore()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const pageParams = storeParams || {}
  const paramQuery = pageParams.query || pageParams.search || ''

  const [query, setQuery] = useState(paramQuery)
  const [activeSearch, setActiveSearch] = useState(paramQuery)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryChip[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(10)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Deep-link / in-place navigation with a new query must re-run the search.
  useEffect(() => {
    if (paramQuery !== activeSearch) {
      setQuery(paramQuery)
      setActiveSearch(paramQuery)
    }
  }, [paramQuery])

  useEffect(() => {
    let mounted = true
    const fetchResults = async () => {
      if (!activeSearch.trim()) {
        // Honest state: an empty search box searches nothing — show the
        // prompt instead of pretending the whole catalog is "results".
        setProducts([])
        setLoadError(null)
        setErrorStatus(null)
        return
      }
      setLoading(true)
      setLoadError(null)
      setErrorStatus(null)
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch(`/api/products?search=${encodeURIComponent(activeSearch.trim())}&limit=20&page=1`),
          fetch('/api/categories'),
        ])

        if (prodRes.ok) {
          const prodData = await prodRes.json()
          const items = Array.isArray(prodData?.data) ? prodData.data.map(normalizeProduct) : []
          if (mounted) {
            setProducts(items)
            setVisibleCount(10)
            setPage(1)
            const pag = prodData?.pagination
            setHasMore(pag ? pag.page < pag.totalPages : false)
          }
        } else {
          if (mounted) {
            setLoadError(`Product search failed (${prodRes.status}). Try again.`)
            setErrorStatus(prodRes.status)
            setProducts([])
          }
        }

        if (catRes.ok) {
          const catData = await catRes.json()
          const cats = Array.isArray(catData?.data) ? catData.data : []
          if (mounted) {
            setCategories(
              cats.map((c: Record<string, unknown>) => ({
                id: (c.id as string) ?? '',
                name: (c.name as string) ?? '',
                slug: (c.slug as string) ?? '',
                productCount: (c.productCount as number) ?? 0,
              }))
            )
          }
        }
      } catch {
        if (mounted) {
          setLoadError('Could not reach the product service. Check your connection and try again.')
          setProducts([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchResults()
    return () => { mounted = false }
  }, [activeSearch, retryToken])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveSearch(query.trim())
  }

  const handleAddToCart = useCallback(async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    if (addingId) return
    setAddingId(product.id)
    try {
      // Canonical pricing at the wholesale default quantity (MOQ):
      // covering tier at qty, else base price — mirrors resolveUnitPrice.
      const unitPrice = resolveClientUnitPrice({
        basePrice: product.basePrice,
        variantPriceOverride: null,
        priceTiers: product.priceTiers,
        quantity: product.moq,
      })
      addItem({
        id: `cart-${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.imageUrls[0] || product.thumbnailUrl || null,
        variantId: null,
        variantName: null,
        variantValue: null,
        quantity: product.moq,
        unitPrice,
        totalPrice: unitPrice * product.moq,
        moq: product.moq,
        maxOrderQty: product.maxOrderQty,
        supplierId: product.supplierId,
        supplierName: product.supplierName,
        // supplierProfiles has no slug column — honest empty, never invented.
        supplierSlug: '',
        unit: product.unit,
        priceTiers: product.priceTiers,
        basePrice: product.basePrice,
        variantPriceOverride: null,
      })
      // One server sync so authenticated buyers see the cart the API priced.
      const authStorage = typeof window !== 'undefined'
        ? JSON.parse(window.localStorage.getItem('b2b-auth-storage') || '{}')
        : null
      const buyerId = authStorage?.state?.user?.id
      if (buyerId) void syncWithApi(buyerId)
      toast.success('Added to cart', {
        description: `${product.moq.toLocaleString()} ${product.unit} of ${product.name} at ${formatPrice(unitPrice)}/${product.unit}`,
      })
    } finally {
      setAddingId(null)
    }
  }, [addItem, addingId, formatPrice, syncWithApi])

  const handleToggleWishlist = useCallback((e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    toggleItem({
      id: product.id,
      name: product.name,
      price: product.basePrice,
      originalPrice: product.basePrice,
      moq: product.moq,
      unit: product.unit,
      supplier: product.supplierName,
      location: '',
      category: '',
      customizable: false
    })
  }, [toggleItem])

  const visibleProducts = useMemo(() => products.slice(0, visibleCount), [products, visibleCount])

  const hasQuery = activeSearch.trim().length > 0

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
      {/* Search Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:px-6">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center md:max-w-3xl md:mx-auto">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, categories..."
            aria-label="Search wholesale products"
            className="pl-10 pr-4 h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus-visible:ring-primary"
          />
        </form>
      </header>

      {/* Related Categories — real counts from GET /api/categories */}
      {categories.length > 0 && (
        <section className="px-4 py-4 md:px-6 md:max-w-5xl mx-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
            Browse Categories
          </h3>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            {categories.slice(0, 8).map((c, i) => (
              <button
                key={c.id || c.slug || i}
                onClick={() => navigate('category-products', { category: c.slug })}
                className="flex flex-col items-center justify-center min-h-11 p-3 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all min-w-[96px] shrink-0"
              >
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center line-clamp-1">
                  {c.name}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">
                  {c.productCount.toLocaleString()} products
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Results */}
      <main className="px-4 pt-2 md:px-6 md:max-w-5xl md:mx-auto md:w-full md:pt-4">
        {hasQuery && !loading && !loadError && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Products ({products.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              for &ldquo;<span className="font-semibold text-slate-800 dark:text-slate-200">{activeSearch}</span>&rdquo;
            </p>
          </div>
        )}

        {/* Idle state — nothing searched yet */}
        {!hasQuery && !loading ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Search className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Search wholesale products</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
              Type a product, brand, or SKU above. Every result shows unit, MOQ, and volume-tier savings.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 flex gap-3">
                <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-5 w-24 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <AlertTriangle className="h-12 w-12 mx-auto text-primary mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{loadError}</h3>
            {errorStatus ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">HTTP {errorStatus} from /api/products</p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 min-h-11 text-xs font-semibold text-primary border-primary"
              onClick={() => setRetryToken((t) => t + 1)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No results found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
              We couldn&apos;t find any products matching &ldquo;{activeSearch}&rdquo;. Try another term or browse categories.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 min-h-11 text-xs font-semibold text-primary border-primary"
              onClick={() => navigate('category-browser')}
            >
              Browse All Categories
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleProducts.map((product) => {
              const inWish = isInWishlist(product.id)
              // Real wholesale identity: the actual tier range of THIS product.
              const bestTier = product.priceTiers.length > 0
                ? product.priceTiers.reduce((best, t) => (t.pricePerUnit < best.pricePerUnit ? t : best))
                : null
              const lowPrice = bestTier ? bestTier.pricePerUnit : product.basePrice
              const savingsPercent = bestTier && product.basePrice > 0
                ? Math.round(((product.basePrice - bestTier.pricePerUnit) / product.basePrice) * 100)
                : 0
              const outOfStock = product.stockQuantity <= 0

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate('product-detail', { productId: product.id })}
                  className="relative bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-3 shadow-2xs hover:shadow-md transition-all flex gap-3.5 cursor-pointer items-start"
                >
                  {/* Thumbnail */}
                  <div className="relative w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-900 shrink-0 overflow-hidden">
                    {product.imageUrls[0] || product.thumbnailUrl ? (
                      <img
                        src={product.imageUrls[0] || product.thumbnailUrl || ''}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="h-8 w-8" />
                      </div>
                    )}
                    {outOfStock && (
                      <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white text-[9px] font-black uppercase tracking-wider text-center py-0.5">
                        Out of stock
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 pr-14">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                      {product.name}
                    </h4>
                    {product.sku ? (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">SKU: {product.sku}</p>
                    ) : null}
                    {product.supplierName ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                        {product.supplierName}
                      </p>
                    ) : null}

                    <div className="mt-2">
                      <div className="text-sm font-black text-primary">
                        {bestTier && savingsPercent > 0
                          ? `${formatPrice(lowPrice)} – ${formatPrice(product.basePrice)}`
                          : formatPrice(product.basePrice)}
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400"> /{product.unit}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-900 rounded-md px-1.5 py-0.5">
                          MOQ {product.moq.toLocaleString()} {product.unit}
                        </span>
                        {bestTier && savingsPercent > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5">
                            <Tag className="h-2.5 w-2.5" />
                            Save {savingsPercent}% at {bestTier.minQty.toLocaleString()}+ {product.unit}
                          </span>
                        )}
                        {product.soldCount > 0 && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                            {product.soldCount.toLocaleString()} sold
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions — 44px touch targets */}
                  <button
                    onClick={(e) => handleToggleWishlist(e, product)}
                    aria-label={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
                    className="absolute top-2 right-2 h-11 w-11 flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
                  >
                    <Heart className={`h-4 w-4 ${inWish ? 'fill-primary text-primary' : ''}`} />
                  </button>

                  <button
                    onClick={(e) => handleAddToCart(e, product)}
                    disabled={addingId === product.id || outOfStock}
                    aria-label={`Add ${product.moq} ${product.unit} to cart`}
                    title={outOfStock ? 'Out of stock' : `Add MOQ (${product.moq} ${product.unit}) to cart`}
                    className="absolute bottom-2 right-2 h-11 w-11 flex items-center justify-center rounded-full bg-red-50 text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Load More Results — fetches the next page from the API (was previously just slicing local state) */}
        {!loading && !loadError && (visibleCount < products.length || hasMore) && (
          <div className="mt-6 text-center">
            <button
              onClick={async () => {
                // First expand local visibility (cheaper than a network round-trip)
                if (visibleCount < products.length) {
                  setVisibleCount((c) => c + 10)
                  return
                }
                // When local buffer is exhausted, fetch the next page from the API.
                if (!hasMore || loadingMore) return
                setLoadingMore(true)
                try {
                  const nextPage = page + 1
                  const res = await fetch(`/api/products?search=${encodeURIComponent(activeSearch.trim())}&limit=20&page=${nextPage}`)
                  if (res.ok) {
                    const json = await res.json()
                    const items = Array.isArray(json?.data) ? json.data.map(normalizeProduct) : []
                    setProducts((prev) => [...prev, ...items])
                    setVisibleCount((c) => c + items.length)
                    setPage(nextPage)
                    const pag = json?.pagination
                    setHasMore(pag ? pag.page < pag.totalPages : false)
                  }
                } catch {
                  // best-effort — keep what we have
                } finally {
                  setLoadingMore(false)
                }
              }}
              disabled={loadingMore}
              className="text-xs font-bold text-primary hover:underline py-3 px-4 rounded-full min-h-11 disabled:opacity-50"
            >
              {loadingMore
                ? 'Loading...'
                : hasMore
                  ? `Load More Results (page ${page + 1})`
                  : `Show all ${products.length} results`}
            </button>
          </div>
        )}

        {/* Sign-in hint for cart sync — cart persistence requires a buyer account */}
        {!loading && !loadError && products.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
            <LogIn className="h-3 w-3" />
            Sign in as a buyer to keep your cart across devices.
          </div>
        )}
      </main>
    </div>
  )
}

export default SearchResultsPage
