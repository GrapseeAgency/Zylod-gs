'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, Search, ShoppingCart,
  CheckCircle2, AlertCircle, Package, Info, RefreshCw, Layers
} from 'lucide-react'

interface ProductImage {
  imageUrl?: string
  url?: string
}

interface ProductData {
  id: string
  name: string
  slug?: string
  sku?: string | null
  description?: string | null
  basePrice?: number
  unit?: string
  moq?: number
  stockQuantity?: number
  thumbnailUrl?: string | null
  images?: ProductImage[]
  supplier?: { id: string; companyName: string } | null
}

interface VariantData {
  id: string
  variantName: string
  variantValue: string
  sku: string | null
  stockQuantity: number
  effectivePrice: number
  isAvailable: boolean
}

export function ProductVariantsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''

  const [activeFilter, setActiveFilter] = useState<'all' | 'instock'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<ProductData | null>(null)
  const [variants, setVariants] = useState<VariantData[]>([])
  const [summary, setSummary] = useState<{ totalVariants: number; availableVariants: number } | null>(null)

  const fetchData = useCallback(async () => {
    if (!productId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [prodRes, varRes] = await Promise.all([
        fetch(`/api/products/${productId}`),
        fetch(`/api/products/${productId}/variants`),
      ])

      const prodData = await prodRes.json().catch(() => null)
      if (!prodRes.ok) {
        setError(prodData?.error || `Failed to load product (${prodRes.status})`)
        setProduct(null)
        setVariants([])
        return
      }
      const p: ProductData = prodData?.data
      setProduct(p || null)

      const varData = await varRes.json().catch(() => null)
      if (!varRes.ok) {
        // Product exists but variants endpoint failed — show product without variants
        setVariants([])
        setSummary(null)
      } else {
        setVariants(Array.isArray(varData?.data?.variants) ? varData.data.variants : [])
        setSummary(varData?.data?.summary || null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading product variants')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (activeFilter === 'instock') return v.isAvailable
      return true
    })
  }, [variants, activeFilter])

  const productImage = product
    ? product.images?.[0]?.imageUrl || product.images?.[0]?.url || product.thumbnailUrl || null
    : null

  const handleAddToCart = useCallback((v: VariantData) => {
    if (!product) return
    const quantity = Math.max(product.moq || 1, 1)
    addItem({
      id: `cart-${product.id}-${v.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug || pageParams.slug || product.id,
      productImage: productImage,
      variantId: v.id,
      variantName: v.variantName,
      variantValue: v.variantValue,
      quantity,
      unitPrice: v.effectivePrice,
      totalPrice: v.effectivePrice * quantity,
      moq: product.moq || 1,
      maxOrderQty: null,
      supplierId: product.supplier?.id || '',
      supplierName: product.supplier?.companyName || '',
      supplierSlug: '',
      unit: product.unit || 'pcs',
      priceTiers: [],
    })
    navigate('cart')
  }, [product, productImage, addItem, navigate, pageParams.slug])

  /* ─── No product selected — honest state ─── */
  if (!productId) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
          <span className="text-lg font-black tracking-tight text-primary">Zylod</span>
        </header>
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            <Layers className="h-9 w-9 text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900">No product selected</h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Variants are listed per product. Open a product to see its real, live variants.
          </p>
          <Button
            onClick={() => navigate('explore')}
            className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md"
          >
            Explore Products
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={goBack} className="md:hidden p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-bold text-slate-900 truncate">
              {loading ? 'Product Variants' : product?.name || 'Product Variants'}
            </h1>
          </div>
          <button className="p-1 text-slate-700 hover:text-slate-900">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-4xl md:px-6 md:py-8 md:space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-2xs flex flex-col items-start gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900">Couldn&apos;t load this product</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={fetchData}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-white text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3.5">
              <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-slate-200 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Main Product Card */}
        {!loading && !error && product && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
            <div className="relative aspect-[16/9] rounded-2xl bg-gray-100 dark:bg-gray-800 overflow-hidden border border-slate-100">
              {productImage ? (
                <img src={productImage} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 w-full h-full">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
              )}
            </div>

            <div>
              {product.sku && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <Package className="h-3 w-3 text-slate-500" />
                  SKU: {product.sku}
                </span>
              )}
              <h2 className="text-base font-black text-slate-900 mt-1 leading-snug">
                {product.name}
              </h2>
              {product.description && (
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {product.description}
                </p>
              )}

              <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-black text-primary">
                  From {formatPrice(product.basePrice || 0)} / {product.unit || 'pcs'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  MOQ: {product.moq || 1}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate('product-detail', { productId: product.id })}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
            >
              <Package className="h-4 w-4" />
              View Full Product Details
            </Button>
          </div>
        )}

        {/* Quick Filters — real counts only */}
        {!loading && !error && product && variants.length > 0 && summary && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <span className="text-xs font-bold text-slate-700 shrink-0">Quick Filters:</span>
              {[
                { key: 'all' as const, label: `All Variants (${summary.totalVariants})` },
                { key: 'instock' as const, label: `In Stock Only (${summary.availableVariants})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeFilter === tab.key
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Info className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Prices and stock come live from the supplier&apos;s listings.</span>
            </div>
          </div>
        )}

        {/* Empty variants — honest */}
        {!loading && !error && product && variants.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Layers className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">No variants configured</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              This product doesn&apos;t have any variants set up yet. Check the full product page for
              current pricing and availability.
            </p>
            <Button
              onClick={() => navigate('product-detail', { productId: product.id })}
              className="mt-5 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md"
            >
              View Product
            </Button>
          </div>
        )}

        {/* Variant Cards List */}
        {!loading && !error && filteredVariants.length > 0 && (
          <div className="space-y-3">
            {filteredVariants.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3"
              >
                {/* Variant Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-slate-900 truncate">
                      {v.variantName}: {v.variantValue}
                    </h3>
                    {v.sku && <p className="text-[11px] text-slate-400 font-medium">SKU: {v.sku}</p>}
                  </div>

                  {v.isAvailable ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      {v.stockQuantity.toLocaleString()} in stock
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <AlertCircle className="h-3 w-3" />
                      Out of stock
                    </Badge>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                  <span className="text-sm font-black text-primary">
                    {formatPrice(v.effectivePrice)}{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      / {product?.unit || 'pcs'}
                    </span>
                  </span>

                  <Button
                    onClick={() => handleAddToCart(v)}
                    disabled={!v.isAvailable}
                    className={`h-8 px-4 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-none transition-colors border ${
                      v.isAvailable
                        ? 'bg-slate-100 hover:bg-primary text-slate-800 hover:text-white border-slate-200'
                        : 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="h-3 w-3" />
                    {v.isAvailable ? 'Add' : 'Unavailable'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default ProductVariantsPage
