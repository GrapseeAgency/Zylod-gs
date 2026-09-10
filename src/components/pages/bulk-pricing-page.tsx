'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  QrCode, Bell, ShoppingCart, FileText,
  ShieldCheck, Lock, Package, ArrowDownRight, CheckCircle2
} from 'lucide-react'

interface Tier {
  id: number
  label: string
  minQty: number
  maxQty: number | null
  price: number
  discountPercent: number
}

interface ProductDetail {
  id: string
  name: string
  sku: string
  basePrice: number
  supplierName: string
  supplierVerified: boolean
  stock: number
  shipsIn: string
  images: { url: string }[]
  tiers: Tier[]
}

export function BulkPricingPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''

  const [quantity, setQuantity] = useState(150)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)

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
            const base = p.base_price || p.basePrice || 12.5
            setProduct({
              id: p.id || 'p-bearing',
              name: p.name || 'Premium Industrial Bearings (6204-2RS)',
              sku: p.sku || p.tags?.[0] || 'IN-B-998',
              basePrice: base,
              supplierName: p.supplier_name || p.supplier?.companyName || 'Apex Industrial Corp.',
              supplierVerified: true,
              stock: p.stock || p.stockQuantity || 5420,
              shipsIn: 'Ships Tomorrow',
              images: Array.isArray(p.images) ? p.images : [],
              tiers: [
                { id: 1, label: '1 - 50', minQty: 1, maxQty: 50, price: base, discountPercent: 0 },
                { id: 2, label: '51 - 100', minQty: 51, maxQty: 100, price: +(base * 0.9).toFixed(2), discountPercent: 10 },
                { id: 3, label: '101 - 499', minQty: 101, maxQty: 499, price: +(base * 0.76).toFixed(2), discountPercent: 24 },
                { id: 4, label: '500 - 999', minQty: 500, maxQty: 999, price: +(base * 0.64).toFixed(2), discountPercent: 36 },
                { id: 5, label: '1000+', minQty: 1000, maxQty: null, price: +(base * 0.58).toFixed(2), discountPercent: 42 },
              ],
            })
          }
        }
      } catch (e) {
        console.error('Failed to load product for bulk pricing:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProduct()
    return () => { mounted = false }
  }, [productId])

  // Compute active tier
  const activeTier = useMemo(() => {
    if (!product) return null
    return product.tiers.find(
      (t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)
    ) || product.tiers[0]
  }, [product, quantity])

  // Calculations
  const unitPrice = activeTier?.price || product?.basePrice || 12.5
  const baseSubtotal = (product?.basePrice || 12.5) * quantity
  const volumePrice = unitPrice * quantity
  const savings = baseSubtotal - volumePrice

  const handleAddToCart = useCallback(() => {
    if (!product) return
    addItem({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.id,
      productImage: product.images[0]?.url || null,
      variantId: null,
      variantName: null,
      variantValue: null,
      quantity,
      unitPrice,
      totalPrice: volumePrice,
      moq: 1,
      maxOrderQty: null,
      supplierId: '',
      supplierName: product.supplierName,
      supplierSlug: '',
      unit: 'unit',
      priceTiers: [],
    })
    navigate('cart')
  }, [product, quantity, unitPrice, volumePrice, addItem, navigate])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
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

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4 md:max-w-3xl lg:max-w-4xl md:py-6 md:space-y-6">
        {/* Title & SKU */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
            Bulk Pricing Calculator
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Adjust quantity to see real-time volume discounts for {product?.name || 'industrial parts'} (SKU: {product?.sku || 'IN-B-998'}).
          </p>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
              In Stock: {product?.stock.toLocaleString() || '5,420'}
            </span>
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
              Ships Tomorrow
            </span>
          </div>
        </div>

        {/* Product Snippet */}
        {loading ? (
          <div className="bg-white rounded-3xl p-3 border border-slate-100 flex items-center gap-3">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ) : product ? (
          <div className="bg-white rounded-3xl p-3 border border-slate-200 flex items-center gap-3 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
              {product.images[0]?.url ? (
                <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{product.name}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Supplier: {product.supplierName} • Verified Supplier
              </p>
              <p className="text-xs font-bold text-primary mt-1">
                Base Price: {formatPrice(product.basePrice)} / unit
              </p>
            </div>
          </div>
        ) : null}

        {/* Quantity Selector Slider */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Select Quantity</span>
            <div className="bg-primary text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span>{quantity.toLocaleString()} Units</span>
            </div>
          </div>

          <Slider
            value={[quantity]}
            min={1}
            max={1200}
            step={10}
            onValueChange={([val]) => setQuantity(val)}
            className="py-2"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
            <span>1</span>
            <span>250</span>
            <span>500</span>
            <span>750</span>
            <span>1000+</span>
          </div>

          {/* Current Tier Result Box */}
          {activeTier && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                CURRENT TIER: TIER {activeTier.id} ({activeTier.label})
              </span>
              <div className="text-xl md:text-3xl font-black text-slate-900">
                {formatPrice(activeTier.price)} <span className="text-xs font-normal text-slate-500">/ unit</span>
              </div>
              {activeTier.discountPercent > 0 && (
                <div className="text-xs font-bold text-primary flex items-center justify-center gap-1">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>DISCOUNT APPLIED: {activeTier.discountPercent}% OFF</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Volume Discount Tiers Table */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">Volume Discount Tiers</h3>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400">
                <th className="p-3">Quantity</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3">Discount</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {product?.tiers.map((t) => {
                const isActive = activeTier?.id === t.id
                return (
                  <tr
                    key={t.id}
                    className={`transition-colors ${
                      isActive ? 'bg-rose-50/60 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <td className="p-3">{t.label}</td>
                    <td className="p-3">{formatPrice(t.price)}</td>
                    <td className="p-3 text-primary">
                      {t.discountPercent > 0 ? `${t.discountPercent}% OFF` : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {isActive ? (
                        <Badge className="bg-primary text-white border-none text-[9px] font-bold px-2 py-0.5 rounded-full">
                          Active
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-3xl p-5 border-2 border-rose-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-900">Order Summary</h3>

          <div className="space-y-2 text-xs divide-y divide-slate-50">
            <div className="flex justify-between py-1 text-slate-500">
              <span>Base Price (1 unit)</span>
              <span className="font-semibold text-slate-800">{formatPrice(product?.basePrice || 12.5)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-500">
              <span>Quantity</span>
              <span className="font-semibold text-slate-800">{quantity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-500">
              <span>Subtotal (Base)</span>
              <span className="line-through text-slate-400">{formatPrice(baseSubtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm font-black text-primary">
              <span>Volume Price</span>
              <span>{formatPrice(volumePrice)}</span>
            </div>
          </div>

          {/* Total Savings Highlight */}
          {savings > 0 && (
            <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-black uppercase text-primary tracking-wider block">
                Total Savings
              </span>
              <div className="text-lg font-black text-primary mt-0.5">
                {formatPrice(savings)}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">By ordering in bulk today.</p>
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handleAddToCart}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('product-detail', { productId: product?.id || '' })}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Request Formal Quote
            </Button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="space-y-2 pt-1 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Trade Assurance protects your orders.</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span>Secure payment processing.</span>
          </div>
        </div>
      </main>
    </div>
  )
}
