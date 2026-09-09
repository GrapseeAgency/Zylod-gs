'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, AlertTriangle, XCircle, CheckCircle2,
  Package, Check
} from 'lucide-react'

export function CancelOrderPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || '88291A'

  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  const items = [
    {
      id: 'ci-1',
      name: 'Industrial Grade Steel Bearings - Pack of 500',
      price: 450.00,
      qty: 2,
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'ci-2',
      name: 'Heavy Duty Corrugated Boxes (24×24×24) - 100 Bundle',
      price: 120.00,
      qty: 1,
      image: 'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=500&auto=format&fit=crop&q=80',
    },
  ]

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleCancelSubmit = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setCancelled(true)
    }, 1000)
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 bg-rose-50 text-primary rounded-full flex items-center justify-center mb-4 border border-rose-100">
          <XCircle className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Cancellation Requested</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Your request to cancel items on Order #{orderId} has been submitted to the supplier and escrow team.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            Return to My Orders
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Cancel Order #{orderId}</h1>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        {/* Card 1: Step 1 Select Items */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center shrink-0">
              1
            </div>
            <h2 className="text-xs font-black text-slate-900">Select Items to Cancel</h2>
          </div>
          <p className="text-xs text-slate-500">
            Choose the items you wish to remove from your order.
          </p>

          <div className="space-y-3 pt-1 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {items.map((item) => {
              const isChecked = !!selectedItems[item.id]

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                    isChecked
                      ? 'border-primary bg-rose-50/40 ring-1 ring-primary/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer shrink-0"
                  />

                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                      {item.name}
                    </h3>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-xs font-black text-primary">
                        {formatPrice(item.price)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Qty: {item.qty}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Card 2: Step 2 Reason */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
              2
            </div>
            <h2 className="text-xs font-black text-slate-900">Reason for Cancellation</h2>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Please select a reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-11 rounded-2xl bg-white border border-slate-200 text-xs font-medium px-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select an option...</option>
              <option value="mistake">Ordered by mistake</option>
              <option value="delay">Delayed shipment schedule</option>
              <option value="price">Found better wholesale pricing</option>
              <option value="specs">Specifications / Requirements changed</option>
              <option value="other">Other reason</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Additional Notes <span className="text-slate-400 font-normal">(Optional)</span></label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any additional details to help us improve..."
              rows={3}
              className="rounded-2xl bg-white border-slate-200 text-xs font-medium resize-none"
            />
          </div>
        </div>

        {/* Card 3: Refund Processing Alert */}
        <div className="bg-rose-50/70 border border-rose-100 rounded-3xl p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h3 className="font-bold text-slate-900">Refund Processing</h3>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              If your payment has already been processed, refunds may take 3-5 business days to appear on your original payment method. Cancellations cannot be undone once confirmed.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            onClick={goBack}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
          >
            Keep Order
          </Button>

          <Button
            onClick={handleCancelSubmit}
            disabled={submitting || !reason}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            {submitting ? 'Submitting...' : 'Confirm Cancellation'}
          </Button>
        </div>
      </main>
    </div>
  )
}

export default CancelOrderPage
