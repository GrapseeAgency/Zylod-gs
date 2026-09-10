'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  ArrowLeft, Filter, Star, MapPin, SlidersHorizontal, Grid3X3, List, Heart, Building2,
  Shirt, Wheat, Cpu, HardHat, Box, Leaf, Palette, Gift, Flame, Smartphone, Lightbulb,
  Car, Dumbbell, BookOpen, Puzzle, Gem, Pill, Armchair, Sparkles, Package,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  originalPrice: number | null
  moq: number
  unit: string
  rating: number
  sold: number
  supplier: string
  location: string
  customizable: boolean
  category: string
  thumbnailUrl?: string | null
}

const CATEGORY_META: Record<string, { name: string; description: string; icon: React.ReactNode; colorFrom: string; colorTo: string }> = {
  'textiles-fabrics': { name: 'Textiles & Fabrics', description: 'Premium Bangladeshi textiles — from Dhaka muslin to Narayanganj silk', icon: <Shirt className="h-8 w-8 text-white" />, colorFrom: '#E53935', colorTo: '#FF8A80' },
  'agriculture-food': { name: 'Agriculture & Food', description: 'Fresh Bangladeshi produce — from Rajshahi rice to Sylhet tea', icon: <Wheat className="h-8 w-8 text-white" />, colorFrom: '#2E7D32', colorTo: '#81C784' },
  'electronics': { name: 'Electronics & Components', description: 'Wholesale electronics and components', icon: <Cpu className="h-8 w-8 text-white" />, colorFrom: '#1565C0', colorTo: '#64B5F6' },
  'construction': { name: 'Construction & Real Estate', description: 'Building materials, hardware, and safety gear', icon: <HardHat className="h-8 w-8 text-white" />, colorFrom: '#E65100', colorTo: '#FFB74D' },
  'packaging-printing': { name: 'Packaging & Printing', description: 'Boxes, bags, containers, and print materials', icon: <Box className="h-8 w-8 text-white" />, colorFrom: '#6A1B9A', colorTo: '#BA68C8' },
  'home-garden': { name: 'Home & Garden', description: 'Home decor, cookware, and garden supplies', icon: <Leaf className="h-8 w-8 text-white" />, colorFrom: '#00695C', colorTo: '#4DB6AC' },
  'beauty-personal-care': { name: 'Beauty & Personal Care', description: 'Cosmetics, skincare, and personal care wholesale', icon: <Palette className="h-8 w-8 text-white" />, colorFrom: '#AD1457', colorTo: '#F06292' },
  'gifts-crafts': { name: 'Gifts & Crafts', description: 'Traditional Bangladeshi handicrafts and promotional items', icon: <Gift className="h-8 w-8 text-white" />, colorFrom: '#C62828', colorTo: '#EF9A9A' },
  'flash-sale': { name: 'Flash Deals', description: 'Time-limited deals with deep discounts', icon: <Flame className="h-8 w-8 text-white" />, colorFrom: '#D84315', colorTo: '#FF7043' },
  'new-arrivals': { name: 'New Arrivals', description: 'Latest products added to the catalog', icon: <Sparkles className="h-8 w-8 text-white" />, colorFrom: '#4A148C', colorTo: '#AB47BC' },
}

interface GenericCategoryPageProps {
  pageId: string
}

export function GenericCategoryPage({ pageId }: GenericCategoryPageProps) {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { isInWishlist, toggleItem } = useWishlistStore()

  const [selectedSub, setSelectedSub] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'popular' | 'price-low' | 'price-high' | 'rating'>('popular')
  const [minMoq, setMinMoq] = useState<number | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const meta = CATEGORY_META[pageId] || {
    name: pageId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: `Explore wholesale ${pageId.replace(/-/g, ' ')} products directly from verified Bangladeshi manufacturers.`,
    icon: <Package className="h-8 w-8 text-white" />,
    colorFrom: '#C8102E',
    colorTo: '#E53935',
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/products?limit=24`)
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setProducts(
            json.data.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: p.basePrice,
              originalPrice: null,
              moq: p.moq || 1,
              unit: p.unit || 'pcs',
              rating: p.ratingAvg || 0,
              sold: p.soldCount || 0,
              supplier: p.supplier?.companyName || 'Verified Supplier',
              location: '',
              customizable: p.isCustomizable || false,
              category: p.category?.name || 'General',
              thumbnailUrl: p.images?.[0]?.imageUrl || p.thumbnailUrl || null,
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pageId])

  let filtered = products.filter(p => {
    if (selectedSub && p.category.toLowerCase() !== selectedSub.toLowerCase()) return false
    if (minMoq && p.moq > minMoq) return false
    return true
  })

  if (sortBy === 'price-low') filtered.sort((a, b) => a.price - b.price)
  if (sortBy === 'price-high') filtered.sort((a, b) => b.price - a.price)
  if (sortBy === 'rating') filtered.sort((a, b) => b.rating - a.rating)
  if (sortBy === 'popular') filtered.sort((a, b) => b.sold - a.sold)

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Banner */}
      <div
        className="relative overflow-hidden py-10 px-4 sm:px-6 lg:px-8"
        style={{ background: `linear-gradient(135deg, ${meta.colorFrom}, ${meta.colorTo})` }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
          <div className="text-white max-w-2xl">
            <button
              onClick={() => navigate('home')}
              className="flex items-center gap-1.5 text-white/80 hover:text-white mb-3 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                {meta.icon}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">{meta.name}</h1>
            </div>
            <p className="text-white/90 text-sm sm:text-base leading-relaxed">{meta.description}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/50 mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground ml-2">
              Showing {filtered.length} products
            </span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-background border border-border rounded-lg px-3 py-1.5 font-medium"
            >
              <option value="popular">Most Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Product Grid / List */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-lg">No products found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try resetting filters to view more products.</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex flex-col gap-4'}>
            {filtered.map(product => {
              const inWishlist = isInWishlist(product.id)
              return (
                <Card
                  key={product.id}
                  className="group overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer"
                  onClick={() => navigate('product-detail', { productId: product.id })}
                >
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    {product.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-gray-300" /></div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleItem({
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          originalPrice: product.originalPrice ?? product.price,
                          moq: product.moq,
                          unit: product.unit,
                          supplier: product.supplier,
                          location: product.location,
                          category: product.category,
                          customizable: product.customizable,
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
                      {product.originalPrice ? <span className="text-[10px] text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span> : null}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>MOQ: {product.moq} {product.unit}</span>
                      <span>⭐ {product.rating.toFixed(1)} ({product.sold})</span>
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

export default GenericCategoryPage