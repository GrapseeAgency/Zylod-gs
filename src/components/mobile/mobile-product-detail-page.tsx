'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
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
import {
  ChevronLeft, Share2, ShoppingCart, Heart, Star, Truck, Store, MapPin,
  Circle, Clock, Package, Navigation, Minus, Plus, ChevronRight, QrCode,
  MessageCircle, CheckCircle2,
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

/* ─── Types matching GET /api/products/[id] ─── */
interface ApiProduct {
  id: string; name: string; slug: string; description: string | null; brand: string | null
  unit: string; basePrice: number; moq: number; maxOrderQty: number | null
  stockQuantity: number; thumbnailUrl: string | null; ratingAvg: number; reviewCount: number
  soldCount: number; isCustomizable: boolean; createdAt: string
  category: { id: string; name: string; slug: string; parentId: string | null }
  supplier: { id: string; companyName: string; slug: string; city: string; ratingAvg: number; ratingCount: number; verificationStatus: string }
  images: { id: string; imageUrl: string; sortOrder: number }[]
  priceTiers: { id: string; minQty: number; maxQty: number | null; pricePerUnit: number }[]
  variants: { id: string; variantName: string; variantValue: string; stockQuantity: number; priceOverride: number | null }[]
  reviews: {
    id: string; rating: number; comment: string | null; images: string[]; verifiedPurchase: boolean; createdAt: string
    buyer: { id: string; buyerProfile: { fullName: string | null } | null }
    replies: { id: string; rating: number; comment: string | null; createdAt: string; buyer: { id: string; buyerProfile: { fullName: string | null } | null } }[]
  }[]
}

/* ─── Tab Types ─── */
type TabId = 'details' | 'specifications' | 'shipping' | 'reviews'

/* ─── Component ─── */

export function MobileProductDetailPage() {
  const { pageParams, goBack, navigate } = useNavigationStore()
  const { addItem, getItemCount } = useCartStore()
  const { formatPrice } = useCurrencyStore()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const [activeTab, setActiveTab] = useState<TabId>('details')
  const [justAdded, setJustAdded] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(50)
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<ApiProduct | null>(null)
  const [specifications, setSpecifications] = useState<Record<string, string>>({})

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

  const handleAddToCart = useCallback(() => {
    if (!product) return
    // Was this product already in the cart?
    const alreadyInCart = useCartStore.getState().items.some((i) => i.productId === product.id)
    const item: CartItemData = {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.thumbnailUrl,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity,
      unitPrice: activeTier?.pricePerUnit || product.basePrice,
      totalPrice: (activeTier?.pricePerUnit || product.basePrice) * quantity,
      moq: product.moq,
      maxOrderQty: product.stockQuantity,
      supplierId: product.supplier.id,
      supplierName: product.supplier.companyName,
      supplierSlug: product.supplier.companyName.toLowerCase().replace(/\s+/g, '-'),
      unit: product.unit,
      priceTiers: product.priceTiers?.map(t => ({ minQty: t.minQty, maxQty: t.maxQty, pricePerUnit: t.pricePerUnit })) || [],
    }
    addItem(item)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2000)
    if (alreadyInCart) {
      toast.info('Already in your cart', { description: `${product.name} — quantity updated to ${item.quantity}` })
    } else {
      toast.success('Added to cart', { description: product.name })
    }
  }, [product, quantity, activeTier, addItem])

  const handleBuyNow = useCallback(() => {
    handleAddToCart()
    navigate('cart')
  }, [handleAddToCart, navigate])

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

        {/* Tiered Pricing */}
        {product.priceTiers && product.priceTiers.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tiered Pricing</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Quantity</th>
                    <th className="text-right px-3 py-2 font-medium">Price / {product.unit}</th>
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
                          {tier.minQty}{tier.maxQty ? `-${tier.maxQty}` : '+'} {product.unit}
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
            <Button variant="outline" className="flex-1 h-10 border-[#E53935] text-[#E53935] hover:bg-[#E53935]/5 text-sm font-semibold" onClick={handleAddToCart}>
              {justAdded ? (
                <><CheckCircle2 className="w-4 h-4 mr-1.5" />In Cart ✓</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-1.5" />Add to Cart</>
              )}
            </Button>
            <Button className="flex-[1.5] h-10 bg-[#E53935] hover:bg-[#E53935]/90 text-white text-sm font-semibold" onClick={handleBuyNow}>
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
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">In Stock</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{product.stockQuantity.toLocaleString()} {product.unit}</p>
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