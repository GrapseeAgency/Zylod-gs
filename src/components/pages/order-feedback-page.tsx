'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Menu, Search, ArrowLeft, Star, Building2, Package,
  CheckCircle2, Send
} from 'lucide-react'

export function OrderFeedbackPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const refCode = pageParams.refCode || 'WBD-99201-XYZ'

  const [qualityRating, setQualityRating] = useState(3)
  const [shippingRating, setShippingRating] = useState(5)
  const [commRating, setCommRating] = useState(2)
  const [reviewText, setReviewText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const getLabel = (stars: number) => {
    switch (stars) {
      case 5: return 'Excellent'
      case 4: return 'Good'
      case 3: return 'Average'
      case 2: return 'Fair'
      case 1: return 'Poor'
      default: return 'Rate'
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Header */}
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

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6 md:max-w-3xl lg:max-w-4xl md:space-y-6">
        {/* Back Link */}
        <button
          onClick={() => navigate('orders')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Order History</span>
        </button>

        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
            Order Feedback &amp; Issues
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 font-medium">
            Ref: #{refCode} • Delivered on Oct 24, 2023
          </p>
        </div>

        {/* Product Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex gap-3.5 items-start">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
            <img
              src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80"
              alt="Microcontrollers"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-bold text-slate-900 leading-snug">
              Bulk Industrial Microcontrollers - ATmega328P (Tray of 500)
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
              <span>Supplier: TechComponent Solutions Ltd.</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
              <Package className="h-3 w-3 text-slate-400 shrink-0" />
              <span>Qty: 10 Trays (5,000 units)</span>
            </p>
          </div>
        </div>

        {/* Rate Your Experience Section */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-5">
          <h2 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400">
            Rate your experience
          </h2>

          {submitted ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-emerald-900">Feedback Submitted</h3>
              <p className="text-xs text-emerald-700">
                Thank you for reviewing your wholesale supplier order!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Criteria Grid */}
              <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
              {/* Criterion 1: Item Quality */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Item Quality</span>
                  <span className="text-xs font-bold text-slate-500">{getLabel(qualityRating)}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setQualityRating(star)}
                      className="p-1 text-primary transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= qualityRating
                            ? 'fill-primary stroke-primary'
                            : 'stroke-rose-200 fill-transparent'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Criterion 2: Shipping Speed */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Shipping Speed</span>
                  <span className="text-xs font-bold text-slate-500">{getLabel(shippingRating)}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setShippingRating(star)}
                      className="p-1 text-primary transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= shippingRating
                            ? 'fill-primary stroke-primary'
                            : 'stroke-rose-200 fill-transparent'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Criterion 3: Supplier Comm. */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Supplier Comm.</span>
                  <span className="text-xs font-bold text-slate-500">{getLabel(commRating)}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCommRating(star)}
                      className="p-1 text-primary transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= commRating
                            ? 'fill-primary stroke-primary'
                            : 'stroke-rose-200 fill-transparent'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              </div>

              {/* Written Review Textarea */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-slate-700">Detailed Feedback (Optional)</label>
                <Textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share details about packaging quality, delivery punctuality, or vendor cooperation..."
                  rows={3}
                  className="rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
              >
                {submitting ? 'Submitting Review...' : 'Submit Order Feedback'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
