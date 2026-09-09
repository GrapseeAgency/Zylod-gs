'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, HelpCircle, Check, CheckCircle2,
  Package, ChevronRight, AlertCircle
} from 'lucide-react'

interface ReplacementOption {
  id: string
  title: string
  sku: string
  stock: number
  priceDiffTotal: number
  priceDiffUnit: number
  outOfStock?: boolean
}

export function ExchangeRequestPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const originalItem = {
    name: 'Industrial Roller Bearing SKF-992',
    sku: 'IND-BR-992-M',
    size: 'Medium (50mm)',
    material: 'Steel',
    qty: 50,
    price: 1250.00,
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
  }

  const replacementOptions: ReplacementOption[] = [
    {
      id: 'opt-1',
      title: 'Large (75mm) / Steel',
      sku: 'IND-BR-992-L',
      stock: 8400,
      priceDiffTotal: 250.00,
      priceDiffUnit: 5.00,
    },
    {
      id: 'opt-2',
      title: 'Medium (50mm) / Ceramic',
      sku: 'IND-BR-992-MC',
      stock: 1200,
      priceDiffTotal: 750.00,
      priceDiffUnit: 15.00,
    },
    {
      id: 'opt-3',
      title: 'Small (25mm) / Steel',
      sku: 'IND-BR-992-S',
      stock: 0,
      priceDiffTotal: -150.00,
      priceDiffUnit: -3.00,
      outOfStock: true,
    },
  ]

  const [selectedId, setSelectedId] = useState<string>('opt-1')
  const [submitting, setSubmitting] = useState(false)

  const selectedOpt = replacementOptions.find((o) => o.id === selectedId) || replacementOptions[0]
  const newTotalValue = originalItem.price + selectedOpt.priceDiffTotal
  const balanceDue = selectedOpt.priceDiffTotal

  const handleContinue = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      navigate('my-orders')
    }, 800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Exchange Request</h1>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-700" title="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl">
        {/* 3-Step Progress */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between px-3">
            {/* Step 1: Select (Active) */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                1
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Select</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

            {/* Step 2: Reason */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <span className="text-[10px] font-medium text-slate-400 mt-1">Reason</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

            {/* Step 3: Review */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <span className="text-[10px] font-medium text-slate-400 mt-1">Review</span>
            </div>
          </div>
        </div>

        {/* Card 1: Original Item */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
            ORIGINAL ITEM
          </span>

          <div className="flex gap-3 items-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
              <img src={originalItem.image} alt={originalItem.name} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                {originalItem.name}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">SKU: {originalItem.sku}</p>

              <div className="flex gap-1.5 mt-1.5">
                <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-md">
                  Size: {originalItem.size}
                </span>
                <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-md">
                  Material: {originalItem.material}
                </span>
              </div>

              <div className="flex justify-between items-baseline mt-2">
                <span className="text-xs text-slate-500 font-medium">Qty: {originalItem.qty} units</span>
                <span className="text-xs font-black text-primary">{formatPrice(originalItem.price)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Replacement Selection */}
        <div className="space-y-2.5">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
              REPLACEMENT SELECTION
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Select the new variant you wish to receive.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {replacementOptions.map((opt) => {
              const isSelected = selectedId === opt.id
              const isOOS = opt.outOfStock

              return (
                <button
                  key={opt.id}
                  disabled={isOOS}
                  onClick={() => setSelectedId(opt.id)}
                  className={`w-full text-left bg-white rounded-3xl p-4 border transition-all shadow-2xs ${
                    isOOS
                      ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                      : isSelected
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900">{opt.title}</h3>
                        {isOOS && (
                          <span className="bg-slate-200 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-md">
                            Out of Stock
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">SKU: {opt.sku}</p>
                    </div>

                    {!isOOS && (
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-50 flex justify-between items-baseline text-xs">
                    <span className="text-[11px] text-slate-500">In Stock: {opt.stock.toLocaleString()}</span>
                    <span className="text-xs font-black text-slate-800">
                      {opt.priceDiffTotal >= 0 ? `+$${opt.priceDiffTotal.toFixed(2)} total` : `-$${Math.abs(opt.priceDiffTotal).toFixed(2)} total`}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        ({opt.priceDiffUnit >= 0 ? `+ $${opt.priceDiffUnit.toFixed(2)}/unit` : `- $${Math.abs(opt.priceDiffUnit).toFixed(2)}/unit`})
                      </span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Card 3: Exchange Summary */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
            EXCHANGE SUMMARY
          </h2>

          <div className="space-y-1.5 text-xs text-slate-500 pt-1">
            <div className="flex justify-between">
              <span>Original Value ({originalItem.qty} units)</span>
              <span className="font-semibold text-slate-900">{formatPrice(originalItem.price)}</span>
            </div>
            <div className="flex justify-between">
              <span>New Value ({originalItem.qty} units)</span>
              <span className="font-semibold text-slate-900">{formatPrice(newTotalValue)}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-900">Balance Due</span>
              <span className="text-base font-black text-primary">{formatPrice(balanceDue)}</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400">
            Applicable taxes and shipping calculated at final step.
          </p>

          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              onClick={goBack}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
            >
              Cancel Exchange
            </Button>

            <Button
              onClick={handleContinue}
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              {submitting ? 'Processing...' : 'Continue to Reason'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ExchangeRequestPage
