'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  QrCode, Bell, Sparkles, TrendingUp, ShoppingCart,
  ArrowRight, Layers, Percent, Package, CheckCircle2
} from 'lucide-react'

interface MatchProduct {
  id: string
  name: string
  category: string
  matchScore: number
  price: number
  unit: string
  moq: number
  marginEst?: string
  aiNote?: string
  image: string
  isFeaturedHero?: boolean
}

export function SimilarProductsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const [activeFilter, setActiveFilter] = useState<'all' | 'margin' | 'bulk'>('all')

  const products: MatchProduct[] = [
    {
      id: 'sim-1',
      name: 'Premium Corrugated Shipping Cartons - Export Grade',
      category: 'Packaging & Shipping',
      matchScore: 98,
      price: 0.45,
      unit: 'unit',
      moq: 5000,
      marginEst: '35-40%',
      aiNote: 'Buyers in your segment often bundle this with sealing tape for a 15% lower combined landed cost.',
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
      isFeaturedHero: true,
    },
    {
      id: 'sim-2',
      name: 'Heavy Duty Acrylic Sealing Tape',
      category: 'Packaging & Shipping',
      matchScore: 85,
      price: 1.20,
      unit: 'roll',
      moq: 500,
      image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'sim-3',
      name: 'Waterproof Poly Mailers 10×13',
      category: 'Packaging & Shipping',
      matchScore: 82,
      price: 0.12,
      unit: 'bag',
      moq: 10000,
      image: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80',
    },
  ]

  const handleAddToCart = useCallback((p: MatchProduct) => {
    addItem({
      id: `cart-${p.id}-${Date.now()}`,
      productId: p.id,
      productName: p.name,
      productSlug: p.id,
      productImage: p.image,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity: p.moq,
      unitPrice: p.price,
      totalPrice: p.price * p.moq,
      moq: p.moq,
      maxOrderQty: null,
      supplierId: '',
      supplierName: 'Verified Supplier',
      supplierSlug: '',
      unit: p.unit,
      priceTiers: [],
    })
    navigate('cart')
  }, [addItem, navigate])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-xl mx-auto">
        {/* AI Match Header */}
        <div>
          <div className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-wider mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Business Match</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
            Alternative & Cross-Industry Products
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Curated recommendations based on your recent searches and industry trends.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Matches' },
            { key: 'margin', label: 'Higher Margin' },
            { key: 'bulk', label: 'Bulk Volume' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Match Cards */}
        <div className="space-y-4">
          {products.map((p) => {
            if (p.isFeaturedHero) {
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs space-y-3"
                >
                  {/* Hero Image with Badges */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    
                    <button
                      onClick={() => navigate('compare')}
                      className="absolute top-3 left-3 bg-primary text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md flex items-center gap-1 shadow-md"
                    >
                      <span>⚡ Quick Compare</span>
                    </button>

                    <Badge className="absolute top-3 right-3 bg-white/90 text-slate-800 border-none text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs">
                      {p.matchScore}% Match
                    </Badge>
                  </div>

                  <div className="p-4 space-y-3 pt-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {p.category}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                        {p.name}
                      </h3>
                      <div className="mt-1 text-base font-black text-primary">
                        {formatPrice(p.price)} <span className="text-xs font-normal text-slate-400">/ {p.unit}</span>
                      </div>
                    </div>

                    {/* Metric Boxes */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">MOQ</span>
                        <span className="text-xs font-black text-slate-800">{p.moq.toLocaleString()} units</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Est. Margin</span>
                        <span className="text-xs font-black text-emerald-600">{p.marginEst}</span>
                      </div>
                    </div>

                    {/* AI Note */}
                    {p.aiNote && (
                      <p className="text-[11px] text-slate-500 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/60 leading-relaxed">
                        <strong className="text-primary font-bold">AI Note:</strong> {p.aiNote}
                      </p>
                    )}

                    {/* View Analysis CTA */}
                    <Button
                      variant="outline"
                      onClick={() => navigate('product-specifications')}
                      className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      View Analysis
                    </Button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs space-y-3"
              >
                {/* Image */}
                <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  <Badge className="absolute top-3 right-3 bg-white/90 text-slate-800 border-none text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs">
                    {p.matchScore}% Match
                  </Badge>
                </div>

                <div className="p-4 space-y-3 pt-1">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">{p.name}</h3>
                    <div className="mt-1 text-sm font-black text-primary">
                      {formatPrice(p.price)} <span className="text-[10px] font-normal text-slate-400">/ {p.unit}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">MOQ: {p.moq.toLocaleString()} {p.unit}s</p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleAddToCart(p)}
                    className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Add to Cart
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Market Shift Detected Insight Card */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">Market Shift Detected</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Suppliers in the <strong className="text-slate-800">Packaging</strong> sector are currently offering volume discounts averaging 12% higher than last quarter. Consider consolidating orders to maximize margins.
            </p>
            <button
              onClick={() => navigate('category-products', { category: 'packaging' })}
              className="text-xs font-bold text-primary flex items-center gap-1 mt-2 hover:underline"
            >
              Explore Bulk Deals <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
