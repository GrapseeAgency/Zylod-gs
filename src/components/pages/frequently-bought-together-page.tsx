'use client'

/**
 * Frequently Bought Together — REAL related-products data only (t187-d).
 *
 * Consumes GET /api/products/[id]/frequently-bought (the same endpoint the
 * PDP's RelatedProductsRail uses) for the companion items, plus
 * GET /api/products/[id] for the current product. If the endpoint returns no
 * companion products, the page shows an honest empty state — it NEVER falls
 * back to an invented bundle, invented photos, or an invented bundle
 * discount. Total = the sum of the real prices (no modeled % off), and cart
 * lines carry each item's REAL supplier id/name.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoader } from '@/components/ui/page-loader'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { toast } from 'sonner'
import {
  ArrowLeft, Bell, ShoppingCart, Package, PackageSearch, AlertTriangle, RefreshCw
} from 'lucide-react'

interface RelatedProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  currency: string
  unit: string | null
  moq: number | null
  stock: number
  image: string | null
  supplier: { id: string; companyName: string; verificationStatus: string | null }
  reason: string
}

interface CurrentProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  unit: string
  moq: number
  maxOrderQty: number | null
  bundleSize: number | null
  weightKg: number | null
  thumbnailUrl: string | null
  images: { imageUrl: string; sortOrder: number }[]
  supplier: { id: string; companyName: string; verificationStatus: string | null }
  priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
}

interface BundleItem {
  id: string
  name: string
  price: number
  moq: number
  unit: string
  image: string | null
  supplierId: string
  supplierName: string
  isCurrent?: boolean
  selected: boolean
}

type LoadState = 'loading' | 'ready' | 'no-product' | 'not-found' | 'error'

export function FrequentlyBoughtTogetherPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || pageParams.id || ''

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [currentProduct, setCurrentProduct] = useState<CurrentProduct | null>(null)
  const [related, setRelated] = useState<RelatedProduct[]>([])
  const [note, setNote] = useState<string | undefined>(undefined)
  const [items, setItems] = useState<BundleItem[]>([])

  useEffect(() => {
    let mounted = true
    if (!productId) {
      setLoadState('no-product')
      return
    }
    const fetchBundle = async () => {
      setLoadState('loading')
      setErrorMsg('')
      try {
        const [currentRes, relatedRes] = await Promise.all([
          fetch(`/api/products/${encodeURIComponent(productId)}`),
          fetch(`/api/products/${encodeURIComponent(productId)}/frequently-bought?limit=4`),
        ])
        if (!mounted) return

        if (currentRes.status === 404) {
          setLoadState('not-found')
          return
        }
        const currentJson = await currentRes.json().catch(() => null)
        const relatedJson = await relatedRes.json().catch(() => null)

        if (!currentRes.ok || !currentJson?.success || !currentJson.data) {
          setLoadState('error')
          setErrorMsg(currentJson?.error || `Request failed (${currentRes.status})`)
          return
        }
        if (!relatedRes.ok || !relatedJson?.success) {
          setLoadState('error')
          setErrorMsg(relatedJson?.error || `Request failed (${relatedRes.status})`)
          return
        }

        const cp = currentJson.data as CurrentProduct
        const relatedList: RelatedProduct[] = Array.isArray(relatedJson.data?.related)
          ? relatedJson.data.related
          : []

        if (!mounted) return
        setCurrentProduct(cp)
        setRelated(relatedList)
        setNote(relatedJson.data?.note)

        const bundleItems: BundleItem[] = [
          {
            id: cp.id,
            name: cp.name,
            price: cp.basePrice,
            moq: Math.max(1, Math.floor(cp.moq) || 1),
            unit: cp.unit || 'pcs',
            image: cp.thumbnailUrl || cp.images?.[0]?.imageUrl || null,
            supplierId: cp.supplier?.id || '',
            supplierName: cp.supplier?.companyName || '',
            isCurrent: true,
            selected: true,
          },
          ...relatedList.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.basePrice,
            moq: Math.max(1, Math.floor(p.moq ?? 1) || 1),
            unit: p.unit || 'pcs',
            image: p.image || null,
            supplierId: p.supplier?.id || '',
            supplierName: p.supplier?.companyName || '',
            selected: true,
          })),
        ]
        setItems(bundleItems)
        setLoadState('ready')
      } catch {
        if (!mounted) return
        setLoadState('error')
        setErrorMsg('Network error — could not reach the product service.')
      }
    }

    fetchBundle()
    return () => { mounted = false }
  }, [productId])

  const toggleSelect = (id: string) => {
    // The current product is the anchor of the bundle — companions toggle.
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && !item.isCurrent ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const selectedItems = useMemo(() => items.filter((i) => i.selected), [items])
  // Honest math: the total is the plain sum of the real prices at each
  // item's MOQ. No invented bundle-percentage discount exists on Zylod.
  const totalBundlePrice = useMemo(
    () => selectedItems.reduce((acc, i) => acc + i.price * i.moq, 0),
    [selectedItems]
  )

  const handleAddBundleToCart = useCallback(() => {
    if (!currentProduct) return
    selectedItems.forEach((item) => {
      addItem({
        id: `cart-${item.id}-${Date.now()}`,
        productId: item.id,
        productName: item.name,
        productSlug: item.isCurrent ? currentProduct.slug : (related.find((r) => r.id === item.id)?.slug || item.id),
        productImage: item.image,
        variantId: null,
        variantName: null,
        variantValue: null,
        quantity: item.moq,
        unitPrice: item.price,
        totalPrice: item.price * item.moq,
        moq: item.moq,
        maxOrderQty: item.isCurrent ? currentProduct.maxOrderQty : null,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        // supplierProfiles has no slug column — honest empty, never invented.
        supplierSlug: '',
        unit: item.unit,
        bundleSize: item.isCurrent ? currentProduct.bundleSize ?? null : null,
        weightKg: item.isCurrent ? currentProduct.weightKg ?? null : null,
        priceTiers: item.isCurrent
          ? (currentProduct.priceTiers || []).map((t) => ({
              minQty: t.minQty,
              maxQty: t.maxQty,
              pricePerUnit: t.pricePerUnit,
            }))
          : [],
        basePrice: item.price,
      })
    })
    toast.success(`${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} added to cart`)
    navigate('cart')
  }, [currentProduct, related, selectedItems, addItem, navigate])

  const browseProducts = () => navigate('product-catalog')

  // ─── Page-level states: loading / no product / not found / error / empty ──
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <PageLoader />
      </div>
    )
  }

  if (loadState === 'no-product') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto">
            <PackageSearch className="h-7 w-7 text-slate-400 dark:text-slate-500" />
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-slate-100">No product selected</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Open a product first — bundles are built from that product&apos;s real companion listings.
          </p>
          <Button onClick={browseProducts} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs px-6">
            Browse Products
          </Button>
        </div>
      </div>
    )
  }

  if (loadState === 'not-found') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto">
            <PackageSearch className="h-7 w-7 text-slate-400 dark:text-slate-500" />
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-slate-100">Product not found</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This listing may have been removed or is no longer available, so there is no bundle to build.
          </p>
          <Button onClick={browseProducts} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs px-6">
            Browse Products
          </Button>
        </div>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-3xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-slate-100">Couldn&apos;t load this bundle</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{errorMsg || 'Something went wrong on our side. Please try again.'}</p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="h-11 rounded-2xl text-xs font-bold border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
            <Button onClick={browseProducts} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs px-6">
              Browse Products
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Honest empty state — the real endpoint found NO companion products for
  // this listing. Never render an invented bundle to fill the space.
  if (items.length <= 1) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
          <div className="flex items-center justify-between">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
            <button onClick={() => navigate("notifications")} className="p-1 text-slate-700 dark:text-slate-300" title="Notifications" aria-label="Notifications">
              <Bell className="h-6 w-6" />
            </button>
          </div>
        </header>
        <main className="px-4 py-4 max-w-lg mx-auto md:max-w-5xl md:px-6 md:py-6">
          <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Frequently Bought Together
          </h1>
          <div className="mt-6 bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto">
              <PackageSearch className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              No frequently-bought bundles for this product yet
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {note || 'No other live products from this supplier or in this category yet — check back as the catalog grows.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                variant="outline"
                onClick={goBack}
                className="h-11 rounded-2xl text-xs font-bold border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300"
              >
                Go Back
              </Button>
              <Button onClick={browseProducts} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs px-6">
                Browse Products
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button onClick={() => navigate("notifications")} className="p-1 text-slate-700 dark:text-slate-300" title="Notifications" aria-label="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4 md:max-w-5xl md:px-6 md:py-6 md:space-y-5">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Frequently Bought Together
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Live companion listings for {currentProduct?.name} — from the same supplier or the same category.
          </p>
        </div>

        <div className="space-y-4 md:space-y-5 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0 lg:items-start">
        {/* Bundle Items Container */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5">
          {items.map((item, idx) => (
            <div key={item.id} className="space-y-3">
              {/* Product Preview Box — real photo, neutral icon when none */}
              <div className="relative w-full aspect-square rounded-2xl bg-slate-100 dark:bg-slate-900 overflow-hidden border border-slate-100 dark:border-slate-800">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
                {item.isCurrent && (
                  <Badge className="absolute top-3 left-3 bg-white dark:bg-gray-900 text-primary border-none font-bold text-[10px] px-2 py-0.5 rounded shadow-xs">
                    Current
                  </Badge>
                )}
              </div>

              {/* Product Meta */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                  {item.name}
                </h3>
                {item.supplierName && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {item.supplierName}
                  </p>
                )}
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-black text-primary">
                    {formatPrice(item.price)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">/ {item.unit}</span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">MOQ: {item.moq.toLocaleString()}</p>

                {/* Checkbox Trigger */}
                <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleSelect(item.id)}
                    disabled={item.isCurrent}
                    className="w-4 h-4 rounded text-primary accent-primary focus:ring-primary"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {item.isCurrent ? 'Included' : 'Add to bundle'}
                  </span>
                </label>
              </div>

              {/* Divider if not last */}
              {idx < items.length - 1 && <div className="border-b border-slate-100 dark:border-slate-800 pt-2 md:hidden" />}
            </div>
          ))}
          </div>
        </div>

        {/* Bundle Summary Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border-2 border-rose-100 dark:border-rose-900/60 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Bundle Summary</h2>

          <div className="space-y-2 text-xs divide-y divide-slate-50 dark:divide-slate-800">
            {selectedItems.map((item) => (
              <div key={item.id} className="flex justify-between py-1 text-slate-500 dark:text-slate-400">
                <span className="truncate pr-2">{item.name} × {item.moq.toLocaleString()}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                  {formatPrice(item.price * item.moq)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Total Bundle Price</span>
              <div className="text-right">
                <div className="text-xl font-black text-primary">
                  {formatPrice(totalBundlePrice)}
                </div>
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                  At each item&apos;s MOQ
                </span>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handleAddBundleToCart}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <ShoppingCart className="h-4 w-4" />
              Add {selectedItems.length} Item{selectedItems.length === 1 ? '' : 's'} to Cart
            </Button>
          </div>

          {/* Honest shipping note */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 flex items-start gap-2.5 text-[10px] text-slate-600 dark:text-slate-400">
            <Package className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Each item is fulfilled by its own supplier at that supplier&apos;s standard processing time.
            </p>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

export default FrequentlyBoughtTogetherPage
