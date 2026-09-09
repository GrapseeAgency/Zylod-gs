'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useCartStore, CartItemData } from '@/store/cart-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileProductDetailPage } from '@/components/mobile/mobile-product-detail-page'
import { ProductQRCodeDialog } from '@/components/shared/product-qr-code'
import { ProductShareDialog } from '@/components/shared/product-share-dialog'
import {
  ShoppingCart, Package, Star, Heart, ChevronLeft,
  Truck, Shield, MessageSquare, Minus, Plus, ArrowRight,
  Store, Database, AlertCircle, Clock,
  MapPin, Globe, Factory, Percent,
  Tag, Phone, ChevronRight,
  Zap, CircleCheck, X,
  Building2, TrendingDown, Info,
  Navigation, User, Loader2, ExternalLink, RefreshCw, Edit,
  ShieldAlert, ShieldCheck,
} from 'lucide-react'

/* ─── Color Constants ─── */
const RED = '#E53935'
const GREEN = '#16A34A'

/* ─── Tracking Types ─── */
interface TrackingStage {
  step: number
  title: string
  description: string
  status: 'completed' | 'current' | 'upcoming'
  timestamp: string | null
  estimatedTime: string | null
  details: Record<string, string> | null
}

interface TrackingVehicle {
  type: string
  plateNumber: string
  driverName: string
  driverPhone: string
  transportCompany: string
  currentLocation: string
  gpsLat: number
  gpsLng: number
}

interface TrackingPersonnel {
  name: string
  phone: string
  photo: string
  rating: number
  totalDeliveries: number
  vehicleType: string
}

interface TrackingData {
  orderId: string
  orderNumber: string
  currentStage: number
  totalStages: number
  stages: TrackingStage[]
  vehicle: TrackingVehicle | null
  personnel: TrackingPersonnel | null
  estimatedDelivery: string
  lastUpdated: string
  canAdvance: boolean
}

interface OrderConfirmationData {
  orderId: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  estimatedDelivery: string
}

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
  name: string
  value: string
  priceAdjustment: number
  stockQuantity: number
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
  basePrice: number
  moq: number
  maxOrderQty: number | null
  stockQuantity: number
  thumbnailUrl: string | null
  ratingAvg: number
  reviewCount: number
  isActive: boolean
  isApproved: boolean
  categoryId: string
  supplierId: string
  category: { id: string; name: string; slug: string; parentId: string | null }
  supplier: { id: string; companyName: string; slug: string; city: string; ratingAvg: number; ratingCount: number; verificationStatus: string; description: string | null }
  priceTiers: PriceTier[]
  images: ProductImage[]
  variants: ProductVariant[]
  reviews: ReviewData[]
  createdAt: string
}

/* ─── Helper: Stock Status ─── */

function getStockStatus(stock: number, maxStock: number) {
  const ratio = stock / maxStock
  if (stock === 0) return { label: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-50', barColor: 'bg-red-500', urgency: false }
  if (ratio < 0.2) return { label: `Only ${stock} left!`, color: 'text-amber-600', bg: 'bg-amber-50', barColor: 'bg-amber-500', urgency: true }
  if (ratio < 0.5) return { label: 'Low Stock', color: 'text-yellow-600', bg: 'bg-yellow-50', barColor: 'bg-yellow-500', urgency: false }
  return { label: 'In Stock', color: 'text-green-600', bg: 'bg-green-50', barColor: 'bg-green-500', urgency: false }
}

/* ─── Main Component ─── */

/* ─── Mobile redirect wrapper ─── */
export function ProductDetailPage() {
  const isMobile = useIsMobile()

  if (isMobile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
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
  const { formatPrice, currentCurrency } = useCurrencyStore()
  const { toast } = useToast()

  // State
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<ProductData | null>(null)
  const [specifications, setSpecifications] = useState<Record<string, Array<{ specName: string; specValue: string }>>>({})
  const [quantity, setQuantity] = useState(50)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [addedToCart, setAddedToCart] = useState(false)
  const [wishlist, setWishlist] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [quantityError, setQuantityError] = useState(false)

  // Buy Now / Order tracking state
  const [buyNowLoading, setBuyNowLoading] = useState(false)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmationData | null>(null)
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sticky Buy Now bar visibility
  const [showStickyBar, setShowStickyBar] = useState(false)
  const buyButtonRef = useRef<HTMLDivElement | null>(null)

  const productId = pageParams.productId || pageParams.slug || ''

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

        // Fetch detailed specifications for the Specifications tab
        const specRes = await fetch(`/api/products/${productId}/specifications`)
        if (specRes.ok) {
          const specResult = await specRes.json()
          if (specResult.success && specResult.data?.groupedSpecifications) {
            setSpecifications(specResult.data.groupedSpecifications)
          }
        }
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
  useEffect(() => {
    setQuantity(moq)
  }, [moq])

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
        const res = await fetch('/api/wishlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: currentProductId }),
        })
        const data = await res.json()
        if (data.success) {
          setWishlist(false)
          toast({ title: 'Removed from Wishlist', description: `${productName} removed from your wishlist` })
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

  // Calculate applicable price
  const getApplicablePrice = () => {
    if (!product) return 0
    let price = product.basePrice
    if (product.priceTiers && product.priceTiers.length > 0) {
      for (const tier of product.priceTiers) {
        if (quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) {
          price = tier.pricePerUnit
          break
        }
      }
    }
    if (selectedVariantId && product.variants) {
      const variant = product.variants.find(v => v.id === selectedVariantId)
      if (variant) price += variant.priceAdjustment
    }
    return price
  }

  const applicablePrice = getApplicablePrice()
  const totalPrice = applicablePrice * quantity
  const basePrice = product?.basePrice || 0
  const savingsPercent = basePrice > 0 ? Math.round(((basePrice - applicablePrice) / basePrice) * 100) : 0
  const unit = product?.unit || 'pcs'
  const maxStock = product?.stockQuantity || 0
  const stockStatus = getStockStatus(currentVariantStock, maxStock)
  const deliveryDays = currentVariantStock === 0 ? 21 : currentVariantStock < maxStock * 0.2 ? 10 : 5

  const handleAddToCart = () => {
    if (!product) return
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
      variantName: selectedVariant?.name || null,
      variantValue: selectedVariant?.value || null,
      quantity,
      unitPrice: applicablePrice,
      totalPrice,
      moq: product.moq,
      maxOrderQty: product.maxOrderQty,
      supplierId: product.supplier.id,
      supplierName: product.supplier.companyName,
      supplierSlug: product.supplier.slug || '',
      unit: product.unit,
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

  // ─── Fetch Tracking Data ───
  const fetchTracking = useCallback(async (orderId: string, orderNumber: string) => {
    setTrackingLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/track?orderNumber=${orderNumber}`)
      const data = await res.json()
      if (data.success) {
        setTrackingData(data.data)
      }
    } catch {
      // Silently handle tracking errors
    } finally {
      setTrackingLoading(false)
    }
  }, [])

  // ─── Buy Now Handler ───
  const handleBuyNow = useCallback(async () => {
    if (!product || currentVariantStock === 0 || quantity < moq) return
    setBuyNowLoading(true)

    try {
      // Create direct order via API
      const res = await fetch('/api/orders/create-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          unitPrice: applicablePrice,
          supplierId: product.supplier.id,
          variantId: selectedVariantId || null,
          paymentMethod: 'cod',
        }),
      })

      const data = await res.json()
      if (data.success) {
        setOrderConfirmation(data.data)
        setShowOrderDialog(true)
        toast({ title: 'Order Placed!', description: `Order ${data.data.orderNumber} created successfully` })

        // Start tracking
        fetchTracking(data.data.orderId, data.data.orderNumber)
      } else {
        toast({ title: 'Order Failed', description: data.error || 'Could not place order', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Order Failed', description: 'Could not place order. Please try again.', variant: 'destructive' })
    } finally {
      setBuyNowLoading(false)
    }
  }, [product, quantity, moq, applicablePrice, currentVariantStock, selectedVariantId, fetchTracking, toast])

  // ─── Auto-advance tracking in dialog ───
  useEffect(() => {
    if (showOrderDialog && orderConfirmation) {
      // Poll tracking every 15 seconds for demo
      trackingIntervalRef.current = setInterval(() => {
        fetchTracking(orderConfirmation.orderId, orderConfirmation.orderNumber)
      }, 15000)

      return () => {
        if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current)
        }
      }
    }
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current)
      }
    }
  }, [showOrderDialog, orderConfirmation, fetchTracking])

  // ─── Manual advance tracking (for demo) ───
  const handleAdvanceTracking = useCallback(async () => {
    if (!orderConfirmation) return
    setTrackingLoading(true)
    try {
      await fetch(`/api/orders/${orderConfirmation.orderId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderConfirmation.orderNumber }),
      })
      await fetchTracking(orderConfirmation.orderId, orderConfirmation.orderNumber)
    } catch {
      // silently handle
    } finally {
      setTrackingLoading(false)
    }
  }, [orderConfirmation, fetchTracking])

  // ─── Loading State ───
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('category-products')}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Products
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </motion.div>
    )
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
                        <img src={img.imageUrl} alt={img.altText || productName} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-24 w-24 text-muted-foreground" />
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          ) : (
            <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden">
              {product?.thumbnailUrl ? (
                <img src={product.thumbnailUrl} alt={productName} className="w-full h-full object-cover" />
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
                    <img src={img.imageUrl} alt={img.altText || productName} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 mx-auto text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Info ─── */}
        <div className="space-y-4">
          {/* Title + QR/Share */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{productName}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                by {productSupplier?.companyName || product?.supplier?.companyName || 'Unknown Supplier'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ProductQRCodeDialog productId={product?.id || ''} productName={productName} />
              <ProductShareDialog productId={product?.id || ''} productName={productName} productPrice={basePrice} />
            </div>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">{productCategory}</Badge>
            {productBrand && <Badge variant="outline" className="text-xs">{productBrand}</Badge>}
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
                    {currentVariantStock > 0 ? `In Stock: ${currentVariantStock.toLocaleString()} ${unit} available` : 'Out of Stock'}
                  </span>
                </div>
                {stockStatus.urgency && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs animate-pulse">
                    <AlertCircle className="h-3 w-3 mr-1" /> Only {currentVariantStock} left!
                  </Badge>
                )}
              </div>
              {/* Stock progress bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stockStatus.barColor}`}
                  style={{ width: `${Math.min(100, (currentVariantStock / maxStock) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{Math.round((currentVariantStock / maxStock) * 100)}% available</span>
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
                    className={`text-sm ${selectedVariantId === variant.id ? 'bg-[primary] hover:bg-[#C62828]' : 'hover:border-[primary] hover:text-[primary]'}`}
                  >
                    {variant.name}: {variant.value}
                    {variant.priceAdjustment !== 0 && (
                      <span className="ml-1 text-xs">(+{formatPrice(variant.priceAdjustment)})</span>
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
                <CardTitle className="text-sm font-semibold">Price Tiers (per {unit})</CardTitle>
                <CardDescription className="text-xs">Buy more, save more — wholesale pricing</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {product.priceTiers.map((tier) => {
                    const isActive = quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)
                    return (
                      <div key={tier.id} className={`flex items-center justify-between p-2.5 rounded-lg text-sm ${
                        isActive ? 'bg-[primary]/10 border border-[primary]/30 font-medium' : 'bg-gray-50'
                      }`}>
                        <span className={isActive ? 'text-[primary]' : 'text-muted-foreground'}>
                          {tier.minQty} - {tier.maxQty ?? '∞'} {unit}
                        </span>
                        <span className={`font-semibold ${isActive ? 'text-[primary]' : 'text-foreground'}`}>
                          {formatPrice(tier.pricePerUnit)}/{unit}
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
                <p className="text-xs text-muted-foreground mb-1">Your price per {unit}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[primary]">{formatPrice(applicablePrice)}</span>
                  {savingsPercent > 0 && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      <TrendingDown className="h-3 w-3 mr-0.5" /> Save {savingsPercent}%
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Total ({quantity} {unit})</p>
                <p className="text-xl font-bold text-foreground">{formatPrice(totalPrice)}</p>
              </div>
            </div>
          </div>

          {/* ─── Quantity Selector ─── */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold shrink-0">Quantity ({unit})</Label>
              <Badge variant="secondary" className="text-xs">MOQ: {moq} {unit}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-none hover:bg-[primary]/10"
                  onClick={() => setQuantity(Math.max(moq, quantity - moq))}
                  disabled={quantity <= moq}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    if (isNaN(val) || val < moq) {
                      setQuantity(val || 0)
                      setQuantityError(true)
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
                  onClick={() => setQuantity(quantity + moq)}
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
                disabled={currentVariantStock === 0 || quantity < moq || buyNowLoading}
                style={{ backgroundColor: GREEN }}
              >
                {buyNowLoading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 mr-2" />
                )}
                {buyNowLoading ? 'Placing Order...' : 'Buy Now'}
              </Button>
            </div>
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
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
                        <span className="material-symbols-outlined mr-0.5" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span> Verified
                      </Badge>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      ID: SUP-{(productSupplier?.id || product?.supplierId || '8491').slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-[primary] text-[primary]" />
                      {productSupplier?.ratingAvg?.toFixed(1) || '0.0'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {productSupplier?.city || product?.supplier?.city || 'Bangladesh'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:border-[primary] hover:text-[primary]"
                    onClick={() => {
                      toast({ title: 'Opening Chat', description: `Starting conversation with ${productSupplier?.companyName || product?.supplier?.companyName || 'Supplier'}` })
                      navigate('chat-detail', { conversationId: product?.supplierId || '' })
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" /> Chat
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

          {/* ─── Wholesale Trust & Escrow Guarantee Banner ─── */}
          <div className="bg-gradient-to-r from-red-50/70 via-slate-50 to-orange-50/50 rounded-2xl p-3.5 border border-red-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-[11px]">SafePay Escrow & 48h Inspection Guarantee</p>
                <p className="text-[10px] text-gray-500">100% money protection until you verify goods upon delivery.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-red-600">
              <button onClick={() => navigate('escrow-protection-guide')} className="hover:underline">
                Escrow Rules
              </button>
              <span>•</span>
              <button onClick={() => navigate('buyer-protection-policy')} className="hover:underline">
                48h Returns
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
                  <p className="font-medium">{currentVariantStock.toLocaleString()} {unit}</p>
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
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
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
                    onClick={() => {
                      if (orderConfirmation) {
                        navigate('order-detail', {
                          orderId: orderConfirmation.orderId,
                          orderNumber: orderConfirmation.orderNumber,
                          totalAmount: orderConfirmation.totalAmount.toString(),
                          quantity: quantity.toString(),
                          productName: productName,
                        })
                      } else {
                        toast({ title: 'Place an order first', description: 'Click "Buy Now" to place an order and track it in real-time' })
                      }
                    }}
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
                              : 'bg-gray-100 text-gray-400'
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
                                : 'bg-gray-50 text-gray-400'
                          }`}>
                            {item.date}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${
                          item.status === 'upcoming' ? 'text-gray-400' : 'text-muted-foreground'
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

                {/* Delivery Partners Info */}
                <div className="mt-6 p-4 rounded-lg bg-muted">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                    <Truck className="h-4 w-4 text-[primary]" /> Our Delivery Partners
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { name: 'Bengal Express', type: 'Truck', area: 'Nationwide' },
                      { name: 'Pathao Logistics', type: 'Van & Bike', area: 'Dhaka & CTG' },
                      { name: 'eCourier BD', type: 'Mini Truck', area: 'Major Cities' },
                      { name: 'RedX Bangladesh', type: 'Cargo', area: 'All Divisions' },
                    ].map((partner) => (
                      <div key={partner.name} className="text-center p-2 rounded-md bg-background">
                        <p className="font-medium text-xs">{partner.name}</p>
                        <p className="text-[10px] text-muted-foreground">{partner.type}</p>
                        <Badge variant="secondary" className="text-[9px] mt-1">{partner.area}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

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
            <p className="text-muted-foreground text-[10px]">Up to {savingsPercent}% off</p>
          </div>
        </div>
      </div>

      {/* ─── Order Confirmation & Tracking Dialog ─── */}
      <Dialog open={showOrderDialog} onOpenChange={(open) => {
        setShowOrderDialog(open)
        if (!open) {
          setTrackingData(null)
          setOrderConfirmation(null)
          if (trackingIntervalRef.current) {
            clearInterval(trackingIntervalRef.current)
          }
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
              Order Placed Successfully!
            </DialogTitle>
            <DialogDescription>
              {orderConfirmation && (
                <span>Order <strong>{orderConfirmation.orderNumber}</strong> has been confirmed</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {orderConfirmation && (
            <div className="space-y-4">
              {/* Order Summary */}
              <Card className="border-0 shadow-sm bg-green-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Order Number</p>
                      <p className="font-semibold">{orderConfirmation.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Total Amount</p>
                      <p className="font-semibold text-green-700">{formatPrice(orderConfirmation.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Payment</p>
                      <p className="font-medium">{orderConfirmation.paymentStatus === 'unpaid' ? 'Cash on Delivery' : 'Paid'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Est. Delivery</p>
                      <p className="font-medium">{new Date(orderConfirmation.estimatedDelivery).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live Tracking Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <Navigation className="h-4 w-4 text-[primary]" />
                    Live Tracking
                  </h4>
                  <div className="flex items-center gap-2">
                    {trackingData && trackingData.canAdvance && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[primary] hover:text-[primary]"
                        onClick={handleAdvanceTracking}
                        disabled={trackingLoading}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${trackingLoading ? 'animate-spin' : ''}`} />
                        Advance
                      </Button>
                    )}
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground">Live</span>
                  </div>
                </div>

                {trackingData ? (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                    {trackingData.stages.map((stage) => {
                      const stageIcon = (() => {
                        switch (stage.title) {
                          case 'Order Placed': return <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
                          case 'Processing': return <Clock className="h-4 w-4" />
                          case 'Quality Check': return <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>verified</span>
                          case 'Packed': return <Package className="h-4 w-4" />
                          case 'Shipped': return <Truck className="h-4 w-4" />
                          case 'Out for Delivery': return <Navigation className="h-4 w-4" />
                          case 'Delivered': return <CircleCheck className="h-4 w-4" />
                          default: return <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>
                        }
                      })()

                      return (
                        <div key={stage.step} className="relative flex items-start gap-4 pb-5 last:pb-0">
                          <div
                            className={`relative z-10 flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
                              stage.status === 'completed'
                                ? 'bg-green-100 text-green-600'
                                : stage.status === 'current'
                                  ? 'bg-[primary]/10 text-[primary] ring-2 ring-[primary]/30'
                                  : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {stageIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`font-medium text-sm ${
                                stage.status === 'completed'
                                  ? 'text-green-700'
                                  : stage.status === 'current'
                                    ? 'text-[primary]'
                                    : 'text-muted-foreground'
                              }`}>
                                {stage.title}
                              </p>
                              {stage.timestamp && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(stage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs mt-0.5 ${
                              stage.status === 'upcoming' ? 'text-gray-400' : 'text-muted-foreground'
                            }`}>
                              {stage.description}
                            </p>
                            {stage.status === 'current' && (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-[primary] animate-pulse" />
                                <span className="text-[10px] text-[primary] font-medium">In Progress</span>
                                {stage.estimatedTime && (
                                  <span className="text-[10px] text-muted-foreground ml-1">· {stage.estimatedTime}</span>
                                )}
                              </div>
                            )}
                            {stage.status === 'completed' && stage.details && (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {Object.entries(stage.details).map(([key, value]) => (
                                  <span key={key} className="mr-2">{key}: {value}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading tracking...</span>
                  </div>
                )}
              </div>

              {/* Delivery Vehicle Info */}
              {trackingData?.vehicle && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                      <Truck className="h-4 w-4 text-[primary]" />
                      Delivery Vehicle
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Type</p>
                        <p className="font-medium">{trackingData.vehicle.type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Plate</p>
                        <p className="font-medium">{trackingData.vehicle.plateNumber}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Driver</p>
                        <p className="font-medium">{trackingData.vehicle.driverName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Transport Co.</p>
                        <p className="font-medium">{trackingData.vehicle.transportCompany}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Current Location</p>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[primary]" />
                          {trackingData.vehicle.currentLocation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Delivery Personnel Info */}
              {trackingData?.personnel && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                      <User className="h-4 w-4 text-[primary]" />
                      Delivery Person
                    </h4>
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-full bg-[primary]/10 flex items-center justify-center shrink-0">
                        <User className="h-6 w-6 text-[primary]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{trackingData.personnel.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-[primary] text-[primary]" />
                            <span className="text-xs font-medium">{trackingData.personnel.rating}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{trackingData.personnel.totalDeliveries} deliveries</span>
                          <span className="text-xs text-muted-foreground">· {trackingData.personnel.vehicleType}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-[primary]" />
                          <span className="text-xs text-[primary]">{trackingData.personnel.phone}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowOrderDialog(false)
                setTrackingData(null)
                setOrderConfirmation(null)
                if (trackingIntervalRef.current) {
                  clearInterval(trackingIntervalRef.current)
                }
              }}
            >
              Continue Shopping
            </Button>
            <Button
              className="flex-1"
              style={{ backgroundColor: RED }}
              onClick={() => {
                setShowOrderDialog(false)
                setTrackingData(null)
                setOrderConfirmation(null)
                if (trackingIntervalRef.current) {
                  clearInterval(trackingIntervalRef.current)
                }
                navigate('order-detail', {
                  orderId: orderConfirmation?.orderId || '',
                  orderNumber: orderConfirmation?.orderNumber || '',
                  totalAmount: orderConfirmation?.totalAmount?.toString() || '0',
                  quantity: quantity.toString(),
                  productName: productName,
                })
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Sticky Buy Now Bar (Mobile) ─── */}
      {showStickyBar && !showOrderDialog && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 z-50 lg:hidden border-t bg-white/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
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
                onClick={() => {
                  toast({ title: 'Opening Chat', description: `Starting conversation with ${productSupplier?.companyName || product?.supplier?.companyName || 'Supplier'}` })
                  navigate('chat-detail', { conversationId: product?.supplierId || '' })
                }}
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
              <Button
                className="h-12 px-8 text-base font-bold text-white shrink-0"
                size="lg"
                onClick={handleBuyNow}
                disabled={currentVariantStock === 0 || quantity < moq || buyNowLoading}
                style={{ backgroundColor: GREEN }}
              >
                {buyNowLoading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 mr-2" />
                )}
                {buyNowLoading ? 'Placing...' : 'Buy Now'}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Bottom spacer for sticky bar on mobile ─── */}
      {showStickyBar && !showOrderDialog && <div className="h-20 lg:hidden" />}
    </motion.div>
      </div>
    </div>
  )
}
