'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCartStore, type CartItemData } from '@/store/cart-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useWishlistStore } from '@/store/wishlist-store'
import { toast } from 'sonner'
import { useRealtimeRoom, type RealtimeRoomMessage } from '@/hooks/use-realtime-room'
import { BackInStockButton } from '@/components/shared/back-in-stock-button'
import {
  ChevronLeft, Share2, ShoppingCart, Heart, Star, Truck, Store, MapPin,
  Circle, Clock, Package, Navigation, Minus, Plus, ChevronRight, QrCode,
  MessageCircle, CheckCircle2, AlertCircle,
} from 'lucide-react'

/* ─── Material Symbols Helper ─── */
function MaterialIcon({ name, className = '', size = 18, fill = false }: { name: string; className?: string; size?: number; fill?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  )
}

/* ─── Task 55-c bundle display helpers (decimal-safe, never parseInt) ─── */
function formatQty(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** Money with visible decimals: formatPrice rounds BDT to whole takas — a real ≈৳8.5/pc must not become ৳9. */
function formatMoneyPrecise(amountBDT: number, formatPrice: (n: number) => string, currencySymbol: string): string {
  const rounded = Math.round(amountBDT * 100) / 100
  if (Number.isInteger(rounded)) return formatPrice(rounded)
  return `${currencySymbol}${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ─── Types matching GET /api/products/[id] ─── */
interface ApiProduct {
  id: string; name: string; slug: string; description: string | null; brand: string | null
  unit: string; bundleSize: number | null; basePrice: number; moq: number; maxOrderQty: number | null
  stockQuantity: number; stockAlertThreshold: number | null; thumbnailUrl: string | null; ratingAvg: number; reviewCount: number
  soldCount: number; isCustomizable: boolean; createdAt: string
  category: { id: string; name: string; slug: string; parentId: string | null }
  supplier: { id: string; companyName: string; slug: string; city: string; ratingAvg: number; ratingCount: number; verificationStatus: string }
  images: { id: string; imageUrl: string; sortOrder: number }[]
  priceTiers: { id: string; minQty: number; maxQty: number | null; pricePerUnit: number }[]
  variants: { id: string; variantName: string; variantValue: string; stockQuantity: number; priceOverride: number | null }[]
  videos: { id: string; videoUrl: string; thumbnailUrl: string | null; title: string | null; sortOrder: number }[]
  reviews: {
    id: string; rating: number; comment: string | null; images: string[]; verifiedPurchase: boolean; createdAt: string
    buyer: { id: string; buyerProfile: { fullName: string | null } | null }
    replies: { id: string; rating: number; comment: string | null; createdAt: string; buyer: { id: string; buyerProfile: { fullName: string | null } | null } }[]
  }[]
}

/* ─── Tab Types ─── */
type TabId = 'details' | 'specifications' | 'shipping' | 'reviews'

/* Task 57-b: the urgent 'Only X left' threshold is the SELLER-tuned
   products.stockAlertThreshold (schema column); null falls back to this
   platform default (same value the desktop PDP uses). */
const LOW_STOCK_THRESHOLD_DEFAULT = 5

/* Task 68-b: with more variants than this, the chips become a horizontal
   snap strip (the wrap layout would stack 3+ rows and push the buy actions
   below the fold on a phone). */
const VARIANT_SCROLL_THRESHOLD = 6

/* ─── Component ─── */

export function MobileProductDetailPage() {
  const { pageParams, goBack, navigate } = useNavigationStore()
  const { addItem, getItemCount } = useCartStore()
  const { formatPrice, getCurrencyInfo } = useCurrencyStore()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const [activeTab, setActiveTab] = useState<TabId>('details')
  const [justAdded, setJustAdded] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(50)
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<ApiProduct | null>(null)
  const [specifications, setSpecifications] = useState<Record<string, string>>({})
  // Task 67-a: the selected variant — the mobile PDP previously had NO variant
  // selector at all (variant stock pushes were ignored, the restock CTA stayed
  // product-level, cart lines carried null variants). Now at full parity with
  // the desktop PDP's semantics.
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const productId = pageParams?.productId || pageParams?.slug || ''

  useEffect(() => {
    if (!productId) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/products/${productId}`)
        const json = await res.json()
        if (json.success && json.data) {
          setProduct(json.data as ApiProduct)
          setQuantity(json.data.moq || 50)
          setSelectedVariantId(null) // a fresh product load resets the choice
          // Fetch specifications
          try {
            const specRes = await fetch(`/api/products/${productId}/specifications`)
            const specJson = await specRes.json()
            if (specJson.success && specJson.data?.groupedSpecifications) {
              const flat: Record<string, string> = {}
              for (const [, items] of Object.entries(specJson.data.groupedSpecifications)) {
                for (const spec of items as { specName: string; specValue: string }[]) {
                  flat[spec.specName] = spec.specValue
                }
              }
              setSpecifications(flat)
            }
          } catch { /* specs optional */ }
        }
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    })()
  }, [productId])

  // ─── Real-time live stock (Task 56-c): PUBLIC product room — no token,
  // joined only while this page is mounted (the hook connects on mount,
  // disconnects on unmount). The canonical 'product:stock' event carries the
  // server's persisted after-values; only validated payloads are applied and
  // malformed ones are ignored silently. A down socket degrades gracefully:
  // the Live badge hides and the HTTP-fetched stock simply stays on screen —
  // no console errors, no crash.
  const [liveStockAt, setLiveStockAt] = useState<number | null>(null)
  const liveHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRealtimeEvent = useCallback(
    (msg: RealtimeRoomMessage) => {
      if (msg.event !== 'product:stock' && msg.event !== 'inventory:updated') return
      const d = msg.data as Record<string, unknown> | null
      if (!d || typeof d !== 'object' || Array.isArray(d)) return
      if (typeof d.productId !== 'string' || d.productId !== productId) return
      const stock = d.stockQuantity
      if (typeof stock !== 'number' || !Number.isFinite(stock) || stock < 0) return
      // Task 67-a: a variant-scoped push updates THAT variant's row only
      // (mirrors the desktop handler) — it never lies about product-level stock.
      const variantId =
        typeof d.variantId === 'string' && d.variantId.length > 0 ? d.variantId : null
      const soldCount =
        typeof d.soldCount === 'number' && Number.isFinite(d.soldCount) && d.soldCount >= 0
          ? d.soldCount
          : null
      setProduct((prev) => {
        if (!prev) return prev
        if (variantId) {
          return {
            ...prev,
            variants: prev.variants.map((v) =>
              v.id === variantId ? { ...v, stockQuantity: stock } : v
            ),
          }
        }
        return { ...prev, stockQuantity: stock, ...(soldCount != null ? { soldCount } : {}) }
      })
      setLiveStockAt(Date.now())
      if (liveHideTimerRef.current) clearTimeout(liveHideTimerRef.current)
      liveHideTimerRef.current = setTimeout(() => setLiveStockAt(null), 4_000)
    },
    [productId]
  )

  // `connected` drives the subtle Live pulse badge; false (socket down /
  // connecting) simply hides it — static stock remains, nothing breaks.
  const { connected: liveConnected } = useRealtimeRoom(
    productId ? `product:${productId}` : '',
    { onEvent: handleRealtimeEvent }
  )

  useEffect(
    () => () => {
      if (liveHideTimerRef.current) clearTimeout(liveHideTimerRef.current)
    },
    []
  )

  // Determine the active price tier
  const activeTier = useMemo(() => {
    if (!product || !product.priceTiers?.length) return null
    const tiers = product.priceTiers
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (quantity >= tiers[i].minQty) return tiers[i]
    }
    return tiers[0]
  }, [quantity, product])

  const isWishlisted = product ? isInWishlist(product.id) : false
  const cartItemCount = getItemCount()

  // ─── Task 67-a: selected variant derivations (mirrors the desktop PDP) ───
  const selectedVariant = useMemo(() => (
    selectedVariantId && product?.variants
      ? product.variants.find(v => v.id === selectedVariantId) ?? null
      : null
  ), [product, selectedVariantId])
  const selectedVariantLabel = selectedVariant
    ? `${selectedVariant.variantName}: ${selectedVariant.variantValue}`.replace(/\s+/g, ' ').trim()
    : null
  const currentVariantStock = useMemo(() => {
    if (selectedVariantId && product?.variants) {
      const variant = product.variants.find(v => v.id === selectedVariantId)
      if (variant) return variant.stockQuantity
    }
    return product?.stockQuantity || 0
  }, [product, selectedVariantId])

  // Task 55-c bundle semantics (display depth only — price stays per bundle).
  const bundleSize = product?.bundleSize ?? null
  const isBundle = bundleSize != null && bundleSize > 1
  const priceUnitLabel = isBundle ? 'bundle' : (product?.unit || 'pcs')
  // CANONICAL WHOLESALE PRICING RULE (same as desktop): a variant with
  // priceOverride is priced individually (tiers do NOT apply); otherwise the
  // tier matching the current quantity applies; otherwise base price.
  const currentPrice = selectedVariant?.priceOverride != null
    ? selectedVariant.priceOverride
    : (activeTier?.pricePerUnit || product?.basePrice || 0)
  const effectivePerUnit = isBundle && bundleSize ? currentPrice / bundleSize : currentPrice
  // The strip's urgency thresholds ride the product's own setting.
  const stockAlertThreshold = product?.stockAlertThreshold ?? LOW_STOCK_THRESHOLD_DEFAULT

  const handleAddToCart = useCallback(() => {
    if (!product) return
    // Task 67-a: ordering a selected variant with zero stock stays impossible.
    if (currentVariantStock === 0) {
      toast.error(selectedVariantLabel ? `${selectedVariantLabel} is out of stock` : 'Out of stock', {
        description: selectedVariantLabel
          ? `Pick another option or set a restock watch for ${selectedVariantLabel}.`
          : 'Set a restock watch to be notified when it returns.',
      })
      return
    }
    // Variant-aware cart dedupe check (the store itself merges per
    // productId::variantId — this toast mirrors that same key).
    const keyOf = (i: Pick<CartItemData, 'productId' | 'variantId'>) => `${i.productId}::${i.variantId ?? null}`
    const alreadyInCart = useCartStore.getState().items.some((i) => keyOf(i) === keyOf({ productId: product.id, variantId: selectedVariantId }))
    const item: CartItemData = {
      id: `cart-${product.id}-${selectedVariantId || 'default'}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.thumbnailUrl,
      variantId: selectedVariantId,
      variantName: selectedVariant?.variantName || null,
      variantValue: selectedVariant?.variantValue || null,
      quantity,
      unitPrice: currentPrice,
      totalPrice: currentPrice * quantity,
      moq: product.moq,
      // Honest cap: the selected variant's own stock (equals product stock
      // when no variant is chosen) — not the whole product row.
      maxOrderQty: currentVariantStock,
      supplierId: product.supplier.id,
      supplierName: product.supplier.companyName,
      supplierSlug: product.supplier.companyName.toLowerCase().replace(/\s+/g, '-'),
      unit: product.unit,
      bundleSize: product.bundleSize ?? null,
      priceTiers: product.priceTiers?.map(t => ({ minQty: t.minQty, maxQty: t.maxQty, pricePerUnit: t.pricePerUnit })) || [],
    }
    addItem(item)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2000)
    if (alreadyInCart) {
      toast.info('Already in your cart', { description: `${selectedVariantLabel ? `${selectedVariantLabel} — ` : ''}${product.name} — quantity updated to ${item.quantity}` })
    } else {
      toast.success('Added to cart', { description: selectedVariantLabel ? `${product.name} — ${selectedVariantLabel}` : product.name })
    }
  }, [product, quantity, selectedVariantId, selectedVariant, selectedVariantLabel, currentPrice, currentVariantStock, activeTier, addItem])

  const handleBuyNow = useCallback(() => {
    if (currentVariantStock === 0 || quantity < (product?.moq || 1)) return
    handleAddToCart()
    navigate('cart')
  }, [handleAddToCart, navigate, currentVariantStock, quantity, product])

  const handleToggleWishlist = useCallback(() => {
    if (!product) return
    toggleItem({
      id: product.id,
      name: product.name,
      price: product.basePrice,
      originalPrice: product.basePrice,
      moq: product.moq,
      unit: product.unit,
      supplier: product.supplier.companyName,
      location: product.supplier.city || '—',
      category: product.category?.name || '',
      customizable: product.isCustomizable,
    })
  }, [product, toggleItem])

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity(prev => Math.max(product?.moq || 50, prev + delta))
  }, [product])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-3">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Product not found</p>
          <Button size="sm" variant="outline" onClick={() => navigate('home')}>Go Home</Button>
        </div>
      </div>
    )
  }

  const hasImage = product.images?.[0]?.imageUrl && !product.images[0].imageUrl.startsWith('/placeholder')
  const productImages = product.images?.map(i => i.imageUrl) || (product.thumbnailUrl ? [product.thumbnailUrl] : [])
  const specEntries = Object.entries(specifications)

  const tabs: { id: TabId; label: string }[] = [
    { id: 'details', label: 'Product Details' },
    { id: 'specifications', label: specEntries.length > 0 ? 'Specifications' : 'Details' },
    { id: 'shipping', label: 'Shipping' },
    { id: 'reviews', label: `Reviews (${product.reviewCount || product.reviews?.length || 0})` },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      {/* ─── 1. Fixed Header ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 h-12 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <button onClick={goBack} className="flex items-center justify-center w-9 h-9 rounded-full active:bg-gray-100 transition-colors" aria-label="Go back">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Product Details</h1>
        <div className="flex items-center gap-0.5">
          <button className="flex items-center justify-center w-8 h-8 rounded-full active:bg-gray-100 transition-colors" aria-label="Share">
            <Share2 className="w-[17px] h-[17px] text-foreground" />
          </button>
          <button className="flex items-center justify-center w-8 h-8 rounded-full active:bg-gray-100 transition-colors" aria-label="QR Code">
            <QrCode className="w-[17px] h-[17px] text-foreground" />
          </button>
          <button onClick={() => navigate('cart')} className="relative flex items-center justify-center w-8 h-8 rounded-full active:bg-gray-100 transition-colors" aria-label="Cart">
            <ShoppingCart className="w-[17px] h-[17px] text-foreground" />
            {cartItemCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 bg-[#E53935] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="h-12" />

      {/* ─── 2. Hero Image ─── */}
      <div className="relative bg-white">
        <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
          {hasImage ? (
            <Image
              src={productImages[currentImageIndex] || productImages[0]}
              alt={product.name}
              fill
              className="object-contain p-4"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <Package className="w-16 h-16 text-gray-300" />
            </div>
          )}
        </div>
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.isCustomizable && (
            <Badge className="bg-white text-foreground text-[10px] px-2 py-0.5 rounded-md border border-gray-200 shadow-sm">
              Customizable
            </Badge>
          )}
        </div>
        {productImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {productImages.map((_, i) => (
              <button key={i} onClick={() => setCurrentImageIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? 'bg-[#E53935] w-4' : 'bg-gray-300'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── 3. Product Info ─── */}
      <div className="bg-white mt-2 px-4 pt-4 pb-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-lg font-bold text-foreground leading-snug">{product.name}</h2>
          <button onClick={handleToggleWishlist} className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-transform" aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
            <Heart className={`w-5 h-5 transition-colors ${isWishlisted ? 'fill-[#E53935] text-[#E53935]' : 'text-gray-400'}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(product.ratingAvg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{product.ratingAvg} ({product.reviewCount} reviews)</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">{product.soldCount >= 1000 ? `${(product.soldCount / 1000).toFixed(1)}k` : product.soldCount} sold</span>
        </div>

        {/* Task 55-c: main price + bundle semantics (the mobile page previously had no main price row) */}
        <div className="mt-3">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl font-bold text-[#E53935]">{formatPrice(currentPrice)}</span>
            <span className="text-xs text-muted-foreground">/ {priceUnitLabel}</span>
            {isBundle && (
              <span className="text-[10px] font-medium text-[#E53935] bg-[#E53935]/5 border border-[#E53935]/30 rounded px-1.5 py-0.5">
                1 bundle = {formatQty(bundleSize ?? 0)} {product.unit === 'bundle' ? 'pcs' : product.unit}
              </span>
            )}
          </div>
          {isBundle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ≈ {formatMoneyPrecise(effectivePerUnit, formatPrice, getCurrencyInfo().symbol)} / {product.unit === 'bundle' ? 'pc' : product.unit} — you pay per bundle of {formatQty(bundleSize ?? 0)}
            </p>
          )}
        </div>

        {/* Task 56-c: live stock status strip — always visible, non-intrusive.
            Live pulse while the socket is connected, an 'Updated live' flash
            right after a push, an urgent amber 'Only X left' at/below the
            low-stock threshold and a red 'Out of stock' chip at zero.
            Task 67-a: with a variant selected, the strip reports THAT
            variant's stock (its own OOS/urgency state), never the product
            row's number — the same honesty rule as the desktop page. */}
        <div className="mt-3 flex items-center gap-2 flex-wrap" aria-live="polite">
          {liveConnected && liveStockAt === null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
          {liveStockAt !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Stock updated live
            </span>
          )}
          {currentVariantStock <= 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              <Package className="w-3 h-3" />
              {selectedVariant ? `${selectedVariantLabel} — Out of stock` : 'Out of stock'}
            </span>
          ) : currentVariantStock <= stockAlertThreshold ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 animate-pulse">
              <AlertCircle className="w-3 h-3" />
              Only {formatQty(currentVariantStock)} {product.unit} left{selectedVariant ? ` (${selectedVariantLabel})` : ''}
            </span>
          ) : selectedVariant ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-foreground">
              <Package className="w-3 h-3" />
              {selectedVariantLabel}: {formatQty(currentVariantStock)} {product.unit} available
            </span>
          ) : null}
        </div>

        {/* ─── Task 67-a: variant selector (mobile parity with the desktop PDP).
            Mirrors the desktop semantics exactly: OOS variants stay SELECTABLE
            (picking one is how the buyer reaches the per-variant restock
            watch), ordering stays impossible via the button guards below. */}
        {product.variants && product.variants.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Select Variant
              {product.variants.length > VARIANT_SCROLL_THRESHOLD && (
                <span className="ml-2 normal-case font-normal text-[10px] text-muted-foreground">swipe for more →</span>
              )}
            </h3>
            {product.variants.length > VARIANT_SCROLL_THRESHOLD ? (
              /* Task 68-b: many variants — a horizontal snap strip keeps the
                 buy actions above the fold; the half-cut next chip is the
                 scroll affordance. Few variants keep the wrap layout. */
              <div
                className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
                role="listbox"
                aria-label="Product variants"
              >
                {product.variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id
                  const label = `${variant.variantName}: ${variant.variantValue}`.replace(/\s+/g, ' ').trim()
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(isSelected ? null : variant.id)}
                      role="option"
                      aria-selected={isSelected}
                      className={`shrink-0 snap-start whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.98] ${
                        isSelected
                          ? 'border-[#E53935] bg-[#E53935] text-white'
                          : 'border-gray-300 bg-white text-foreground active:bg-gray-50'
                      } ${variant.stockQuantity === 0 && !isSelected ? 'opacity-80' : ''}`}
                    >
                      {label}
                      {variant.priceOverride != null && (
                        <span className="ml-1">({formatPrice(variant.priceOverride)})</span>
                      )}
                      {variant.stockQuantity === 0 && (
                        <span className={`ml-1 text-[10px] ${isSelected ? 'text-white/90' : 'text-red-600'}`}>(Out of stock)</span>
                      )}
                      {variant.stockQuantity > 0 && variant.stockQuantity <= stockAlertThreshold && (
                        <span className={`ml-1 text-[10px] ${isSelected ? 'text-white/90' : 'text-amber-600'}`}>(Only {formatQty(variant.stockQuantity)} left)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" role="listbox" aria-label="Product variants">
                {product.variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id
                  const label = `${variant.variantName}: ${variant.variantValue}`.replace(/\s+/g, ' ').trim()
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(isSelected ? null : variant.id)}
                      role="option"
                      aria-selected={isSelected}
                      className={`max-w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.98] ${
                        isSelected
                          ? 'border-[#E53935] bg-[#E53935] text-white'
                          : 'border-gray-300 bg-white text-foreground active:bg-gray-50'
                      } ${variant.stockQuantity === 0 && !isSelected ? 'opacity-80' : ''}`}
                    >
                      <span className="truncate">{label}</span>
                      {variant.priceOverride != null && (
                        <span className="ml-1">({formatPrice(variant.priceOverride)})</span>
                      )}
                      {variant.stockQuantity === 0 && (
                        <span className={`ml-1 text-[10px] ${isSelected ? 'text-white/90' : 'text-red-600'}`}>(Out of stock)</span>
                      )}
                      {variant.stockQuantity > 0 && variant.stockQuantity <= stockAlertThreshold && (
                        <span className={`ml-1 text-[10px] ${isSelected ? 'text-white/90' : 'text-amber-600'}`}>(Only {formatQty(variant.stockQuantity)} left)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Task 61 + 65 + 67-a: out-of-stock restock watch — now variant-aware
            on mobile too: the product row at zero watches the WHOLE product;
            the product in stock with the SELECTED variant at zero watches that
            exact variant. Renders only when something watchable is out. */}
        <BackInStockButton
          productId={product.id}
          productName={product.name}
          stockQuantity={product.stockQuantity}
          variantId={selectedVariant?.id ?? null}
          variantLabel={selectedVariantLabel}
          variantStock={selectedVariant ? currentVariantStock : null}
          className="w-full h-11 mt-3"
          onRequireLogin={() => {
            toast('Sign in to get a restock alert for this product')
            navigate('login')
          }}
          onSubscribed={() =>
            toast(selectedVariant && product.stockQuantity > 0
              ? `Restock watch set — we'll notify you when ${selectedVariantLabel} of ${product.name} is back`
              : `Restock watch set — we'll notify you when ${product.name} is back`)
          }
        />

        {/* Tiered Pricing */}
        {product.priceTiers && product.priceTiers.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tiered Pricing</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Quantity</th>
                    <th className="text-right px-3 py-2 font-medium">Price / {priceUnitLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {product.priceTiers.map((tier, i) => {
                    const isActive = quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)
                    const discountPercent = product.basePrice > 0
                      ? Math.round((1 - tier.pricePerUnit / product.basePrice) * 100)
                      : 0
                    return (
                      <tr key={i} className={`border-t border-gray-100 ${isActive ? 'bg-[#E53935]/5' : 'bg-white'}`}>
                        <td className="px-3 py-2.5 text-foreground">
                          {formatQty(tier.minQty)}{tier.maxQty === null ? '+' : `-${formatQty(tier.maxQty)}`} {isBundle ? 'bundles' : product.unit}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-semibold text-foreground">{formatPrice(tier.pricePerUnit)}</span>
                          {discountPercent > 0 && (
                            <span className="ml-1.5 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                              {discountPercent}% OFF
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Product Videos (only when the supplier uploaded real ones) ─── */}
        {product.videos && product.videos.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Product Videos</h3>
            <div className="space-y-3">
              {product.videos.map((video) => (
                <div key={video.id}>
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    poster={video.thumbnailUrl || undefined}
                    src={video.videoUrl}
                    className="w-full aspect-video bg-gray-100 rounded-lg"
                    aria-label={video.title || `Product video for ${product.name}`}
                  />
                  {video.title && <p className="text-[11px] text-muted-foreground mt-1">{video.title}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quantity Selector */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Quantity (MOQ: {product.moq})</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => handleQuantityChange(-10)} className="w-8 h-8 flex items-center justify-center text-foreground active:bg-gray-100 transition-colors" aria-label="Decrease">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-12 h-8 flex items-center justify-center text-sm font-semibold text-foreground border-x border-gray-200">{quantity}</span>
            <button onClick={() => handleQuantityChange(10)} className="w-8 h-8 flex items-center justify-center text-foreground active:bg-gray-100 transition-colors" aria-label="Increase">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{product.unit}</span>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          {/* Message supplier — chat about this product */}
          {product?.supplier?.id && (
            <button
              onClick={() => navigate('chat-detail', { conversationId: product.supplier.id })}
              className="w-full h-9 flex items-center justify-center gap-1.5 rounded-lg border border-[#E53935]/30 bg-[#E53935]/5 text-xs font-semibold text-[#E53935] active:bg-[#E53935]/10 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Message Supplier
            </button>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1 h-10 border-[#E53935] text-[#E53935] hover:bg-[#E53935]/5 text-sm font-semibold disabled:opacity-50"
              onClick={handleAddToCart}
              disabled={currentVariantStock === 0}
            >
              {justAdded ? (
                <><CheckCircle2 className="w-4 h-4 mr-1.5" />In Cart ✓</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-1.5" />Add to Cart</>
              )}
            </Button>
            <Button
              className="flex-[1.5] h-10 bg-[#E53935] hover:bg-[#E53935]/90 text-white text-sm font-semibold disabled:opacity-50"
              onClick={handleBuyNow}
              disabled={currentVariantStock === 0 || quantity < product.moq}
            >
              Buy Now
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 4. Tabs ─── */}
      <div className="bg-white mt-2">
        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative flex-shrink-0 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'text-[#E53935]' : 'text-muted-foreground'}`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#E53935] rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-4">
          <AnimatePresence mode="wait">
            {activeTab === 'details' && (
              <motion.div key="details" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <p className="text-sm text-muted-foreground leading-relaxed">{product.description || 'No description available.'}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className={`text-[10px] uppercase tracking-wide ${product.stockQuantity <= 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {product.stockQuantity <= 0 ? 'Out of Stock' : 'In Stock'}
                    </p>
                    <p className={`text-sm font-semibold mt-0.5 ${
                      product.stockQuantity <= 0
                        ? 'text-red-600'
                        : product.stockQuantity <= (product.stockAlertThreshold ?? LOW_STOCK_THRESHOLD_DEFAULT)
                          ? 'text-amber-600'
                          : 'text-foreground'
                    }`}>
                      {formatQty(product.stockQuantity)} {product.unit}
                    </p>
                    {liveStockAt !== null && product.stockQuantity > 0 && (
                      <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                        <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
                        Updated live
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Min. Order</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{product.moq} {product.unit}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'specifications' && (
              <motion.div key="specifications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {specEntries.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {specEntries.map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2.5">
                        <span className="text-xs text-muted-foreground">{key}</span>
                        <span className="text-xs font-medium text-foreground text-right max-w-[60%]">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No specifications available.</p>
                )}
              </motion.div>
            )}

            {activeTab === 'shipping' && (
              <motion.div key="shipping" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="text-center py-8 space-y-2">
                  <Truck className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Shipping Information</p>
                  <p className="text-xs text-muted-foreground">Delivery details will be available after placing an order.</p>
                  <p className="text-xs text-muted-foreground mt-2">Supplier: {product.supplier.companyName}</p>
                  {product.supplier.city && <p className="text-xs text-muted-foreground">Location: {product.supplier.city}</p>}
                </div>
              </motion.div>
            )}

            {activeTab === 'reviews' && (
              <motion.div key="reviews" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{product.ratingAvg}</p>
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < Math.floor(product.ratingAvg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{product.reviewCount} reviews</p>
                  </div>
                </div>
                <Separator className="mb-3" />
                <div className="space-y-3">
                  {(product.reviews || []).length > 0 ? (
                    product.reviews.map(review => (
                      <div key={review.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#E53935]/10 text-[#E53935] flex items-center justify-center text-xs font-bold">
                            {(review.buyer?.buyerProfile?.fullName || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-foreground">{review.buyer?.buyerProfile?.fullName || 'Anonymous'}</p>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-2.5 h-2.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                              ))}
                              <span className="text-[10px] text-muted-foreground ml-1">{new Date(review.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        {review.images && review.images.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {review.images.map((img, i) => (
                               
                              <img key={i} src={img} alt="review" className="h-14 w-14 object-cover rounded-lg" />
                            ))}
                          </div>
                        )}
                        {review.comment && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{review.comment}</p>}
                        {review.verifiedPurchase && <p className="text-[10px] text-green-600 mt-1">✓ Verified purchase</p>}
                        {review.replies?.length > 0 && review.replies.map(reply => (
                          <div key={reply.id} className="ml-6 mt-2 p-2 bg-white rounded-lg border border-gray-100">
                            <p className="text-[10px] font-medium text-foreground">{reply.buyer?.buyerProfile?.fullName || 'Seller'} replied:</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{reply.comment}</p>
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <Star className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">No reviews yet. Be the first to review this product!</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── 5. Supplier Section ─── */}
      <div className="bg-white mt-2 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#E53935]/10 flex items-center justify-center">
            <Store className="w-5 h-5 text-[#E53935]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground truncate">{product.supplier.companyName}</p>
              {product.supplier.verificationStatus === 'approved' && (
                <MaterialIcon name="verified" size={16} className="text-green-600" fill />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">{product.supplier.city || '—'}</p>
          </div>
          <Button variant="outline" size="sm" className="text-[#E53935] border-[#E53935] hover:bg-[#E53935]/5 text-xs h-7"
            onClick={() => navigate('supplier-profile', { supplierId: product.supplier.id })}>
            Visit Store
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-foreground">{product.supplier.ratingAvg}</p>
            <p className="text-[10px] text-muted-foreground">Rating</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-foreground">{product.supplier.ratingCount}</p>
            <p className="text-[10px] text-muted-foreground">Reviews</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs font-bold text-foreground">{product.reviewCount}</p>
            <p className="text-[10px] text-muted-foreground">Products</p>
          </div>
        </div>
      </div>

      <div className="h-4" />
    </div>
  )
}