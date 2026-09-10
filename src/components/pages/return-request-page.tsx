'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Camera, X, Minus, Plus, CheckCircle2,
  Package, ChevronRight, AlertCircle
} from 'lucide-react'

export function ReturnRequestPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || 'ORD-88291-B'

  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({ 'item-1': true })
  const [quantities, setQuantities] = useState<Record<string, number>>({ 'item-1': 1, 'item-2': 1 })
  const [reasons, setReasons] = useState<Record<string, string>>({ 'item-1': 'damaged' })
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const items = [
    {
      id: 'item-1',
      name: 'DeWalt 20V MAX Cordless Drill / Driver Kit, Compact...',
      sku: 'DW20V-COMP',
      price: 129.99,
      orderedQty: 2,
      image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'item-2',
      name: 'Heavy Duty Shipping Boxes, 18×18×18 inches...',
      sku: 'BOX-18HD-25',
      price: 45.00,
      orderedQty: 5,
      unit: 'pack',
      image: 'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=500&auto=format&fit=crop&q=80',
    },
  ]

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleQtyChange = (id: string, delta: number, max: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, Math.min(max, (prev[id] || 1) + delta)),
    }))
  }

  const selectedCount = Object.keys(selectedItems).filter((k) => selectedItems[k]).length
  const totalRefund = items.reduce((acc, item) => {
    if (selectedItems[item.id]) {
      return acc + item.price * (quantities[item.id] || 1)
    }
    return acc
  }, 0)

  const handleContinue = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      navigate('return-detail', { orderId })
    }, 800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-primary">Return Request</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <h1 className="hidden md:block text-2xl font-bold text-primary">Return Request</h1>
        {/* Progress Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-bold text-slate-900">Order #{orderId}</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Delivered on Oct 24, 2023</p>
            </div>
            <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-md">
              Step 1 of 3
            </span>
          </div>

          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full w-1/3" />
          </div>

          <p className="text-[11px] text-slate-500 font-medium">Select items to return</p>
        </div>

        {/* Section: Select Items */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-900">Select Items</h2>

          {items.map((item) => {
            const isSelected = !!selectedItems[item.id]
            const qty = quantities[item.id] || 1

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border transition-all overflow-hidden shadow-2xs ${
                  isSelected ? 'border-primary ring-1 ring-primary/20 border-l-4 border-l-primary' : 'border-slate-200'
                }`}
              >
                {/* Item Header */}
                <div className="p-4 flex gap-3 items-start">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 rounded text-primary accent-primary mt-1 shrink-0 cursor-pointer"
                  />

                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      SKU: {item.sku}
                    </p>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-xs font-black text-primary">
                        {formatPrice(item.price)} <span className="text-[10px] font-normal text-slate-400">/ {item.unit || 'unit'}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Qty: {item.orderedQty}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Return Details Form (Shown if item is checked) */}
                {isSelected && (
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 space-y-4">
                    {/* Reason */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Reason for Return *
                      </label>
                      <select
                        value={reasons[item.id] || 'damaged'}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full h-11 rounded-2xl bg-white border border-slate-200 text-xs font-medium px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="damaged">Damaged on arrival</option>
                        <option value="wrong">Wrong item received</option>
                        <option value="defect">Manufacturing defect</option>
                        <option value="specs">Not as specified in catalog</option>
                      </select>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Quantity to Return
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                          <button
                            onClick={() => handleQtyChange(item.id, -1, item.orderedQty)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-10 text-center text-xs font-bold text-slate-900">
                            {qty}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, 1, item.orderedQty)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs text-slate-400">of {item.orderedQty} ordered</span>
                      </div>
                    </div>

                    {/* Upload Evidence */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-800">
                          Upload Evidence (Required) *
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">1/3 Photos</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Please provide clear photos of the damage or incorrect item.
                      </p>

                      <div className="flex gap-2.5 pt-1">
                        {/* Uploaded Thumbnail */}
                        <div className="relative w-16 h-16 rounded-2xl bg-slate-200 border border-slate-300 overflow-hidden shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200&auto=format&fit=crop&q=80"
                            alt="Damage evidence"
                            className="w-full h-full object-cover"
                          />
                          <button className="absolute top-1 right-1 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>

                        {/* Add Button */}
                        <button
                          type="button"
                          className="w-16 h-16 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/30 hover:bg-rose-50/60 flex flex-col items-center justify-center gap-1 text-primary shrink-0 transition-colors"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">Add</span>
                        </button>
                      </div>
                    </div>

                    {/* Additional Comments */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Additional Comments
                      </label>
                      <Textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="Describe the issue in detail..."
                        rows={2}
                        className="rounded-2xl bg-white border-slate-200 text-xs font-medium resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg md:max-w-2xl mx-auto space-y-2">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-slate-500">Items Selected: <strong>{selectedCount} item (Qty: 1)</strong></span>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] block">Estimated Refund:</span>
              <span className="text-sm font-black text-primary">{formatPrice(totalRefund)}</span>
            </div>
          </div>

          <Button
            onClick={handleContinue}
            disabled={selectedCount === 0 || submitting}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? 'Processing Request...' : 'Continue to Shipping Method'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ReturnRequestPage
