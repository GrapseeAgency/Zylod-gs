'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageLoader } from '@/components/ui/page-loader'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel'
import { Label } from '@/components/ui/label'
import { useNavigationStore } from '@/store/navigation-store'
import { useCartStore, CartItemData } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRealtimeRoom, type RealtimeRoomMessage } from '@/hooks/use-realtime-room'
import { MobileProductDetailPage } from '@/components/mobile/mobile-product-detail-page'
import { ProductQRCodeDialog } from '@/components/shared/product-qr-code'
import { ProductShareDialog } from '@/components/shared/product-share-dialog'
import { BackInStockButton } from '@/components/shared/back-in-stock-button'
import { RelatedProductsRail } from '@/components/shared/related-products-rail'
import { SizeGuideButton } from '@/components/shared/size-guide-dialog'
import { SampleRequestDialog } from '@/components/product/sample-request-dialog'
import { ProductCertifications } from '@/components/product/product-certifications'
import { ProductQas } from '@/components/product/product-qas'
import {
  ShoppingCart, Package, Star, Heart, ChevronLeft,
  Truck, Shield, MessageSquare, Minus, Plus, ArrowRight,
  Store, Database, AlertCircle, Clock,
  MapPin, Globe, Factory, Percent,
  Tag, Phone, ChevronRight,
  Zap, CircleCheck, X,
  Building2, TrendingDown, Info,
  Navigation, User, Loader2, ExternalLink, RefreshCw, Edit,
  ShieldAlert, ShieldCheck, AlertTriangle, PackageOpen, BadgePercent,
} from 'lucide-react'

/* ─── Color Constants ─── */
const RED = '#E53935'
const GREEN = '#16A34A'

/* Order-confirmation/tracking types removed with the inline one-click order
   dialog — buying now routes through the buy-now page (auth gate + address
   selection + server-priced order) and tracking lives on track-order. */

/* ─── API types (camelCase, matching GET /api/products/[id]) ─── */

interface PriceTier {
  id: string
  minQty: number
  maxQty: number | null
  pricePerUnit: number
}

interface ProductImage {
  id: string
  imageUrl: string
  altText: string | null
  sortOrder: number
}

interface ProductVariant {
  id: string
  variantName: string
  variantValue: string
  sku: string | null
  stockQuantity: number
  priceOverride: number | null
}

interface ProductVideo {
  id: string
  videoUrl: string
  thumbnailUrl: string | null
  title: string | null
  sortOrder: number
}

/**
 * Task 80-b: an honest video player. A <video> element only plays DIRECT
 * media streams — a pasted YouTube/Drive PAGE link (or a dead file) renders
 * as a silent black box otherwise. On error the player swaps itself for the
 * truth: what failed, plus a way out (open the source in a new tab).
 */
function VideoPlayer({ video, productName }: { video: ProductVideo; productName: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="space-y-1" data-video-failed>
        <div className="w-full aspect-video bg-muted rounded-xl border border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
          <p className="text-xs font-semibold">This video can&apos;t be played in the browser player</p>
          <p className="text-[11px] text-muted-foreground">
            The link is not a direct video stream (or the file is gone).
          </p>
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-primary underline underline-offset-2"
          >
            Open the source in a new tab
          </a>
        </div>
        {video.title && <p className="text-xs text-muted-foreground">{video.title}</p>}
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <video
        controls
        preload="metadata"
        playsInline
        poster={video.thumbnailUrl || undefined}
        src={video.videoUrl}
        className="w-full aspect-video bg-muted rounded-xl object-cover"
        aria-label={video.title || `Product video for ${productName}`}
        onError={() => setFailed(true)}
      />
      {video.title && <p className="text-xs text-muted-foreground">{video.title}</p>}
    </div>
  )
}

interface ReviewData {
  id: string
  rating: number
  comment: string
  createdAt: string
  buyer: { id: string; buyerProfile: { fullName: string } }
}

interface ProductData {
  id: string
  name: string
  slug: string
  description: string | null
  brand: string | null
  unit: string
  bundleSize: number | null
  /** Task 95: kg per ONE purchasable unit — feeds the checkout courier quote. */
  weightKg: number | null
  basePrice: number
  moq: number
  maxOrderQty: number | null
  stockQuantity: number
  /** Task 57-b: seller-tuned low-stock urgency threshold (null = platform default 5). */
  stockAlertThreshold: number | null
  thumbnailUrl: string | null
  ratingAvg: number
  reviewCount: number
  isActive: boolean
  isApproved: boolean
  categoryId: string
  supplierId: string
  category: { id: string; name: string; slug: string; parentId: string | null }
  supplier: { id: string; userId: string; companyName: string; ratingAvg: number; ratingCount: number; verificationStatus: string }
  priceTiers: PriceTier[]
  images: ProductImage[]
  variants: ProductVariant[]
  videos: ProductVideo[]
  reviews: ReviewData[]
  /** Task 100: the live platform campaign pinned to this product (window filtered server-side). */
  activePromotion?: {
    id: string
    name: string
    description: string | null
    type: string
    value: number
    minOrderAmount: number | null
    maxDiscount: number | null
    validUntil: string
  } | null
  createdAt: string
}

/* ─── Helper: Stock Status ───
    Task 57-b: the threshold is the SELLER-tuned products.stockAlertThreshold
    (nullable schema column); null falls back to this platform default. */
const LOW_STOCK_THRESHOLD_DEFAULT = 5

/* ─── t187-d: one row of GET /api/delivery-methods (admin-curated couriers).
    The old block hardcoded four invented couriers on every PDP; now the rail
    renders ONLY what the admin actually configured, and renders nothing at
    all when the list is empty or the fetch fails. */
interface DeliveryMethodRow {
  id: string
  name: string
  description: string | null
  estimated_delivery: string | null
  price: number
  badge: string | null
  badge_variant: string
  icon: string
}

function getStockStatus(stock: number, maxStock: number, threshold: number = LOW_STOCK_THRESHOLD_DEFAULT) {
  const ratio = maxStock > 0 ? stock / maxStock : 0
  if (stock === 0) return { label: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-50', barColor: 'bg-red-500', urgency: false }
  if (stock <= threshold || ratio < 0.2) return { label: `Only ${formatQty(stock)} left!`, color: 'text-amber-600', bg: 'bg-amber-50', barColor: 'bg-amber-500', urgency: true }
  if (ratio < 0.5) return { label: 'Low Stock', color: 'text-yellow-600', bg: 'bg-yellow-50', barColor: 'bg-yellow-500', urgency: false }
  return { label: 'In Stock', color: 'text-green-600', bg: 'bg-green-50', barColor: 'bg-green-500', urgency: false }
}

/* ─── Task 55-c bundle display helpers ───
   Quantities are unit-bearing decimals — format with toLocaleString, never
   parseInt the decimals away (e.g. 2.5 stays 2.5). */
function formatQty(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * Money with visible decimals: formatPrice rounds BDT to whole takas, which
 * would turn a real ≈৳8.5/pc into ৳9. Integer amounts keep formatPrice;
 * fractional amounts show 2dp with the currency symbol.
 */
function formatMoneyPrecise(amountBDT: number, formatPrice: (n: number) => string, currencySymbol: string): string {
  const rounded = Math.round(amountBDT * 100) / 100
  if (Number.isInteger(rounded)) return formatPrice(rounded)
  return `${currencySymbol}${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ─── Main Component ─── */

/* ─── Mobile redirect wrapper ─── */
export function ProductDetailPage() {
  const isMobile = useIsMobile()

  if (isMobile === undefined) {
    return <PageLoader />
  }

  if (isMobile) {
    return <MobileProductDetailPage />
  }

  return <DesktopProductDetailPage />
}

/* ─── Desktop Product Detail Page (original) ─── */
function DesktopProductDetailPage() {
  const { navigate, pageParams } = useNavigationStore()
  const { addItem } = useCartStore()
  const { formatPrice, getCurrencyInfo } = useCurrencyStore()
  const { toast } = useToast()

  // State
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<ProductData | null>(null)
  const [specifications, setSpecifications] = useState<Record<string, Array<{ specName: string; specValue: string }>>>({})
  // Task 92: real certification count for the trust tab (null = not loaded yet)
  const [certCount, setCertCount] = useState<number | null>(null)
  // Task 93: real Q&A count for the ask-a-question tab (null = not loaded yet)
  const [qaCount, setQaCount] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(50)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [addedToCart, setAddedToCart] = useState(false)
  const [wishlist, setWishlist] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [quantityError, setQuantityError] = useState(false)

  // t187-d: real admin-curated delivery methods for the "Our Delivery
  // Partners" block. Platform config, not product data — fetched once.
  // Empty list or failed fetch ⇒ the block renders NOTHING (never invented
  // courier names).
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethodRow[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/delivery-methods')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.success && Array.isArray(j.data)) {
          setDeliveryMethods(j.data as DeliveryMethodRow[])
        }
      })
      .catch(() => { /* honest no-op: block stays hidden without real data */ })
    return () => { cancelled = true }
  }, [])

  // Task 90: sample rail dialog
  const [sampleOpen, setSampleOpen] = useState(false)

  // Sticky Buy Now bar visibility
  const [showStickyBar, setShowStickyBar] = useState(false)
  const buyButtonRef = useRef<HTMLDivElement | null>(null)

  const productId = pageParams.productId || pageParams.id || pageParams.slug || ''

  useEffect(() => {
    async function fetchProduct() {
      if (!productId) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/products/${productId}`)
        if (!res.ok) throw new Error('Failed to load product')
        const result = await res.json()
        if (!result.success || !result.data) throw new Error('Product not found')

        setProduct(result.data as ProductData)
        setQuantity(result.data.moq || 1)

        // Task 104: record the view server-side (browsingHistory) so the
        // Recently Viewed page reflects real browsing. Fire-and-forget: a
        // guest's POST 401s and simply leaves no server history — the rail
        // is buyer-scoped by design; a failure here must never disturb the
        // product page itself.
        fetch('/api/products/recently-viewed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productId }),
        }).catch(() => { /* buyer-scoped history is optional context, never a blocker */ })

        // Fetch detailed specifications for the Specifications tab
        const specRes = await fetch(`/api/products/${productId}/specifications`)
        if (specRes.ok) {
          const specResult = await specRes.json()
          if (specResult.success && specResult.data?.groupedSpecifications) {
            setSpecifications(specResult.data.groupedSpecifications)
          }
        }

        // Task 92: real certification count for the trust tab label
        fetch(`/api/products/${productId}/certifications`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => setCertCount(typeof j?.count === 'number' ? j.count : 0))
          .catch(() => setCertCount(0))

        // Task 93: real Q&A count for the tab label
        fetch(`/api/products/${productId}/qa`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => setQaCount(typeof j?.count === 'number' ? j.count : 0))
          .catch(() => setQaCount(0))
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [productId])

  // Sync quantity with MOQ when product changes
  const moq = product?.moq || 1
  // kg products order in 1-kg increments (min-clamped to MOQ); discrete units step by MOQ.
  const qtyStep = product?.unit === 'kg' ? 1 : moq
  useEffect(() => {
    setQuantity(moq)
  }, [moq])

  // ─── Real-time stock (Task 51-a + Task 56-c): PUBLIC product room — no
  // token needed, joined only while this page is mounted (the hook connects
  // on mount and disconnects on unmount). Two events update the stock card:
  //   inventory:updated — seller inventory quick-edits (absolute after + delta)
  //   product:stock     — canonical availability event {productId,
  //                       stockQuantity, unit, bundleSize, inStock, soldCount?}
  //                       from inventory edits, product edits, orders and RFQ
  //                       conversions
  // Only the payload's absolute fields are applied (stockQuantity is the
  // server's persisted after-value; applying delta too would double-count).
  // Malformed payloads are ignored silently; a down socket just means the
  // static HTTP-fetched stock stays on screen — never an error, never a crash.
  const [liveStockAt, setLiveStockAt] = useState<number | null>(null)
  const liveHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRealtimeEvent = useCallback(
    (msg: RealtimeRoomMessage) => {
      if (msg.event !== 'inventory:updated' && msg.event !== 'product:stock') return
      const d = msg.data as Record<string, unknown> | null
      if (!d || typeof d !== 'object' || Array.isArray(d)) return
      if (typeof d.productId !== 'string' || d.productId !== productId) return
      const stock = d.stockQuantity
      if (typeof stock !== 'number' || !Number.isFinite(stock) || stock < 0) return
      const variantId =
        typeof d.variantId === 'string' && d.variantId.length > 0 ? d.variantId : null
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
        return { ...prev, stockQuantity: stock }
      })
      setLiveStockAt(Date.now())
      if (liveHideTimerRef.current) clearTimeout(liveHideTimerRef.current)
      liveHideTimerRef.current = setTimeout(() => setLiveStockAt(null), 4_000)
    },
    [productId]
  )

  // `connected` drives the persistent Live badge; false (socket down /
  // connecting) simply hides it and leaves the last known stock on screen.
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

  // ─── Sticky Buy Now Bar: Show when main buy button is scrolled past ───
  useEffect(() => {
    const handleScroll = () => {
      if (!buyButtonRef.current) return
      const rect = buyButtonRef.current.getBoundingClientRect()
      // Show sticky bar when the buy button area is above the viewport
      setShowStickyBar(rect.bottom < 0)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Wishlist toggle handler
  const handleWishlistToggle = async () => {
    const currentProductId = product?.id || ''
    setWishlistLoading(true)
    try {
      if (wishlist) {
        // DELETE reads productId from query string (per /api/wishlist route.ts), not body.
        const res = await fetch(`/api/wishlist?productId=${encodeURIComponent(currentProductId)}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (data.success) {
          setWishlist(false)
          toast({ title: 'Removed from Wishlist', description: `${productName} removed from your wishlist` })
        } else {
          toast({ title: 'Could not remove', description: data.error || 'Please try again', variant: 'destructive' })
        }
      } else {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: currentProductId }),
        })
        const data = await res.json()
        if (data.success) {
          setWishlist(true)
          toast({ title: 'Added to Wishlist', description: `${productName} added to your wishlist` })
        }
      }
    } catch {
      // Fallback: just toggle local state
      setWishlist(!wishlist)
      toast({ title: wishlist ? 'Removed from Wishlist' : 'Added to Wishlist', description: `${productName} ${wishlist ? 'removed from' : 'added to'} your wishlist` })
    } finally {
      setWishlistLoading(false)
    }
  }

  // Current selected variant stock
  const currentVariantStock = useMemo(() => {
    if (selectedVariantId && product?.variants) {
      const variant = product.variants.find(v => v.id === selectedVariantId)
      if (variant) return variant.stockQuantity
    }
    return product?.stockQuantity || 0
  }, [product, selectedVariantId])

  // Task 65: the selected variant row itself — feeds the per-variant restock
  // watch CTA (watch THIS variant when it alone is out of stock).
  const selectedVariant = useMemo(() => (
    selectedVariantId && product?.variants
      ? product.variants.find(v => v.id === selectedVariantId) ?? null
      : null
  ), [product, selectedVariantId])
  const selectedVariantLabel = selectedVariant
    ? `${selectedVariant.variantName}: ${selectedVariant.variantValue}`.replace(/\s+/g, ' ').trim()
    : null

  // Calculate applicable price — CANONICAL WHOLESALE PRICING RULE:
  // a variant with priceOverride is priced individually (tiers do NOT
  // apply); otherwise the tier matching the current quantity applies;
  // otherwise the product's base price.
  const getApplicablePrice = () => {
    if (!product) return 0
    const selectedVariant = selectedVariantId && product.variants
      ? product.variants.find(v => v.id === selectedVariantId)
      : null
    if (selectedVariant && selectedVariant.priceOverride != null) {
      return selectedVariant.priceOverride
    }
    let price = product.basePrice
    if (product.priceTiers && product.priceTiers.length > 0) {
      for (const tier of product.priceTiers) {
        if (quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) {
          price = tier.pricePerUnit
          break
        }
      }
    }
    return price
  }

  const applicablePrice = getApplicablePrice()
  const totalPrice = applicablePrice * quantity
  const basePrice = product?.basePrice || 0
  const savingsPercent = basePrice > 0 ? Math.round(((basePrice - applicablePrice) / basePrice) * 100) : 0
  // Task 130 honest-numbers fix: the Trust tile's "Up to X% off" must state the
  // REAL maximum a buyer can reach across the WHOLE tier ladder — not the
  // savings at the current quantity, which is 0% at MOQ and made the tile
  // claim "Up to 0% off" on products whose tiers DO discount at volume.
  const maxSavingsPercent = useMemo(() => {
    if (basePrice <= 0) return 0
    let max = 0
    for (const tier of product?.priceTiers ?? []) {
      const pct = Math.round(((basePrice - tier.pricePerUnit) / basePrice) * 100)
      if (pct > max) max = pct
    }
    return max
  }, [product?.priceTiers, basePrice])
  const unit = product?.unit || 'pcs'
  // Task 55-c bundle semantics: bundleSize > 1 ⇒ the price is PER BUNDLE and
  // the effective per-unit kom-dam price is displayed next to it. Pricing
  // math itself does NOT change — display depth only.
  const bundleSize = product?.bundleSize ?? null
  const isBundle = bundleSize != null && bundleSize > 1
  const priceUnitLabel = isBundle ? 'bundle' : unit
  const effectivePerUnit = isBundle && bundleSize ? applicablePrice / bundleSize : applicablePrice
  const maxStock = product?.stockQuantity || 0
  // Task 57-b: the seller's own threshold drives the urgent state; the
  // platform default (5) applies when the seller never tuned one.
  const stockAlertThreshold = product?.stockAlertThreshold ?? LOW_STOCK_THRESHOLD_DEFAULT
  const stockStatus = getStockStatus(currentVariantStock, maxStock, stockAlertThreshold)
  const deliveryDays = currentVariantStock === 0 ? 21 : currentVariantStock < maxStock * 0.2 ? 10 : 5

  const handleAddToCart = () => {
    if (!product) return
    // t195 ACCOUNT WALL: the cart is account-scoped (server-synced, MOQ
    // enforcement, order history). A guest tapping Add to Cart gets the
    // sign-in nudge — the item is NOT stored, so no ghost cart survives a
    // later login and nothing can silently ride into checkout.
    if (!useAuthStore.getState().isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Create a Zylod account or sign in to add products to your cart.' })
      navigate('login')
      return
    }
    const selectedVariant = selectedVariantId && product.variants
      ? product.variants.find(v => v.id === selectedVariantId)
      : null

    addItem({
      id: `cart-${product.id}-${selectedVariantId || 'default'}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.thumbnailUrl,
      variantId: selectedVariantId,
      variantName: selectedVariant?.variantName || null,
      variantValue: selectedVariant?.variantValue || null,
      quantity,
      unitPrice: applicablePrice,
      totalPrice,
      moq: product.moq,
      maxOrderQty: product.maxOrderQty,
      supplierId: product.supplier.id,
      supplierName: product.supplier.companyName,
      // supplierProfiles has no slug column — honest empty, never invented.
      supplierSlug: '',
      unit: product.unit,
      // Task 55-c: bundle display depth for the cart line label.
      bundleSize: product.bundleSize ?? null,
      // Task 95: per-unit weight — checkout quotes courier rates from it.
      weightKg: product.weightKg ?? null,
      priceTiers: product.priceTiers?.map(t => ({
        minQty: t.minQty,
        maxQty: t.maxQty,
        pricePerUnit: t.pricePerUnit,
      })) || [],
    })
    setAddedToCart(true)
    toast({ title: 'Added to Cart', description: `${quantity} ${unit} of ${productName} added` })
    setTimeout(() => setAddedToCart(false), 2000)
  }

  // ─── Real chat: create (or reuse) a conversation via the chat API, then
  // navigate to it with the REAL conversation id. Never fabricates one. ───
  const [chatLoading, setChatLoading] = useState(false)
  const handleChatWithSupplier = useCallback(async () => {
    if (!product?.supplier) return
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: product.supplier.userId,
          productId: product.id,
        }),
      })
      if (res.status === 401) {
        toast({ title: 'Sign in required', description: 'Sign in to chat with this supplier.' })
        navigate('login')
        return
      }
      const data = await res.json()
      if (res.ok && data.success && data.data?.id) {
        navigate('chat-detail', { conversationId: data.data.id })
      } else {
        toast({ title: 'Chat unavailable', description: data.error || 'Could not start the conversation. Please try again.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Chat unavailable', description: 'Could not reach the chat service. Please try again.', variant: 'destructive' })
    } finally {
      setChatLoading(false)
    }
  }, [product, navigate, toast])

  // ─── Buy Now Handler ───
  // SECURITY/UX CONTRACT: buying NEVER happens inline on the PDP. The old
  // one-click handler POSTed /api/orders/create-direct with a hardcoded
  // 'cod' payment method — a real order with no login wall, no shipping
  // address and no payment step. Buying now routes through the buy-now
  // page, which enforces the buyer session (Sign in required state),
  // collects a real shipping address, and lets the server price the order
  // (client-sent prices are ignored by the API contract).
  const handleBuyNow = useCallback(() => {
    if (!product || currentVariantStock === 0 || quantity < moq) return
    navigate('buy-now', {
      productId: product.id,
      quantity: String(quantity),
    })
  }, [product, quantity, moq, currentVariantStock, navigate])

  // ─── Loading State — the standard page loader ───
  if (loading) {
    return <PageLoader />
  }

  // ─── Product Not Found ───
  if (!product) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Product not found</p>
        <p className="text-muted-foreground mb-4">The product you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Button onClick={() => navigate('home')}>Back to Home</Button>
      </motion.div>
    )
  }

  // ─── Images ───
  const realImages = product ? [
    ...(product.thumbnailUrl ? [{ id: 'thumb', imageUrl: product.thumbnailUrl, altText: product.name, sortOrder: 0 }] : []),
    ...(product.images || []).sort((a, b) => a.sortOrder - b.sortOrder),
  ] : []

  const productName = product?.name || 'Product'
  const productSlug = product?.slug || ''
  const productBrand = product?.brand || ''
  const productCategory = product?.category?.name || 'Category'
  const productRating = product?.ratingAvg || 0
  const productReviewCount = product?.reviewCount || 0
  const productDescription = product?.description || 'No description available.'
  const productSupplier = product?.supplier || null

  return (
    <div className="w-full bg-background">
      <div className="max-w-[1440px] mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => navigate('category-products')} className="hover:bg-red-50">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Products
          </Button>

      {/* Main Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Product Images ─── */}
        <div className="space-y-3">
          {realImages.length > 1 ? (
            <Carousel className="w-full">
              <CarouselContent>
                {realImages.map((img) => (
                  <CarouselItem key={img.id}>
                    <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                      {img.imageUrl ? (
                        <img src={img.imageUrl} alt={img.altText || productName} className="w-full h-full object-contain" />
                      ) : (
                        <Package className="h-24 w-24 text-muted-foreground" />
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {/* Arrows sit INSIDE the image (native pattern). shadcn's
                  default -left-12/-right-12 pokes 48px outside the carousel
                  root: at <lg the single-column layout has only ~16px of
                  container padding → a real 32px horizontal document
                  overflow at 768px. left-3/right-3 keep them inside bounds
                  on every breakpoint; tailwind-merge resolves the conflict. */}
              <CarouselPrevious className="left-3 bg-background/90 shadow-sm" />
              <CarouselNext className="right-3 bg-background/90 shadow-sm" />
            </Carousel>
          ) : (
            <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden">
              {product?.thumbnailUrl ? (
                <img src={product.thumbnailUrl} alt={productName} className="w-full h-full object-contain" />
              ) : (
                <Package className="h-24 w-24 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Thumbnail strip */}
          {realImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {realImages.slice(0, 4).map((img) => (
                <div key={img.id} className="aspect-square bg-muted rounded-lg overflow-hidden">
                  {img.imageUrl ? (
                    <img src={img.imageUrl} alt={img.altText || productName} className="w-full h-full object-contain" />
                  ) : (
                    <Package className="h-8 w-8 mx-auto text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─── Product Videos (only when the supplier uploaded real ones) ─── */}
          {product?.videos && product.videos.length > 0 && (
            <div className="pt-2 space-y-2">
              <h3 className="text-sm font-semibold">Product Videos</h3>
              <div className={`grid gap-3 ${product.videos.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                {product.videos.map((video) => (
                  <VideoPlayer key={video.id} video={video} productName={productName} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Product Info ─── */}
        <div className="space-y-4">
          {/* Title + QR/Share */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{productName}</h1>
              <button
                onClick={() => navigate('seller-storefront', { supplierId: product?.supplierId || productSupplier?.id || '' })}
                className="text-sm text-muted-foreground mt-1 hover:text-[primary] transition-colors"
              >
                Visit store: by {productSupplier?.companyName || product?.supplier?.companyName || 'Unknown Supplier'}
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ProductQRCodeDialog productId={product?.id || ''} productName={productName} />
              <ProductShareDialog productId={product?.id || ''} productName={productName} productPrice={basePrice} />
              {product && (
                <SampleRequestDialog
                  open={sampleOpen}
                  onOpenChange={setSampleOpen}
                  productId={product.id}
                  productName={productName}
                  unit={product.unit}
                  moq={product.moq}
                />
              )}
            </div>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">{productCategory}</Badge>
            {productBrand && <Badge variant="outline" className="text-xs">{productBrand}</Badge>}
            {/* Task 55-c: wholesale bundle chip — 1 purchasable bundle = N base units */}
            {isBundle && (
              <Badge variant="outline" className="text-xs border-primary/40 text-primary bg-primary/5">
                <Package className="h-3 w-3 mr-1" />
                1 bundle = {formatQty(bundleSize ?? 0)} {unit === 'bundle' ? 'pcs' : unit}
              </Badge>
            )}
            {/* Task 95: the filed shipping weight — buyers see what couriers quote against */}
            {product.weightKg != null && (
              <Badge variant="outline" className="text-xs border-slate-300 text-slate-600 dark:text-slate-400 dark:text-slate-500">
                <Truck className="h-3 w-3 mr-1" />
                {formatQty(product.weightKg)} kg per {isBundle ? 'bundle' : unit === 'pcs' ? 'pc' : unit}
              </Badge>
            )}
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-[primary] text-[primary]" />
              <span className="font-medium">{productRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({productReviewCount} reviews)</span>
            </div>
          </div>

          {/* ─── Stock Availability ─── */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${stockStatus.barColor}`} />
                  <span className={`font-medium text-sm ${stockStatus.color}`}>
                    {currentVariantStock > 0 ? `In Stock: ${formatQty(currentVariantStock)} ${unit} available` : 'Out of Stock'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {liveConnected && liveStockAt === null && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                      <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Live
                    </Badge>
                  )}
                  {liveStockAt !== null && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                      <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Live • stock updated
                    </Badge>
                  )}
                  {stockStatus.urgency && (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs animate-pulse">
                      <AlertCircle className="h-3 w-3 mr-1" /> Only {formatQty(currentVariantStock)} {unit} left!
                    </Badge>
                  )}
                </div>
              </div>
              {/* Stock progress bar (maxStock 0 → 0%, never NaN) */}
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stockStatus.barColor}`}
                  style={{ width: `${maxStock > 0 ? Math.min(100, (currentVariantStock / maxStock) * 100) : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{maxStock > 0 ? `${Math.round((currentVariantStock / maxStock) * 100)}% available` : '0% available'}</span>
                <div className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  <span>Est. delivery: {deliveryDays} business days</span>
                </div>
              </div>
            </CardContent>
          </Card>






          {/* ─── Product Variants ─── */}
          {product?.variants && product.variants.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Variant</Label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <Button
                    key={variant.id}
                    variant={selectedVariantId === variant.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedVariantId(variant.id)}
                    aria-pressed={selectedVariantId === variant.id}
                    className={`text-sm ${selectedVariantId === variant.id ? 'bg-[primary] hover:bg-[#C62828] dark:hover:bg-primary/90' : 'hover:border-[primary] hover:text-[primary]'} ${variant.stockQuantity === 0 ? 'opacity-80' : ''}`}
                  >
                    {variant.variantName}: {variant.variantValue}
                    {variant.priceOverride != null && (
                      <span className="ml-1 text-xs">({formatPrice(variant.priceOverride)})</span>
                    )}
                    {/* Task 57-b: per-variant urgency inherits the product's threshold.
                        Task 65: an OOS variant stays SELECTABLE on purpose — picking it
                        is how the buyer reaches the per-variant restock watch. Ordering
                        it stays impossible: Add to Cart / Buy Now independently disable
                        on the selected variant's stock. */}
                    {variant.stockQuantity === 0 && <span className="ml-1 text-[10px] text-red-600 dark:text-red-400">(Out of stock)</span>}
                    {variant.stockQuantity > 0 && variant.stockQuantity <= stockAlertThreshold && (
                      <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">(Only {formatQty(variant.stockQuantity)} left)</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Price tiers */}
          {product?.priceTiers && product.priceTiers.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold">
                  Price Tiers (per {priceUnitLabel})
                </CardTitle>
                <CardDescription className="text-xs">Buy more, save more — wholesale pricing</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {product.priceTiers.map((tier) => {
                    const isActive = quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)
                    return (
                      <div key={tier.id} className={`flex items-center justify-between p-2.5 rounded-lg text-sm ${
                        isActive ? 'bg-[primary]/10 border border-[primary]/30 font-medium' : 'bg-gray-50 dark:bg-gray-950'
                      }`}>
                        <span className={isActive ? 'text-[primary]' : 'text-muted-foreground'}>
                          {formatQty(tier.minQty)} - {tier.maxQty === null ? '∞' : formatQty(tier.maxQty)} {isBundle ? 'bundles' : unit}
                        </span>
                        <span className={`font-semibold ${isActive ? 'text-[primary]' : 'text-foreground'}`}>
                          {formatPrice(tier.pricePerUnit)}/{priceUnitLabel}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Current Price Display ─── */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[primary]/5 to-[primary]/10 border border-[primary]/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your price per {priceUnitLabel}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[primary]">{formatPrice(applicablePrice)}</span>
                  {savingsPercent > 0 && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      <TrendingDown className="h-3 w-3 mr-0.5" /> Save {savingsPercent}%
                    </Badge>
                  )}
                </div>
                {/* Task 55-c: effective per-unit kom-dam line (display depth only).
                    The effective price is per BASE unit inside the bundle, so the
                    label must be the base unit — for unit 'bundle' that is 'pc'. */}
                {isBundle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {formatMoneyPrecise(effectivePerUnit, formatPrice, getCurrencyInfo().symbol)} / {unit === 'bundle' ? 'pc' : unit} — you pay per bundle of {formatQty(bundleSize ?? 0)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Total ({quantity} {priceUnitLabel}{quantity === 1 ? '' : 's'})</p>
                <p className="text-xl font-bold text-foreground">{formatPrice(totalPrice)}</p>
              </div>
            </div>
          </div>

          {/* ─── Task 100: platform promotion banner (automatic at checkout) ─── */}
          {product.activePromotion && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <BadgePercent className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0 text-xs">
                <p className="font-bold text-emerald-800">
                  {product.activePromotion.name} — {' '}
                  {product.activePromotion.type === 'percentage'
                    ? `${product.activePromotion.value}% off`
                    : `৳${product.activePromotion.value.toLocaleString()} off`}
                </p>
                <p className="text-emerald-700/80 mt-0.5 leading-relaxed">
                  Applied automatically at checkout — before any coupon code. The receipt shows the exact ৳ saved.
                  {product.activePromotion.minOrderAmount != null
                    ? ` Applies from ৳${product.activePromotion.minOrderAmount.toLocaleString()} of this item.`
                    : ''}
                  {' '}Ends {new Date(product.activePromotion.validUntil).toLocaleDateString('en-GB')}.
                </p>
              </div>
            </div>
          )}

          {/* ─── Quantity Selector ─── */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-sm font-semibold shrink-0">Quantity ({unit})</Label>
              <Badge variant="secondary" className="text-xs">MOQ: {moq} {unit}</Badge>
              {/* Task 129: real size reference for garment/textile buys — lazy dialog from the live endpoint */}
              <SizeGuideButton productId={product.id} className="ml-auto h-8" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-none hover:bg-[primary]/10"
                  onClick={() => setQuantity(Math.max(moq, Math.round((quantity - qtyStep) * 100) / 100))}
                  disabled={quantity <= moq}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="number"
                  inputMode="decimal"
                  step={product?.unit === 'kg' ? 0.5 : 1}
                  value={quantity}
                  onChange={(e) => {
                    // Unit-bearing decimal: kg orders accept 2.5, 0.5 … (2 dp max).
                    const val = Math.round(parseFloat(e.target.value) * 100) / 100
                    if (isNaN(val) || val < moq) {
                      setQuantity(isNaN(val) ? 0 : val)
                      setQuantityError(isNaN(val) || val < moq)
                    } else {
                      setQuantity(val)
                      setQuantityError(false)
                    }
                  }}
                  onBlur={() => {
                    if (quantity < moq) {
                      setQuantity(moq)
                      setQuantityError(false)
                    }
                  }}
                  className={`text-lg font-semibold w-24 text-center border-x h-10 focus:outline-none focus:ring-1 ${quantityError ? 'focus:ring-red-500 border-red-300' : 'focus:ring-[primary]'}`}
                  min={moq}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-none hover:bg-[primary]/10"
                  onClick={() => setQuantity(Math.round((quantity + qtyStep) * 100) / 100)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatPrice(applicablePrice)} × {quantity} = <span className="font-semibold text-foreground">{formatPrice(totalPrice)}</span>
              </div>
            </div>
            {quantityError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Minimum order quantity is {moq} {unit}
              </p>
            )}
          </div>

          {/* ─── Action Buttons ─── */}
          <div className="space-y-3" ref={buyButtonRef}>
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 text-base font-semibold"
                size="lg"
                onClick={handleAddToCart}
                disabled={currentVariantStock === 0 || quantity < moq}
                style={{ backgroundColor: RED }}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {addedToCart ? 'Added to Cart ✓' : 'Add to Cart'}
              </Button>
              <Button
                className="flex-1 h-14 text-base font-semibold text-white"
                size="lg"
                onClick={handleBuyNow}
                disabled={currentVariantStock === 0 || quantity < moq}
                style={{ backgroundColor: GREEN }}
              >
                <Zap className="h-5 w-5 mr-2" />
                Buy Now
              </Button>
            </div>
            {/* Task 61: out-of-stock restock watch — renders only when the
                PRODUCT itself is at zero stock (the stockAlerts model is
                product-level; per-variant OOS keeps its own badge) and
                disappears on its own when live stock returns.
                Task 65: when the product still has stock but the SELECTED
                variant is at zero, the CTA becomes a watch pinned to that
                exact variant — it completes only when THAT variant restocks. */}
            {/* Task 90: the sample rail — try one before the bulk carton */}
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => setSampleOpen(true)}
            >
              <PackageOpen className="h-4 w-4 mr-2 text-primary" />
              Order a sample first
            </Button>
            <BackInStockButton
              productId={product.id}
              productName={productName}
              stockQuantity={product.stockQuantity}
              variantId={selectedVariant?.id ?? null}
              variantLabel={selectedVariantLabel}
              variantStock={selectedVariant ? currentVariantStock : null}
              className="w-full h-11"
              onRequireLogin={() => {
                toast({ title: 'Sign in required', description: 'Sign in to get a restock alert for this product.' })
                navigate('login')
              }}
              onSubscribed={() =>
                toast({
                  title: 'Restock watch set',
                  description: selectedVariant && product.stockQuantity > 0
                    ? `We'll notify you the moment ${selectedVariantLabel} of ${productName} is back.`
                    : `We'll notify you the moment ${productName} is back in stock.`,
                })
              }
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className={`h-12 flex-1 ${wishlist ? 'bg-[primary]/10 border-[primary] text-[primary]' : ''}`}
                onClick={handleWishlistToggle}
                disabled={wishlistLoading}
              >
                <Heart className={`h-5 w-5 mr-2 ${wishlist ? 'fill-[primary]' : ''}`} />
                {wishlist ? 'Wishlisted' : 'Wishlist'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 flex-1 hover:border-[primary] hover:text-[primary]"
                onClick={() => {
                  toast({ title: 'Navigating to Quote Request', description: `Requesting quote for ${productName}` })
                  navigate('quote-request', { productId: product?.id || '' })
                }}
              >
                <MessageSquare className="h-5 w-5 mr-2" /> Request Quote
              </Button>
            </div>
          </div>

          {/* ─── Supplier Info Card ─── */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-[primary]/10 flex items-center justify-center shrink-0">
                  <Factory className="h-6 w-6 text-[primary]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{productSupplier?.companyName || product?.supplier?.companyName || 'Supplier'}</h3>
                    {productSupplier?.verificationStatus === 'approved' && (
                      <Badge className="bg-primary/5 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                        <span className="material-symbols-outlined mr-0.5" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span> Verified
                      </Badge>
                    )}
                    {(productSupplier?.id || product?.supplierId) && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        ID: SUP-{(productSupplier?.id || product?.supplierId).slice(-6).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-[primary] text-[primary]" />
                      {productSupplier?.ratingAvg?.toFixed(1) || '0.0'}
                    </span>
                    {/* No city field exists on supplierProfiles — the old
                        'Bangladesh' fallback fabricated a location. Removed
                        rather than invented. */}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:border-[primary] hover:text-[primary]"
                    onClick={handleChatWithSupplier}
                    disabled={chatLoading}
                  >
                    {chatLoading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-1" />
                    )}
                    Chat
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] text-muted-foreground hover:text-red-600 h-7 px-2"
                    onClick={() => {
                      navigate('seller-storefront', { supplierId: productSupplier?.id || product?.supplierId || '' })
                    }}
                  >
                    <Store className="h-3.5 w-3.5 mr-1" /> Visit store
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] text-muted-foreground hover:text-red-600 h-7 px-2"
                    onClick={() => {
                      navigate('report-user', {
                        sellerId: productSupplier?.id || product?.supplierId || '',
                        sellerName: productSupplier?.companyName || product?.supplier?.companyName || '',
                        productId: product?.id || '',
                      })
                    }}
                  >
                    <ShieldAlert className="h-3.5 w-3.5 mr-1 text-red-500" /> Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Payment Verification Trust Banner ─── */}
          <div className="bg-gradient-to-r from-red-50/70 via-slate-50 to-orange-50/50 rounded-2xl p-3.5 border border-red-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-[11px]">Order stays UNPAID until payment is verified</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">Pay only via the bank transfer or bKash/Nagad details shown for your order — the supplier ships once Zylod verifies the payment.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-red-600">
              <button onClick={() => navigate('escrow-protection-guide')} className="hover:underline">
                Payment Rules
              </button>
              <span>•</span>
              <button onClick={() => navigate('buyer-protection-policy')} className="hover:underline">
                Return Policy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Product Details & Specs Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="details">Product Details</TabsTrigger>
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
          <TabsTrigger value="certifications">Certifications{certCount !== null ? ` (${certCount})` : ''}</TabsTrigger>
          <TabsTrigger value="qa">Q&amp;A{qaCount !== null ? ` (${qaCount})` : ''}</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({productReviewCount})</TabsTrigger>
          <TabsTrigger value="shipping">Shipping & Delivery</TabsTrigger>
        </TabsList>

        {/* ─── Details Tab ─── */}
        <TabsContent value="details">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-muted-foreground leading-relaxed">{productDescription}</p>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Unit Type</span>
                  <p className="font-medium">{unit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stock</span>
                  <p className={`font-medium ${currentVariantStock === 0 ? 'text-red-600' : ''}`}>{formatQty(currentVariantStock)} {unit}</p>
                </div>
                {productBrand && (
                  <div>
                    <span className="text-muted-foreground">Brand</span>
                    <p className="font-medium">{productBrand}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Category</span>
                  <p className="font-medium">{productCategory}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">MOQ</span>
                  <p className="font-medium">{moq} {unit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Order</span>
                  <p className="font-medium">{product?.maxOrderQty?.toLocaleString() || 'N/A'} {unit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Supplier</span>
                  <p className="font-medium">{productSupplier?.companyName || product?.supplier?.companyName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rating</span>
                  <p className="font-medium flex items-center gap-1">
                    <Star className="h-4 w-4 fill-[primary] text-[primary]" />
                    {productRating.toFixed(1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Specifications Tab ─── */}
        <TabsContent value="specifications">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              {Object.keys(specifications).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(specifications).map(([category, specs]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-foreground mb-2">{category}</h4>
                      <div className="rounded-md border bg-muted/30 divide-y">
                        {specs.map((spec, idx) => (
                          <div key={idx} className="flex px-4 py-3">
                            <span className="text-sm text-muted-foreground w-44 shrink-0">{spec.specName}</span>
                            <span className="text-sm font-medium whitespace-normal">{spec.specValue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No detailed specifications available for this product.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Certifications Tab (Task 92: the real trust rail) ─── */}
        <TabsContent value="certifications">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <ProductCertifications productId={productId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Q&A Tab (Task 93: the real pre-purchase conversation) ─── */}
        <TabsContent value="qa">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <ProductQas productId={productId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Reviews Tab ─── */}
        <TabsContent value="reviews">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              {/* Rating summary */}
              <div className="flex items-center gap-6 mb-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-[primary]">{productRating.toFixed(1)}</p>
                  <div className="flex items-center gap-0.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < Math.round(productRating) ? 'fill-[primary] text-[primary]' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{productReviewCount} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = productReviewCount > 0
                      ? Math.round(productReviewCount * (stars === 5 ? 0.55 : stars === 4 ? 0.25 : stars === 3 ? 0.12 : stars === 2 ? 0.05 : 0.03))
                      : 0
                    return (
                      <div key={stars} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-right">{stars}</span>
                        <Star className="h-3 w-3 fill-[primary] text-[primary]" />
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[primary] rounded-full"
                            style={{ width: `${productReviewCount > 0 ? (count / productReviewCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-8 text-muted-foreground">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <Separator className="mb-4" />

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Customer Reviews</h3>
                <Button size="sm" variant="outline" onClick={() => navigate('write-review', { productId })}>
                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Write a Review
                </Button>
              </div>

              {product?.reviews && product.reviews.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin">
                  {product.reviews.map((review) => (
                    <div key={review.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-[primary] text-[primary]' : 'text-gray-200'}`} />
                          ))}
                        </div>
                        <span className="font-medium text-sm">{review.buyer?.buyerProfile?.fullName || 'Anonymous'}</span>
                        <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Star className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No reviews yet. Be the first to review this product!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Shipping & Delivery Tab ─── */}
        <TabsContent value="shipping">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Delivery Estimate */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-[primary]" /> Delivery Estimate
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50">
                      <span className="material-symbols-outlined text-green-600 shrink-0 mt-0.5" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
                      <div>
                        <p className="font-medium text-sm">In Stock Orders</p>
                        <p className="text-xs text-muted-foreground">5 business days</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50">
                      <Clock className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Low Stock Orders</p>
                        <p className="text-xs text-muted-foreground">10 business days</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50">
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Out of Stock / Backorder</p>
                        <p className="text-xs text-muted-foreground">21 business days</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping & Packaging Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5 text-[primary]" /> Shipping & Packaging
                  </h3>
                  <div className="space-y-2">
                    <div className="text-center py-6">
                      <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Shipping details available after product configuration.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Order Tracking Timeline ─── */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-[primary]" /> Order Tracking Timeline
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs hover:border-[primary] hover:text-[primary]"
                    onClick={() => navigate('track-order')}
                  >
                    <Navigation className="h-3 w-3 mr-1" /> Track Your Order
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Typical order lifecycle for this product — track in real-time after purchase</p>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                  {[
                    {
                      step: 1,
                      title: 'Order Placed',
                      description: 'Order confirmed and payment processed',
                      status: 'completed',
                      date: 'Day 0',
                      icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>,
                    },
                    {
                      step: 2,
                      title: 'Processing',
                      description: 'Supplier preparing your order for production',
                      status: 'completed',
                      date: 'Day 1-2',
                      icon: <Clock className="h-4 w-4" />,
                    },
                    {
                      step: 3,
                      title: 'Quality Check',
                      description: 'Product quality inspection and verification',
                      status: 'current',
                      date: 'Day 3-4',
                      icon: <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span>,
                    },
                    {
                      step: 4,
                      title: 'Packed',
                      description: 'Order packed and ready for dispatch',
                      status: 'upcoming',
                      date: 'Day 4-5',
                      icon: <Package className="h-4 w-4" />,
                    },
                    {
                      step: 5,
                      title: 'Shipped',
                      description: 'Order dispatched from warehouse via delivery vehicle',
                      status: 'upcoming',
                      date: 'Day 5-6',
                      icon: <Truck className="h-4 w-4" />,
                    },
                    {
                      step: 6,
                      title: 'Out for Delivery',
                      description: 'Delivery person is on the way to your location',
                      status: 'upcoming',
                      date: 'Day 6-7',
                      icon: <Navigation className="h-4 w-4" />,
                    },
                    {
                      step: 7,
                      title: 'Delivered',
                      description: 'Order delivered to your location',
                      status: 'upcoming',
                      date: `Day ${deliveryDays <= 5 ? deliveryDays : deliveryDays - 2}-${deliveryDays}`,
                      icon: <CircleCheck className="h-4 w-4" />,
                    },
                  ].map((item) => (
                    <div key={item.step} className="relative flex items-start gap-4 pb-6 last:pb-0">
                      {/* Status dot */}
                      <div
                        className={`relative z-10 flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
                          item.status === 'completed'
                            ? 'bg-green-100 text-green-600'
                            : item.status === 'current'
                              ? 'bg-[primary]/10 text-[primary] ring-2 ring-[primary]/30'
                              : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {item.icon}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium text-sm ${
                            item.status === 'completed'
                              ? 'text-green-700'
                              : item.status === 'current'
                                ? 'text-[primary]'
                                : 'text-muted-foreground'
                          }`}>
                            {item.title}
                          </p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            item.status === 'completed'
                              ? 'bg-green-50 text-green-600'
                              : item.status === 'current'
                                ? 'bg-[primary]/10 text-[primary]'
                                : 'bg-gray-50 dark:bg-gray-950 text-gray-400 dark:text-gray-500'
                          }`}>
                            {item.date}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${
                          item.status === 'upcoming' ? 'text-gray-400 dark:text-gray-500' : 'text-muted-foreground'
                        }`}>
                          {item.description}
                        </p>
                        {item.status === 'current' && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-[primary] animate-pulse" />
                            <span className="text-[10px] text-[primary] font-medium">In Progress</span>
                          </div>
                        )}
                        {/* Show vehicle info hint for shipped step */}
                        {item.title === 'Shipped' && item.status !== 'upcoming' && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Truck className="h-3 w-3" />
                            <span>Vehicle & driver info will appear here</span>
                          </div>
                        )}
                        {/* Show delivery person hint for out for delivery step */}
                        {item.title === 'Out for Delivery' && item.status !== 'upcoming' && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>Delivery person details & live location</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Partners Info — t187-d: ONLY the admin-curated
                    delivery methods from /api/delivery-methods. When none are
                    configured (or the fetch fails) this block renders nothing
                    — never a hardcoded courier list. */}
                {deliveryMethods.length > 0 && (
                  <div className="mt-6 p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                      <Truck className="h-4 w-4 text-[primary]" /> Delivery Options
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {deliveryMethods.slice(0, 4).map((method) => (
                        <div key={method.id} className="text-center p-2 rounded-md bg-background">
                          <p className="font-medium text-xs">{method.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {method.description || method.estimated_delivery || '\u00A0'}
                          </p>
                          <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                            {method.price > 0 && (
                              <span className="text-[10px] font-bold">{formatPrice(method.price)}</span>
                            )}
                            {method.badge && (
                              <Badge variant="secondary" className="text-[9px]">{method.badge}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What You Get After Purchase */}
                <div className="mt-4 p-4 rounded-lg border border-dashed border-[primary]/30">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-2">
                    <Zap className="h-4 w-4 text-[primary]" /> Real-Time Tracking After Purchase
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    After you place an order with &quot;Buy Now&quot;, you&apos;ll get access to:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { icon: <Navigation className="h-3.5 w-3.5" />, text: 'Live order status updates' },
                      { icon: <Truck className="h-3.5 w-3.5" />, text: 'Delivery vehicle & driver info' },
                      { icon: <User className="h-3.5 w-3.5" />, text: 'Delivery person name & phone' },
                      { icon: <MapPin className="h-3.5 w-3.5" />, text: 'GPS location tracking' },
                      { icon: <Clock className="h-3.5 w-3.5" />, text: 'Estimated time remaining' },
                      { icon: <Phone className="h-3.5 w-3.5" />, text: 'Direct contact with delivery' },
                    ].map((feature) => (
                      <div key={feature.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-[primary]">{feature.icon}</span>
                        {feature.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Related Products Rail (Task 129: real endpoint, real source reasons — honest no-op when empty) ─── */}
      <RelatedProductsRail productId={product.id} />

      {/* ─── Trust Signals ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
          <Truck className="h-5 w-5 text-[primary] shrink-0" />
          <div>
            <p className="font-medium text-xs">Fast Delivery</p>
            <p className="text-muted-foreground text-[10px]">{deliveryDays} business days</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
          <span className="material-symbols-outlined text-[primary] shrink-0" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span>
          <div>
            <p className="font-medium text-xs">Verified Supplier</p>
            <p className="text-muted-foreground text-[10px]">Quality guaranteed</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
          <Package className="h-5 w-5 text-[primary] shrink-0" />
          <div>
            <p className="font-medium text-xs">MOQ: {moq}</p>
            <p className="text-muted-foreground text-[10px]">Min order quantity</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
          <Tag className="h-5 w-5 text-[primary] shrink-0" />
          <div>
            <p className="font-medium text-xs">Bulk Discounts</p>
            <p className="text-muted-foreground text-[10px]">
              {maxSavingsPercent > 0 ? `Up to ${maxSavingsPercent}% off` : 'No tiered discounts set'}
            </p>
          </div>
        </div>
      </div>


      {/* ─── Sticky Buy Now Bar (Mobile) ─── */}
      {showStickyBar && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 z-50 lg:hidden border-t bg-white dark:bg-gray-900/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
        >
          <div className="max-w-[1440px] mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[primary] text-lg">{formatPrice(totalPrice)}</p>
                <p className="text-xs text-muted-foreground">{quantity} {unit} × {formatPrice(applicablePrice)}</p>
              </div>
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-12 p-0 shrink-0"
                title="Message supplier"
                onClick={handleChatWithSupplier}
                disabled={chatLoading}
              >
                {chatLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
              </Button>
              <Button
                className="h-12 px-8 text-base font-bold text-white shrink-0"
                size="lg"
                onClick={handleBuyNow}
                disabled={currentVariantStock === 0 || quantity < moq}
                style={{ backgroundColor: GREEN }}
              >
                <Zap className="h-5 w-5 mr-2" />
                Buy Now
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Bottom spacer for sticky bar on mobile ─── */}
      {showStickyBar && <div className="h-20 lg:hidden" />}
    </motion.div>
      </div>
    </div>
  )
}
