'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  QrCode, Bell, Mail, Star, Clock, Truck,
  CheckCircle2, Package, ArrowLeft, ChevronDown
} from 'lucide-react'

interface SupplierProduct {
  id: string
  name: string
  priceLow: number
  priceHigh: number
  moq: number
  unit: string
  soldCount: string
  image: string
  category: string
}

export function SupplierProductsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const supplierId = pageParams.supplierId || ''

  const [activeCategory, setActiveCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popular')
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(8)

  useEffect(() => {
    let mounted = true
    const fetchSupplierData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/products?limit=24')
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data.data) ? data.data : []
          if (mounted) {
            setProducts([
              {
                id: 'sp-1',
                name: 'Heavy Duty Steel Ball Bearing 6204ZZ High Precision',
                priceLow: 2.45,
                priceHigh: 3.10,
                moq: 500,
                unit: 'pcs',
                soldCount: '12k+ sold',
                image: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=500&auto=format&fit=crop&q=80',
                category: 'bearings',
              },
              {
                id: 'sp-2',
                name: 'Stainless Steel Hex Bolts M8×50mm Corrosion Resistant',
                priceLow: 0.12,
                priceHigh: 0.18,
                moq: 5000,
                unit: 'pcs',
                soldCount: '50k+ sold',
                image: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=80',
                category: 'fasteners',
              },
              {
                id: 'sp-3',
                name: 'Industrial Timing Belt High Torque Drive HTD-8M',
                priceLow: 5.50,
                priceHigh: 7.20,
                moq: 100,
                unit: 'pcs',
                soldCount: '5k+ sold',
                image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
                category: 'bearings',
              },
              {
                id: 'sp-4',
                name: 'Brass Gate Valve 1 Inch Water Pipe Fitting',
                priceLow: 8.90,
                priceHigh: 11.50,
                moq: 200,
                unit: 'pcs',
                soldCount: '8k+ sold',
                image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80',
                category: 'fasteners',
              },
            ])
          }
        }
      } catch (err) {
        console.error('Failed to load supplier products:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchSupplierData()
    return () => { mounted = false }
  }, [supplierId])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory === 'bearings') return p.category === 'bearings'
      if (activeCategory === 'fasteners') return p.category === 'fasteners'
      return true
    })
  }, [products, activeCategory])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Supplier Products</h1>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Supplier Profile Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-3.5">
            {/* Logo Box */}
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center shrink-0 shadow-2xs">
              <div className="w-full h-full rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white flex flex-col items-center justify-center font-black text-xs">
                <span className="text-rose-400 text-sm">▲</span>
                <span className="text-[8px] tracking-tighter">COREFLOW</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base font-black text-slate-900 leading-tight">
                  Apex Industrial Supply Co.
                </h1>
                <CheckCircle2 className="h-4 w-4 text-primary fill-rose-50" />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Verified Industrial Supplier</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Leading manufacturer of high-grade industrial components and machinery parts. Specializing in precision engineering for over 15 years.
          </p>

          {/* Stats Metric Strip */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50 rounded-2xl p-3 text-center">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-xs font-black text-slate-900">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span>4.9</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Rating
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-xs font-black text-slate-900">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>&lt; 2h</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Response Time
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-xs font-black text-slate-900">
                <Truck className="h-3.5 w-3.5 text-emerald-500" />
                <span>98%</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                On-Time Delivery
              </span>
            </div>
          </div>

          {/* Contact Supplier Button */}
          <Button
            onClick={() => navigate('live-chat')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
          >
            <Mail className="h-4 w-4" />
            Contact Supplier
          </Button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Products' },
            { key: 'bearings', label: 'Bearings & Bushings' },
            { key: 'fasteners', label: 'Industrial Fasteners' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
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

        {/* Products Header & Sort */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-black text-slate-900">
            All Products (124)
          </h2>
          <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold cursor-pointer">
            <span>Sort by: <strong className="text-slate-800">Popular</strong></span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* 2-Column Product Grid */}
        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-3 border border-slate-100 space-y-2">
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            : filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate('product-detail', { productId: p.id })}
                  className="bg-white rounded-2xl border border-slate-100 p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                >
                  <div className="aspect-square rounded-xl bg-slate-100 overflow-hidden mb-2">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                      {p.name}
                    </h3>
                    <div className="mt-1 text-sm font-black text-primary">
                      {formatPrice(p.priceLow)} - {formatPrice(p.priceHigh)}
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-50">
                      <span>MOQ: {p.moq} {p.unit}</span>
                      <span>{p.soldCount}</span>
                    </div>
                  </div>
                </div>
              ))}
        </div>

        {/* Load More Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold text-xs h-11 rounded-2xl shadow-xs"
          >
            Load More Products
          </Button>
        </div>
      </main>
    </div>
  )
}
