'use client'

/**
 * Bulk Pricing Calculator — REAL product data only (t187-d).
 *
 * Requires a product context (pageParams.productId | id). With none, it
 * renders an honest "select a product" empty state — it NEVER picks a random
 * product, invents a tier ladder, or fabricates a name/SKU/supplier/stock.
 * Everything shown (base price, tiers, supplier, stock, unit) comes from
 * GET /api/products/[id]; discount percentages are computed from the REAL
 * tier prices vs basePrice. No "Ships Tomorrow" claim (the API has no such
 * field). Add-to-cart carries the real tier price + real priceTiers so
 * checkout math agrees with this calculator.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { PageLoader } from '@/components/ui/page-loader'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { toast } from 'sonner'
import {
  QrCode, Bell, ShoppingCart, FileText,
  ShieldCheck, Lock, Package, ArrowDownRight,
  PackageSearch, AlertTriangle, RefreshCw
} from 'lucide-react'

interface ApiPriceTier {
  id: string
  minQty: number
  maxQty: number | null
  pricePerUnit: number
}

interface ApiProduct {
  id: string
  name: string
  slug: string
  sku: string | null
  basePrice: number
  unit: string
  bundleSize: number | null
  moq: number
  maxOrderQty: number | null
  stockQuantity: number
  thumbnailUrl: string | null
  weightKg: number | null
  supplier: { id: string; companyName: string; verificationStatus: string | null }
  images: { imageUrl: string; sortOrder: number }[]
  priceTiers: ApiPriceTier[]
}

type LoadState = 'loading' | 'ready' | 'no-product' | 'not-found' | 'error'

// A display row: real tier data + the discount derived from basePrice.
interface TierRow {
  key: string
  label: string
  minQty: number
  maxQty: number | null
  price: number
  discountPercent: number
  isBase: boolean
}

export function BulkPricingPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || pageParams.id || ''

  const [quantity, setQuantity] = useState(1)
  const [product, setProduct] = useState<ApiProduct | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let mounted = true
    if (!productId) {
      setProduct(null)
      setLoadState('no-product')
      return
    }
    const fetchProduct = async () => {
      setLoadState('loading')
      setErrorMsg('')
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(productId)}`)
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (res.ok && json?.success && json.data) {
          setProduct(json.data as ApiProduct)
          setLoadState('ready')
          // Start the calculator at the product's REAL minimum order quantity.
          setQuantity(Math.max(1, Math.floor(json.data.moq) || 1))
        } else if (res.status === 404) {
          setProduct(null)
          setLoadState('not-found')
        } else {
          setProduct(null)
          setErrorMsg(json?.error || `Request failed (${res.status})`)
          setLoadState('error')
        }
      } catch {
        if (!mounted) return
        setProduct(null)
        setErrorMsg('Network error — could not reach the product service.')
        setLoadState('error')
      }
    }

    fetchProduct()
    return () => { mounted = false }
  }, [productId])

  const isBundle = (product?.bundleSize ?? null) != null && (product?.bundleSize ?? 0) > 1
  const unitLabel = isBundle ? 'bundle' : (product?.unit || 'pcs')
  const basePrice = product?.basePrice ?? 0

  // Display rows built ONLY from the real tier ladder (ordered by minQty).
  // discountPercent is derived: how far the REAL tier price sits below base.
  const tierRows: TierRow[] = useMemo(() => {
    if (!product) return []
    const sorted = [...(product.priceTiers || [])].sort((a, b) => a.minQty - b.minQty)
    const rows: TierRow[] = []
    const firstMin = sorted[0]?.minQty
    if (firstMin == null || firstMin > 1) {
      rows.push({
        key: 'base',
        label: firstMin != null ? `1 - ${Math.max(1, Math.floor(firstMin) - 1)}` : 'Any quantity',
        minQty: 1,
        maxQty: firstMin != null ? firstMin - 1 : null,
        price: product.basePrice,
        discountPercent: 0,
        isBase: true,
      })
    }
    for (const t of sorted) {
      const pct = product.basePrice > 0
        ? Math.max(0, Math.round(((product.basePrice - t.pricePerUnit) / product.basePrice) * 100))
        : 0
      rows.push({
        key: t.id,
        label: t.maxQty != null ? `${t.minQty} - ${t.maxQty}` : `${t.minQty}+`,
        minQty: t.minQty,
        maxQty: t.maxQty,
        price: t.pricePerUnit,
        discountPercent: pct,
        isBase: false,
      })
    }
    return rows
  }, [product])

  // Same resolution rule as the PDP pricing engine: base price unless a real
  // tier covers the current quantity. No invented ladder — if the product has
  // no tiers, the price is simply the base price at every quantity.
  const activeTier = useMemo(() => {
    if (!product) return null
    return tierRows.find(
      (t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)
    ) || tierRows[0] || null
  }, [product, tierRows, quantity])

  const unitPrice = activeTier?.price ?? basePrice
  const baseSubtotal = basePrice * quantity
  const volumePrice = unitPrice * quantity
  const savings = baseSubtotal - volumePrice

  const handleAddToCart = useCallback(() => {
    if (!product || !activeTier) return
    addItem({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.thumbnailUrl || product.images?.[0]?.imageUrl || null,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity,
      unitPrice: activeTier.price,
      totalPrice: activeTier.price * quantity,
      moq: product.moq,
      maxOrderQty: product.maxOrderQty,
      supplierId: product.supplier?.id || '',
      supplierName: product.supplier?.companyName || '',
      // supplierProfiles has no slug column — honest empty, never invented.
      supplierSlug: '',
      unit: product.unit,
      bundleSize: product.bundleSize ?? null,
      weightKg: product.weightKg ?? null,
      priceTiers: (product.priceTiers || []).map((t) => ({
        minQty: t.minQty,
        maxQty: t.maxQty,
        pricePerUnit: t.pricePerUnit,
      })),
      basePrice: product.basePrice,
    })
    toast.success(`Added ${quantity.toLocaleString()} ${unitLabel} of ${product.name} to cart`)
    navigate('cart')
  }, [product, activeTier, quantity, unitLabel, addItem, navigate])

  const browseProducts = () => navigate('product-catalog')

  // ─── Page-level states: loading / no product / not found / error ──────────
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
            Select a product to see its bulk pricing — every calculator is tied to one real listing and its live tier ladder.
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
            This listing may have been removed or is no longer available, so there is no bulk pricing to calculate.
          </p>
          <Button onClick={browseProducts} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs px-6">
            Browse Products
          </Button>
        </div>
      </div>
    )
  }

  if (loadState === 'error' || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-3xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-slate-100">Couldn&apos;t load bulk pricing</h1>
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

  const supplierVerified = product.supplier?.verificationStatus === 'approved'
  const productImage = product.thumbnailUrl || product.images?.[0]?.imageUrl || null

  // Slider bounds derive from the REAL moq — never below it (min>max would
  // break the control for high-MOQ listings).
  const sliderMin = Math.max(1, Math.floor(product.moq) || 1)
  const sliderMax = Math.max(sliderMin + 10, 1200)

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700 dark:text-slate-300" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button onClick={() => navigate("notifications")} className="p-1 text-slate-700 dark:text-slate-300" title="Notifications" aria-label="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4 md:max-w-3xl lg:max-w-4xl md:py-6 md:space-y-6">
        {/* Title & SKU */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Bulk Pricing Calculator
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            Adjust quantity to see real-time volume discounts for {product.name}
            {product.sku ? ` (SKU: ${product.sku})` : ''}.
          </p>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-md">
              In Stock: {Math.floor(product.stockQuantity).toLocaleString()}
            </span>
            {product.moq > 1 && (
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-md">
                MOQ: {Math.floor(product.moq).toLocaleString()} {unitLabel}
              </span>
            )}
          </div>
        </div>

        {/* Product Snippet */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-3 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
            {productImage ? (
              <img src={productImage} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{product.name}</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Supplier: {product.supplier?.companyName || 'Unknown supplier'}
              {supplierVerified ? ' • Verified Supplier' : ''}
            </p>
            <p className="text-xs font-bold text-primary mt-1">
              Base Price: {formatPrice(product.basePrice)} / {unitLabel}
            </p>
          </div>
        </div>

        {/* Quantity Selector Slider */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Select Quantity</span>
            <div className="bg-primary text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span>{quantity.toLocaleString()} {isBundle ? 'Bundles' : 'Units'}</span>
            </div>
          </div>

          <Slider
            value={[Math.min(quantity, sliderMax)]}
            min={sliderMin}
            max={sliderMax}
            step={1}
            onValueChange={([val]) => setQuantity(val)}
            className="py-2"
          />

          <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold px-1">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span key={f}>
                {Math.round(sliderMin + (sliderMax - sliderMin) * f).toLocaleString()}
              </span>
            ))}
          </div>

          {/* Current Tier Result Box */}
          {activeTier && (
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                {activeTier.isBase ? 'BASE PRICE (NO TIER AT THIS QUANTITY)' : `CURRENT TIER: ${activeTier.label} ${unitLabel}`}
              </span>
              <div className="text-xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                {formatPrice(activeTier.price)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {unitLabel}</span>
              </div>
              {activeTier.discountPercent > 0 && (
                <div className="text-xs font-bold text-primary flex items-center justify-center gap-1">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>DISCOUNT APPLIED: {activeTier.discountPercent}% OFF BASE</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Volume Discount Tiers Table — real tiers only */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Volume Discount Tiers</h3>
            {tierRows.length <= 1 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                This product has no volume tiers configured — the base price applies at every quantity.
              </p>
            )}
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                <th className="p-3">Quantity</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3">Discount</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {tierRows.map((t) => {
                const isActive = activeTier?.key === t.key
                return (
                  <tr
                    key={t.key}
                    className={`transition-colors ${
                      isActive ? 'bg-rose-50/60 dark:bg-rose-950/40 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <td className="p-3">{t.label}</td>
                    <td className="p-3">{formatPrice(t.price)}</td>
                    <td className="p-3 text-primary">
                      {t.discountPercent > 0 ? `${t.discountPercent}% OFF` : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {isActive ? (
                        <Badge className="bg-primary text-white border-none text-[9px] font-bold px-2 py-0.5 rounded-full">
                          Active
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border-2 border-rose-100 dark:border-rose-900/60 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Order Summary</h3>

          <div className="space-y-2 text-xs divide-y divide-slate-50 dark:divide-slate-800">
            <div className="flex justify-between py-1 text-slate-500 dark:text-slate-400">
              <span>Base Price (1 {unitLabel})</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(basePrice)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-500 dark:text-slate-400">
              <span>Quantity</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{quantity.toLocaleString()} {unitLabel}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-500 dark:text-slate-400">
              <span>Subtotal (Base)</span>
              <span className="line-through text-slate-400 dark:text-slate-500">{formatPrice(baseSubtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm font-black text-primary">
              <span>Volume Price</span>
              <span>{formatPrice(volumePrice)}</span>
            </div>
          </div>

          {/* Total Savings Highlight — computed from the REAL base vs tier price */}
          {savings > 0 && (
            <div className="bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-black uppercase text-primary tracking-wider block">
                Total Savings
              </span>
              <div className="text-lg font-black text-primary mt-0.5">
                {formatPrice(savings)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">vs. buying {quantity.toLocaleString()} {unitLabel} at the base price.</p>
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handleAddToCart}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('product-detail', { productId: product.id })}
              className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Request Formal Quote
            </Button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="space-y-2 pt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Trade Assurance protects your orders.</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span>Secure payment processing.</span>
          </div>
        </div>
      </main>
    </div>
  )
}

export default BulkPricingPage
