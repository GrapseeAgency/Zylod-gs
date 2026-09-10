'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Check, ShieldCheck, FileText, Package, Star,
  ArrowLeft, CheckCircle2
} from 'lucide-react'

export function DeliveryConfirmationPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || 'WH-8472-BX'

  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)

  const handleRate = (star: number) => {
    setRating(star)
    setRated(true)
  }

  const items = [
    {
      name: 'Industrial Servo Motors (Type A)',
      sku: 'SM-9921',
      qty: 12,
    },
    {
      name: 'Heavy Duty Ball Bearings',
      sku: 'BB-4432',
      qty: 50,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      <main className="px-4 py-8 md:px-6 space-y-5 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        {/* Success Icon & Heading */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Check className="h-8 w-8 stroke-[3]" />
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Order Delivered Successfully
          </h1>
          <p className="text-xs text-slate-500">
            Order #{orderId} delivered on Oct 24, 14:32
          </p>
        </div>

        {/* Card 1: Proof of Delivery */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="aspect-[16/9] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80"
              alt="Delivered crates"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-bold text-slate-900">Proof of Delivery</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Signed by: J. Smith (Dock Receiver)
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('delivery-proof', { orderId })}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" />
            View Proof of Delivery
          </Button>
        </div>

        {/* Card 2: Items Received */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-start">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold text-slate-900">Items Received</h2>
          </div>

          <div className="divide-y divide-slate-100 space-y-2 pt-1">
            {items.map((item, idx) => (
              <div key={idx} className={`flex justify-between items-center ${idx > 0 ? 'pt-2' : ''}`}>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{item.name}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">SKU: {item.sku}</p>
                </div>
                <span className="bg-slate-100 text-slate-700 text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                  x{item.qty}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Rate Delivery */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs text-center space-y-3">
          <div>
            <h2 className="text-xs font-bold text-slate-900">Rate Delivery</h2>
            <p className="text-xs text-slate-400 mt-0.5">How was the logistics service?</p>
          </div>

          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRate(star)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-7 w-7 ${
                    star <= rating
                      ? 'fill-amber-400 stroke-amber-400'
                      : 'stroke-slate-300 fill-transparent'
                  }`}
                />
              </button>
            ))}
          </div>

          {rated && (
            <p className="text-[11px] font-bold text-emerald-600">
              Thank you for rating the carrier!
            </p>
          )}
        </div>
        </div>

        {/* Return to Dashboard */}
        <div className="text-center pt-2">
          <button
            onClick={() => navigate('buyer-dashboard')}
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </main>
    </div>
  )
}

export default DeliveryConfirmationPage
