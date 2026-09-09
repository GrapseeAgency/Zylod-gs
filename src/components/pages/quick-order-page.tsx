'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, QrCode, Minus, Plus, ShoppingCart,
  Save, RotateCcw, Package, CheckCircle2, ScanLine
} from 'lucide-react'

interface QuickOrderItem {
  id: string
  sku: string
  name: string
  price: number
  unit: string
  quantity: number
  image?: string
}

export function QuickOrderPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const [inputSku, setInputSku] = useState('')
  const [autoAddOnScan, setAutoAddOnScan] = useState(true)

  const [orderItems, setOrderItems] = useState<QuickOrderItem[]>([
    {
      id: 'qo-1',
      sku: 'IND-DB-882',
      name: 'Pro-Grade Carbide Drill Bits Box (25pc)',
      price: 45.00,
      unit: 'unit',
      quantity: 10,
    },
    {
      id: 'qo-2',
      sku: 'CLN-MF-YEL-50',
      name: 'Heavy Duty Microfiber Cleaning Cloths (Pack of 50)',
      price: 22.50,
      unit: 'unit',
      quantity: 25,
      image: 'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'qo-3',
      sku: 'EL-WIR-12G-100',
      name: 'Industrial Stranded Copper Wire 12AWG 100m Spool',
      price: 85.00,
      unit: 'unit',
      quantity: 5,
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
    },
  ])

  const handleQtyChange = (id: string, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta)
          return { ...item, quantity: newQty }
        }
        return item
      })
    )
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputSku.trim()) return

    const newItem: QuickOrderItem = {
      id: `qo-${Date.now()}`,
      sku: inputSku.trim().toUpperCase(),
      name: `Catalog Product (${inputSku.trim().toUpperCase()})`,
      price: 32.00,
      unit: 'unit',
      quantity: 10,
    }

    setOrderItems((prev) => [newItem, ...prev])
    setInputSku('')
  }

  const handleClearAll = () => {
    setOrderItems([])
  }

  const subtotal = useMemo(() => {
    return orderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0)
  }, [orderItems])

  const handleAddToCart = useCallback(() => {
    orderItems.forEach((item) => {
      addItem({
        id: `cart-${item.id}-${Date.now()}`,
        productId: item.id,
        productName: item.name,
        productSlug: item.sku.toLowerCase(),
        productImage: item.image || null,
        variantId: null,
        variantName: item.sku,
        variantValue: null,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        moq: 1,
        maxOrderQty: null,
        supplierId: '',
        supplierName: 'Wholesale Supplier',
        supplierSlug: '',
        unit: item.unit,
        priceTiers: [],
      })
    })
    navigate('cart')
  }, [orderItems, addItem, navigate])

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-8 md:space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">Quick Order</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rapidly add items by SKU or scanning barcodes.
          </p>
        </div>

        {/* SKU / Barcode Input Box */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <form onSubmit={handleAddItem} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={inputSku}
                onChange={(e) => setInputSku(e.target.value)}
                placeholder="Enter SKU or scan barcode"
                className="h-11 pl-4 pr-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                title="Scan barcode"
              >
                <ScanLine className="h-4 w-4" />
              </button>
            </div>

            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-5 rounded-2xl text-xs shadow-sm"
            >
              Add
            </Button>
          </form>

          {/* Auto-add checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={autoAddOnScan}
              onChange={(e) => setAutoAddOnScan(e.target.checked)}
              className="w-4 h-4 rounded text-primary accent-primary"
            />
            <span>Auto-add on scan</span>
          </label>
        </div>

        {/* Current Order Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">
              Current Order ({orderItems.length} items)
            </h2>
            {orderItems.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Item Cards */}
          <div className="space-y-3">
            {orderItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail / Placeholder */}
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">img</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      SKU: {item.sku}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-xs font-black text-primary mt-0.5">
                      {formatPrice(item.price)} / {item.unit}
                    </p>
                  </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50/80 p-1 shrink-0">
                  <button
                    onClick={() => handleQtyChange(item.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-slate-800 tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleQtyChange(item.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Sticky Bottom Summary Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-500">
              Subtotal ({orderItems.length} items)
            </span>
            <div className="text-lg font-black text-primary">
              {formatPrice(subtotal)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('buyer-dashboard')}
              className="h-12 rounded-2xl text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
            >
              Save Draft
            </Button>
            <Button
              onClick={handleAddToCart}
              className="h-12 rounded-2xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickOrderPage
