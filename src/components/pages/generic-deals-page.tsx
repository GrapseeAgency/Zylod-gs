'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useWishlistStore } from '@/store/wishlist-store'
import { ArrowLeft, Flame, MapPin, Heart, Clock, Tag, Sparkles, Package } from 'lucide-react'

interface DealProduct {
  id: string
  productId: string
  name: string
  price: number
  originalPrice: number
  moq: number
  sold: number
  stock: number
  supplier: string
  location: string
  thumbnailUrl?: string | null
}

const DEAL_META: Record<string, { name: string; subtitle: string; icon: React.ReactNode; colorFrom: string; colorTo: string }> = {
  'mega-sale': { name: 'Mega Sale Events', subtitle: 'Huge seasonal markdowns across top wholesale categories', icon: <Flame className="h-8 w-8 text-white" />, colorFrom: '#D84315', colorTo: '#FF7043' },
  'seasonal-offers': { name: 'Seasonal Offers', subtitle: 'Limited-time deals tailored for peak purchasing seasons', icon: <Tag className="h-8 w-8 text-white" />, colorFrom: '#2E7D32', colorTo: '#66BB6A' },
  'bulk-discounts': { name: 'Bulk Volume Discounts', subtitle: 'Tiered pricing: order more, save up to 40% more', icon: <Package className="h-8 w-8 text-white" />, colorFrom: '#1565C0', colorTo: '#42A5F5' },
  'clearance': { name: 'Clearance & Liquidation', subtitle: 'Final inventory stockouts at rock-bottom factory rates', icon: <Sparkles className="h-8 w-8 text-white" />, colorFrom: '#C62828', colorTo: '#EF5350' },
  'new-arrivals': { name: 'New Product Launches', subtitle: 'Be the first to source newly listed factory releases', icon: <Clock className="h-8 w-8 text-white" />, colorFrom: '#6A1B9A', colorTo: '#AB47BC' },
}

interface GenericDealsPageProps {
  pageId: string
}

export function GenericDealsPage({ pageId }: GenericDealsPageProps) {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { isInWishlist, toggleItem } = useWishlistStore()

  const [products, setProducts] = useState<DealProduct[]>([])
  const [loading, setLoading] = useState(true)

  const meta = DEAL_META[pageId] || {
    name: pageId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    subtitle: 'Exclusive wholesale deal offerings with limited-time price reductions.',
    icon: <Flame className="h-8 w-8 text-white" />,
    colorFrom: '#C8102E',
    colorTo: '#E53935',
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/deals?limit=20`)
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setProducts(
            json.data.map((d: any) => ({
              id: d.id,
              productId: d.productId,
              name: d.productName || d.product?.name || 'Deal Product',
              price: d.dealPrice || d.product?.basePrice || 0,
              originalPrice: d.originalPrice || d.product?.basePrice || 0,
              moq: d.product?.moq || 1,
              sold: d.soldCount || 0,
              stock: d.remainingStock ?? d.totalStock ?? 0,
              supplier: d.product?.supplier?.companyName || '',
              location: '',
              thumbnailUrl: d.productThumbnail || d.product?.images?.[0]?.imageUrl || null,
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pageId])

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header Banner */}
      <div
        className="relative overflow-hidden py-10 px-4 sm:px-6 lg:px-8"
        style={{ background: `linear-gradient(135deg, ${meta.colorFrom}, ${meta.colorTo})` }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
          <div className="text-white max-w-2xl">
            <button
              onClick={() => navigate('flash-sale')}
              className="flex items-center gap-1.5 text-white/80 hover:text-white mb-3 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to All Deals
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                {meta.icon}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">{meta.name}</h1>
            </div>
            <p className="text-white/90 text-sm sm:text-base leading-relaxed">{meta.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
            <Flame className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-lg">No active deals right now</h3>
            <p className="text-sm text-muted-foreground mt-1">Check back soon for new promotions!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => {
              const inWishlist = isInWishlist(product.productId)
              const discountPercent = product.originalPrice > product.price
                ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                : 0

              return (
                <Card
                  key={product.id}
                  className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer"
                  onClick={() => navigate('product-detail', { productId: product.productId })}
                >
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    {product.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🔥</div>
                    )}
                    {discountPercent > 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold text-white bg-primary rounded-md">
                        -{discountPercent}%
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleItem({
                          id: product.productId,
                          name: product.name,
                          price: product.price,
                          originalPrice: product.originalPrice,
                          moq: product.moq,
                          unit: 'pcs',
                          supplier: product.supplier,
                          location: product.location,
                          category: 'Deals',
                          customizable: false,
                        })
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-muted-foreground transition-colors"
                    >
                      <Heart className={`h-4 w-4 ${inWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-xs sm:text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-bold text-sm sm:text-base text-primary">{formatPrice(product.price)}</span>
                      {product.originalPrice > 0 && (
                        <span className="text-[10px] text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>MOQ: {product.moq}</span>
                      <span>{product.sold} claimed</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate">{product.supplier}</span>
                      {product.location && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{product.location}</span>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default GenericDealsPage