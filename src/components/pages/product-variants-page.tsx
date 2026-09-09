'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, Search, Wrench, ShoppingCart,
  CheckCircle2, AlertTriangle, Clock, Bell, Info, Package
} from 'lucide-react'

interface VariantItem {
  id: string
  sku: string
  grade: string
  stockBadge: { text: string; type: 'in-stock' | 'low-stock' | 'lead-time' }
  length: string
  thickness: string
  finish: string
  weight: string
  price: number
  unit: string
  isPreOrder?: boolean
}

interface MainProduct {
  id: string
  name: string
  sku: string
  description: string
  priceFrom: number
  moq: string
  image: string
}

export function ProductVariantsPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''

  const [activeFilter, setActiveFilter] = useState<'all' | 'instock' | 'long'>('all')
  const [loading, setLoading] = useState(true)

  const [product, setProduct] = useState<MainProduct>({
    id: 'prod-beam',
    name: 'Standard H-Beam Structure',
    sku: 'ISB-9000-X',
    description: 'High-strength structural steel beams designed for commercial construction. Select from available variants below or request custom dimensions for specialized projects.',
    priceFrom: 450,
    moq: '10 Tons',
    image: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=80',
  })

  const [variants, setVariants] = useState<VariantItem[]>([
    {
      id: 'var-1',
      sku: 'ISB-9000-A1',
      grade: 'A36 Carbon Steel',
      stockBadge: { text: '12,500T in stock', type: 'in-stock' },
      length: '6 Meters',
      thickness: '10 mm',
      finish: 'Galvanized',
      weight: '45 kg/m',
      price: 450,
      unit: 'ton',
    },
    {
      id: 'var-2',
      sku: 'ISB-9000-B2',
      grade: 'A572 High-Strength',
      stockBadge: { text: '850T in stock', type: 'low-stock' },
      length: '12 Meters',
      thickness: '12 mm',
      finish: 'Primed',
      weight: '58 kg/m',
      price: 520,
      unit: 'ton',
    },
    {
      id: 'var-3',
      sku: 'ISB-9000-C3',
      grade: 'A992 Structural',
      stockBadge: { text: '3 Wk Lead Time', type: 'lead-time' },
      length: '15 Meters',
      thickness: '15 mm',
      finish: 'Bare',
      weight: '75 kg/m',
      price: 610,
      unit: 'ton',
      isPreOrder: true,
    },
  ])

  useEffect(() => {
    let mounted = true
    const fetchProduct = async () => {
      setLoading(true)
      try {
        const url = productId ? `/api/products/${productId}` : '/api/products?limit=1'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          const p = data.data || (Array.isArray(data) ? data[0] : data)
          if (mounted && p) {
            setProduct({
              id: p.id || 'prod-beam',
              name: p.name || 'Standard H-Beam Structure',
              sku: p.sku || p.tags?.[0] || 'ISB-9000-X',
              description: p.description || 'High-strength structural steel beams designed for commercial construction. Select from available variants below or request custom dimensions for specialized projects.',
              priceFrom: p.base_price || 450,
              moq: `${p.moq || 10} ${p.unit || 'Tons'}`,
              image: p.images?.[0]?.url || 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=80',
            })
          }
        }
      } catch (e) {
        console.error('Failed to load variants:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProduct()
    return () => { mounted = false }
  }, [productId])

  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (activeFilter === 'instock') return v.stockBadge.type === 'in-stock'
      if (activeFilter === 'long') return parseInt(v.length) >= 12
      return true
    })
  }, [variants, activeFilter])

  const handleAddToCart = useCallback((v: VariantItem) => {
    addItem({
      id: `cart-${v.id}-${Date.now()}`,
      productId: product.id,
      productName: `${product.name} (${v.sku})`,
      productSlug: product.id,
      productImage: product.image,
      variantId: v.id,
      variantName: v.sku,
      variantValue: v.grade,
      quantity: 10,
      unitPrice: v.price,
      totalPrice: v.price * 10,
      moq: 10,
      maxOrderQty: null,
      supplierId: '',
      supplierName: 'Industrial Metals Corp',
      supplierSlug: '',
      unit: v.unit,
      priceTiers: [],
    })
    navigate('cart')
  }, [product, addItem, navigate])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={goBack} className="md:hidden p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-bold text-slate-900 truncate">
              {product.name}
            </h1>
          </div>
          <button className="p-1 text-slate-700 hover:text-slate-900">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-4xl md:px-6 md:py-8 md:space-y-6">
        {/* Main Product Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
          <div className="relative aspect-[16/9] rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
              <Package className="h-3 w-3 text-slate-500" />
              SKU: {product.sku}
            </span>
            <h2 className="text-base font-black text-slate-900 mt-1 leading-snug">
              {product.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {product.description}
            </p>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-sm font-black text-primary">
                From {formatPrice(product.priceFrom)} / ton
              </span>
              <span className="text-xs text-slate-400 font-medium">
                MOQ: {product.moq}
              </span>
            </div>
          </div>

          {/* Request Custom Variant Button */}
          <Button
            variant="outline"
            onClick={() => navigate('product-detail', { productId: product.id })}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Wrench className="h-4 w-4" />
            Request Custom Variant
          </Button>
        </div>

        {/* Quick Filters */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <span className="text-xs font-bold text-slate-700 shrink-0">Quick Filters:</span>
            {[
              { key: 'all', label: 'All Variants (24)' },
              { key: 'instock', label: 'In Stock Only' },
              { key: 'long', label: 'Length > 10m' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <Info className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Prices reflect wholesale tiers</span>
          </div>
        </div>

        {/* Variant Cards List */}
        <div className="space-y-3">
          {filteredVariants.map((v) => {
            return (
              <div
                key={v.id}
                className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3"
              >
                {/* Variant Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900">{v.sku}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{v.grade}</p>
                  </div>

                  {/* Stock Badge */}
                  {v.stockBadge.type === 'in-stock' && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {v.stockBadge.text}
                    </Badge>
                  )}
                  {v.stockBadge.type === 'low-stock' && (
                    <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {v.stockBadge.text}
                    </Badge>
                  )}
                  {v.stockBadge.type === 'lead-time' && (
                    <Badge className="bg-slate-100 text-slate-700 border-none text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {v.stockBadge.text}
                    </Badge>
                  )}
                </div>

                {/* Specs 2x2 Grid */}
                <div className="bg-slate-50/70 rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Length
                    </span>
                    <span className="font-bold text-slate-800">{v.length}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Thickness
                    </span>
                    <span className="font-bold text-slate-800">{v.thickness}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Finish
                    </span>
                    <span className="font-bold text-slate-800">{v.finish}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Weight
                    </span>
                    <span className="font-bold text-slate-800">{v.weight}</span>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                  <span className="text-sm font-black text-primary">
                    {formatPrice(v.price)} <span className="text-[10px] font-normal text-slate-400">/ {v.unit}</span>
                  </span>

                  {v.isPreOrder ? (
                    <Button
                      variant="outline"
                      onClick={() => handleAddToCart(v)}
                      className="h-8 px-4 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 rounded-xl flex items-center gap-1.5 shadow-none"
                    >
                      <Bell className="h-3 w-3" />
                      Pre-Order
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleAddToCart(v)}
                      className="h-8 px-4 text-xs font-bold bg-slate-100 hover:bg-primary text-slate-800 hover:text-white rounded-xl flex items-center gap-1.5 shadow-none transition-colors border border-slate-200"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Add
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
