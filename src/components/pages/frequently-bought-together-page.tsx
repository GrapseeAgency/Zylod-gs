'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, Bell, ShoppingCart, Truck, Check, Package
} from 'lucide-react'

interface BundleItem {
  id: string
  name: string
  price: number
  moq: number
  unit: string
  image: string
  isCurrent?: boolean
  selected: boolean
}

export function FrequentlyBoughtTogetherPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<BundleItem[]>([
    {
      id: 'b-1',
      name: 'Pro-Grade Hammer Drill 20V',
      price: 120.0,
      moq: 10,
      unit: 'unit',
      image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
      isCurrent: true,
      selected: true,
    },
    {
      id: 'b-2',
      name: 'Titanium Drill Bit Set (50pc)',
      price: 35.0,
      moq: 20,
      unit: 'unit',
      image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=500&auto=format&fit=crop&q=80',
      selected: true,
    },
    {
      id: 'b-3',
      name: 'Heavy Duty Work Gloves (Pack of 5)',
      price: 15.0,
      moq: 50,
      unit: 'pack',
      image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=80',
      selected: false,
    },
  ])

  useEffect(() => {
    let mounted = true
    const fetchBundle = async () => {
      setLoading(true)
      try {
        const url = productId ? `/api/products/${productId}` : '/api/products?limit=3'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          const p = data.data || (Array.isArray(data) ? data : [])
          if (mounted && Array.isArray(p) && p.length > 1) {
            setItems([
              {
                id: p[0]?.id || 'b-1',
                name: p[0]?.name || 'Pro-Grade Hammer Drill 20V',
                price: p[0]?.base_price || 120.0,
                moq: p[0]?.moq || 10,
                unit: p[0]?.unit || 'unit',
                image: p[0]?.images?.[0]?.url || 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
                isCurrent: true,
                selected: true,
              },
              {
                id: p[1]?.id || 'b-2',
                name: p[1]?.name || 'Titanium Drill Bit Set (50pc)',
                price: p[1]?.base_price || 35.0,
                moq: p[1]?.moq || 20,
                unit: p[1]?.unit || 'unit',
                image: p[1]?.images?.[0]?.url || 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=500&auto=format&fit=crop&q=80',
                selected: true,
              },
              {
                id: p[2]?.id || 'b-3',
                name: p[2]?.name || 'Heavy Duty Work Gloves (Pack of 5)',
                price: p[2]?.base_price || 15.0,
                moq: p[2]?.moq || 50,
                unit: p[2]?.unit || 'pack',
                image: p[2]?.images?.[0]?.url || 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=80',
                selected: false,
              },
            ])
          }
        }
      } catch (err) {
        console.error('Failed to load bundle:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchBundle()
    return () => { mounted = false }
  }, [productId])

  const toggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const selectedItems = useMemo(() => items.filter((i) => i.selected), [items])
  const subtotal = useMemo(() => selectedItems.reduce((acc, i) => acc + i.price, 0), [selectedItems])
  const discountAmount = useMemo(() => (selectedItems.length > 1 ? +(subtotal * 0.1).toFixed(2) : 0), [subtotal, selectedItems])
  const totalBundlePrice = subtotal - discountAmount

  const handleAddBundleToCart = useCallback(() => {
    selectedItems.forEach((item) => {
      addItem({
        id: `cart-${item.id}-${Date.now()}`,
        productId: item.id,
        productName: item.name,
        productSlug: item.id,
        productImage: item.image,
        variantId: null,
        variantName: null,
        variantValue: null,
        quantity: item.moq,
        unitPrice: item.price,
        totalPrice: item.price * item.moq,
        moq: item.moq,
        maxOrderQty: null,
        supplierId: '',
        supplierName: 'Verified Supplier',
        supplierSlug: '',
        unit: item.unit,
        priceTiers: [],
      })
    })
    navigate('cart')
  }, [selectedItems, addItem, navigate])

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4 md:max-w-5xl md:px-6 md:py-6 md:space-y-5">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
            Frequently Bought Together
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Boost your inventory with these synergistic products.
          </p>
        </div>

        <div className="space-y-4 md:space-y-5 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0 lg:items-start">
        {/* Bundle Items Container */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-6 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5">
          {items.map((item, idx) => (
            <div key={item.id} className="space-y-3">
              {/* Product Preview Box */}
              <div className="relative w-full aspect-square rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                {item.isCurrent && (
                  <Badge className="absolute top-3 left-3 bg-white text-primary border-none font-bold text-[10px] px-2 py-0.5 rounded shadow-xs">
                    Current
                  </Badge>
                )}
              </div>

              {/* Product Meta */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 leading-snug">
                  {item.name}
                </h3>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-black text-primary">
                    {formatPrice(item.price)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">/ {item.unit}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">MOQ: {item.moq}</p>

                {/* Checkbox Trigger */}
                <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleSelect(item.id)}
                    className="w-4 h-4 rounded text-primary accent-primary focus:ring-primary"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {item.isCurrent ? 'Included' : 'Add to bundle'}
                  </span>
                </label>
              </div>

              {/* Divider if not last */}
              {idx < items.length - 1 && <div className="border-b border-slate-100 pt-2 md:hidden" />}
            </div>
          ))}
          </div>
        </div>

        {/* Bundle Summary Card */}
        <div className="bg-white rounded-3xl p-5 border-2 border-rose-100 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-900">Bundle Summary</h2>

          <div className="space-y-2 text-xs divide-y divide-slate-50">
            <div className="flex justify-between py-1 text-slate-500">
              <span>Items ({selectedItems.length} selected)</span>
              <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between py-1 text-primary font-bold">
                <span>Bundle Discount (10%)</span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-xs font-bold text-slate-800">Total Bundle Price</span>
              <div className="text-right">
                <div className="text-xl font-black text-primary">
                  {formatPrice(totalBundlePrice)}
                </div>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  Per unit equivalent
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handleAddBundleToCart}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <ShoppingCart className="h-4 w-4" />
              Add Bundle to Cart
            </Button>
            <Button
              variant="outline"
              onClick={handleAddBundleToCart}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
            >
              Add Individual Items
            </Button>
          </div>

          {/* Expedited shipping note */}
          <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-3 flex items-start gap-2.5 text-[10px] text-slate-600">
            <Truck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Ordering this bundle qualifies for <strong className="text-primary font-bold">expedited warehouse processing</strong>.
            </p>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

export default FrequentlyBoughtTogetherPage
