'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  Search, QrCode, Bell, ShoppingCart, Heart,
  TrendingUp, FileText, ArrowRight, Package, Sparkles
} from 'lucide-react'

interface CatalogProduct {
  id: string
  name: string
  slug: string
  price: number
  originalPrice?: number
  moq: number
  soldCount: string
  unit: string
  image: string
  isSale?: boolean
  category: string
}

export function WholesaleCatalogPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const { toggleItem, isInWishlist } = useWishlistStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'smartphones' | 'wearables' | 'audio'>('all')
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchCatalog = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/products?limit=20')
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data.data) ? data.data : []
          if (mounted && items.length > 0) {
            setProducts(items.map((p: any, i: number) => ({
              id: p.id || `cat-${i}`,
              name: p.name || 'Aura Smart Watch Pro - Wholesale Bundle',
              slug: p.slug || 'product',
              price: p.base_price || p.basePrice || 45.0,
              originalPrice: p.discount_percent ? (p.base_price * 1.25) : undefined,
              moq: p.moq || 100,
              soldCount: `${(i + 1) * 1.2}k Sold`,
              unit: p.unit || 'unit',
              image: p.images?.[0]?.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80',
              isSale: i === 2 || (p.discount_percent > 0),
              category: i % 2 === 0 ? 'wearables' : 'audio',
            })))
          }
        }
      } catch (err) {
        console.error('Failed to load catalog:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchCatalog()
    return () => { mounted = false }
  }, [])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return p.name.toLowerCase().includes(q)
      }
      return true
    })
  }, [products, activeCategory, searchQuery])

  const handleToggleWishlist = useCallback((e: React.MouseEvent, p: CatalogProduct) => {
    e.stopPropagation()
    toggleItem({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice || p.price,
      moq: p.moq,
      unit: p.unit,
      supplier: 'Wholesale Supplier',
      location: 'Dhaka',
      category: p.category,
      customizable: false
    })
  }, [toggleItem])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="md:hidden p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog..."
            className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium focus-visible:ring-primary"
          />
          <button className="absolute right-3 p-1 text-slate-400 hover:text-slate-600">
            <QrCode className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Featured Collection Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden shadow-md bg-slate-900 text-white min-h-[220px] flex flex-col justify-end p-5">
          <img
            src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
            alt="Summer Tech Essentials"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="relative z-10 space-y-3">
            <div>
              <span className="text-[9px] font-black tracking-widest uppercase text-white/80">
                FEATURED COLLECTION
              </span>
              <h2 className="text-lg font-black leading-tight mt-0.5">
                Summer Tech Essentials Q3
              </h2>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => navigate('product-list')}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow-md"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Add Full Collection to Order
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('product-specifications')}
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 font-bold text-xs h-9 rounded-xl backdrop-blur-xs"
              >
                View Line Sheet
              </Button>
            </div>
          </div>
        </div>

        {/* Secondary Sub-Banner */}
        <div className="relative rounded-2xl overflow-hidden shadow-xs bg-slate-800 text-white h-24 flex items-end p-4">
          <img
            src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80"
            alt="Premium Audio"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="relative z-10">
            <h3 className="text-sm font-bold">Premium Audio</h3>
            <p className="text-[10px] text-slate-300 font-medium">MOQ: 50 Units | High Margin</p>
          </div>
        </div>

        {/* Market Insights Report Card */}
        <div
          onClick={() => navigate('explore')}
          className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-primary flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Market Insights Report</h4>
              <p className="text-[10px] text-slate-400">Download Q3 consumer electronics trends.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-primary flex items-center gap-1">
            Read Now <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Products' },
            { key: 'smartphones', label: 'Smartphones' },
            { key: 'wearables', label: 'Wearables' },
            { key: 'audio', label: 'Audio' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* New Arrivals Section Heading */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h3 className="text-sm font-black text-slate-900">New Arrivals</h3>
            <p className="text-[10px] text-slate-400">Latest warehouse additions</p>
          </div>
          <button
            onClick={() => navigate('new-arrivals')}
            className="text-xs font-bold text-primary flex items-center gap-0.5 hover:underline"
          >
            See All <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* 2x2 Product Grid */}
        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-3 border border-slate-100 space-y-2">
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : filteredProducts.map((p) => {
                const inWish = isInWishlist(p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate('product-detail', { productId: p.id })}
                    className="bg-white rounded-2xl border border-slate-100 p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div className="relative aspect-square rounded-xl bg-slate-100 overflow-hidden mb-2">
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      {p.isSale && (
                        <span className="absolute top-2 left-2 bg-primary text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                          SALE
                        </span>
                      )}
                      <button
                        onClick={(e) => handleToggleWishlist(e, p)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-xs text-slate-600 hover:text-primary transition-colors"
                      >
                        <Heart className={`h-3.5 w-3.5 ${inWish ? 'fill-primary text-primary' : ''}`} />
                      </button>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                        {p.name}
                      </h4>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-primary">
                          {formatPrice(p.price)}
                        </span>
                        {p.originalPrice && (
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatPrice(p.originalPrice)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-normal">/{p.unit}</span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-50">
                        <span>MOQ: {p.moq}</span>
                        <span>{p.soldCount}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
        </div>
      </main>
    </div>
  )
}
