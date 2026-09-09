'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Menu, Search, Tag, Copy, Check, Percent,
  Truck, Sparkles, AlertCircle
} from 'lucide-react'

interface PromoOffer {
  id: string
  categoryTag: string
  discountBadge: string
  title: string
  description: string
  code: string
  hasLeftBorder?: boolean
}

export function CouponPromoPage() {
  const { navigate } = useNavigationStore()
  const [promoInput, setPromoInput] = useState('')
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const offers: PromoOffer[] = [
    {
      id: 'offer-1',
      categoryTag: 'BULK ORDER',
      discountBadge: '10% OFF',
      title: 'Tier 3 Wholesale Discount',
      description: 'Applies to orders exceeding 5,000 units across mixed categories.',
      code: 'TIER310',
      hasLeftBorder: true,
    },
    {
      id: 'offer-2',
      categoryTag: 'LOGISTICS',
      discountBadge: 'FREE SHIP',
      title: 'Complimentary Freight',
      description: 'Free palletized shipping on regional orders over $10k.',
      code: 'FREESHIPB2B',
    },
    {
      id: 'offer-3',
      categoryTag: 'ONBOARDING',
      discountBadge: '5% OFF',
      title: 'New Vendor Welcome',
      description: 'First-time procurement discount for verified wholesale accounts.',
      code: 'NEWVENDOR5',
    },
  ]

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoInput.trim()) return
    setAppliedMsg(`Coupon "${promoInput.toUpperCase()}" applied successfully to your active order!`)
    setTimeout(() => {
      setAppliedMsg(null)
    }, 4000)
  }

  const handleCopyCode = (code: string) => {
    setPromoInput(code)
    setCopiedCode(code)
    navigator.clipboard?.writeText(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

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

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-4xl">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
            Coupons &amp; Promo Codes
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Apply codes to maximize your B2B margins.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <label className="text-xs font-bold text-slate-900 block">
            Enter Promo Code
          </label>

          <form onSubmit={handleApply} className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="E.G. BULK2024"
                className="h-11 pl-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold tracking-wider uppercase text-slate-800"
              />
            </div>

            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-2xl text-xs shadow-sm"
            >
              Apply
            </Button>
          </form>

          {appliedMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2"
            >
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{appliedMsg}</span>
            </motion.div>
          )}
        </div>

        {/* Available Offers Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">Available B2B Offers</h2>
            <span className="text-xs text-slate-400 font-medium">3 active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className={`bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs relative overflow-hidden ${
                  offer.hasLeftBorder ? 'border-l-4 border-l-primary' : ''
                }`}
              >
                {/* Header tags */}
                <div className="flex items-center justify-between">
                  <span className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                    {offer.categoryTag}
                  </span>
                  <span className="text-xs font-black text-primary">
                    {offer.discountBadge}
                  </span>
                </div>

                {/* Content */}
                <div className="mt-2 space-y-1">
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">
                    {offer.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {offer.description}
                  </p>
                </div>

                {/* Coupon Code Pill & Copy Action */}
                <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                  <span className="px-3 py-1 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs font-mono font-bold tracking-wider text-slate-700">
                    {offer.code}
                  </span>

                  <button
                    onClick={() => handleCopyCode(offer.code)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    {copiedCode === offer.code ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <span>Use Code</span>
                        <Copy className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
