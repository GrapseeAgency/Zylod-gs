'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  Menu, Search, ShoppingCart, Tag, RotateCcw,
  Package, LayoutGrid, CheckCircle2, AlertCircle
} from 'lucide-react'

interface MatrixRow {
  color: string
  colorHex: string
  s: number
  m: number
  l: number
}

export function BulkOrderFormPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const product = {
    id: 'bulk-gloves-1',
    name: 'Heavy-Duty Nitrile Industrial Safety Gloves (Level 5 Cut Resistance)',
    sku: 'GLV-IND-500',
    description: 'High-performance cut-resistant gloves designed for heavy manufacturing, metal fabrication, and warehouse material handling.',
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=80',
    moq: 50,
  }

  const [matrix, setMatrix] = useState<MatrixRow[]>([
    { color: 'High-Vis Yellow', colorHex: '#EAB308', s: 0, m: 0, l: 0 },
    { color: 'Industrial Black', colorHex: '#1E293B', s: 0, m: 0, l: 0 },
    { color: 'Safety Orange', colorHex: '#F97316', s: 0, m: 0, l: 0 },
  ])

  const handleQtyChange = (rowIndex: number, size: 's' | 'm' | 'l', val: string) => {
    const num = Math.max(0, parseInt(val) || 0)
    setMatrix((prev) => {
      const next = [...prev]
      next[rowIndex] = { ...next[rowIndex], [size]: num }
      return next
    })
  }

  const handleClearAll = () => {
    setMatrix((prev) => prev.map((r) => ({ ...r, s: 0, m: 0, l: 0 })))
  }

  // Totals calculations
  const totalS = useMemo(() => matrix.reduce((acc, r) => acc + r.s, 0), [matrix])
  const totalM = useMemo(() => matrix.reduce((acc, r) => acc + r.m, 0), [matrix])
  const totalL = useMemo(() => matrix.reduce((acc, r) => acc + r.l, 0), [matrix])
  const totalQty = totalS + totalM + totalL

  // Pricing tiers calculation
  const unitPrice = useMemo(() => {
    if (totalQty >= 1000) return 3.10
    if (totalQty >= 500) return 3.80
    return 4.50
  }, [totalQty])

  const currentTierLabel = useMemo(() => {
    if (totalQty >= 1000) return 'Tier 3 ($3.10)'
    if (totalQty >= 500) return 'Tier 2 ($3.80)'
    return 'Tier 1 ($4.50)'
  }, [totalQty])

  const estimatedTotal = totalQty * unitPrice
  const isValidMoq = totalQty >= product.moq

  const handleAddToCart = useCallback(() => {
    if (!isValidMoq) return
    addItem({
      id: `cart-${product.id}-${Date.now()}`,
      productId: product.id,
      productName: `${product.name} (Assorted Matrix)`,
      productSlug: product.id,
      productImage: product.image,
      variantId: null,
      variantName: 'Matrix Order',
      variantValue: `${totalQty} Units Assorted`,
      quantity: totalQty,
      unitPrice,
      totalPrice: estimatedTotal,
      moq: product.moq,
      maxOrderQty: null,
      supplierId: '',
      supplierName: 'Safety Gloves Manufacturer',
      supplierSlug: '',
      unit: 'prs',
      priceTiers: [],
    })
    navigate('cart')
  }, [product, isValidMoq, totalQty, unitPrice, estimatedTotal, addItem, navigate])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Menu">
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Search">
            <Search className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-5xl md:py-6 md:space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        {/* Product Banner Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 lg:col-span-3">
          <div className="relative aspect-[16/9] w-full rounded-2xl bg-slate-100 overflow-hidden border border-slate-100">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>

          <div>
            <span className="bg-primary text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block">
              SKU: {product.sku}
            </span>
            <h1 className="text-sm md:text-lg font-black text-slate-900 mt-1 leading-snug">
              {product.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Volume Pricing Tiers Box */}
          <div className="bg-white rounded-2xl p-3 border border-rose-100 shadow-2xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span>Volume Pricing Tiers</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-100 text-center pt-1">
              <div className="px-1">
                <span className="text-[10px] text-slate-400 font-medium block">50 - 499 units</span>
                <span className="text-xs font-black text-slate-800">$4.50<span className="text-[9px] font-normal text-slate-400">/pr</span></span>
              </div>
              <div className="px-1">
                <span className="text-[10px] text-slate-400 font-medium block">500 - 999 units</span>
                <span className="text-xs font-black text-primary">$3.80<span className="text-[9px] font-normal text-slate-400">/pr</span></span>
              </div>
              <div className="px-1">
                <span className="text-[10px] text-slate-400 font-medium block">1000+ units</span>
                <span className="text-xs font-black text-primary">$3.10<span className="text-[9px] font-normal text-slate-400">/pr</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Matrix Card */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs lg:col-span-2">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Order Matrix</h2>
            </div>
            <button
              onClick={handleClearAll}
              className="text-xs font-semibold text-slate-400 hover:text-primary flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Clear All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400">
                  <th className="p-3 w-32">Color \ Size</th>
                  <th className="p-3 text-center w-24">Small (S)</th>
                  <th className="p-3 text-center w-24">Medium (M)</th>
                  <th className="p-3 text-center w-24">Large (L)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrix.map((row, rIdx) => (
                  <tr key={row.color}>
                    <td className="p-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-slate-200"
                          style={{ backgroundColor: row.colorHex }}
                        />
                        <span className="line-clamp-1">{row.color}</span>
                      </div>
                    </td>

                    <td className="p-2 text-center">
                      <Input
                        type="number"
                        min={0}
                        value={row.s === 0 ? '' : row.s}
                        placeholder="0"
                        onChange={(e) => handleQtyChange(rIdx, 's', e.target.value)}
                        className="h-9 w-16 mx-auto text-center text-xs font-bold rounded-xl bg-slate-50 border-slate-200"
                      />
                    </td>

                    <td className="p-2 text-center">
                      <Input
                        type="number"
                        min={0}
                        value={row.m === 0 ? '' : row.m}
                        placeholder="0"
                        onChange={(e) => handleQtyChange(rIdx, 'm', e.target.value)}
                        className="h-9 w-16 mx-auto text-center text-xs font-bold rounded-xl bg-slate-50 border-slate-200"
                      />
                    </td>

                    <td className="p-2 text-center">
                      <Input
                        type="number"
                        min={0}
                        value={row.l === 0 ? '' : row.l}
                        placeholder="0"
                        onChange={(e) => handleQtyChange(rIdx, 'l', e.target.value)}
                        className="h-9 w-16 mx-auto text-center text-xs font-bold rounded-xl bg-slate-50 border-slate-200"
                      />
                    </td>
                  </tr>
                ))}

                {/* Column Totals Row */}
                <tr className="bg-slate-50 font-black text-slate-800 text-xs">
                  <td className="p-3 text-[11px] text-slate-500 uppercase tracking-wider">
                    Column Total
                  </td>
                  <td className="p-3 text-center">{totalS}</td>
                  <td className="p-3 text-center">{totalM}</td>
                  <td className="p-3 text-center">{totalL}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Calculation Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 lg:col-span-1">
          <div className="flex justify-between items-baseline">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Quantity</span>
              <div className="text-base font-black text-slate-900">
                {totalQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Current Unit Price</span>
              <div className="text-base font-black text-primary">
                {formatPrice(unitPrice)}
              </div>
            </div>
          </div>

          {/* Tier Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
              <span>{currentTierLabel}</span>
              <span>Minimum order: {product.moq} units</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isValidMoq ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, (totalQty / product.moq) * 100)}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-800">Estimated Total</span>
            <div className="text-xl md:text-2xl font-black text-slate-900">
              {formatPrice(estimatedTotal)}
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={!isValidMoq}
            className={`w-full font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors ${
              isValidMoq
                ? 'bg-primary hover:bg-primary/90 text-white'
                : 'bg-rose-300 text-white cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </Button>
        </div>
      </main>
    </div>
  )
}
