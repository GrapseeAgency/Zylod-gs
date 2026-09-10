'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { X, CreditCard, Wallet, Check, AlertCircle } from 'lucide-react'

export function ApplyCreditsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const availableCredit = 1250.00
  const orderSubtotal = 845.50

  const [appliedAmount, setAppliedAmount] = useState('845.50')
  const [submitting, setSubmitting] = useState(false)

  const numApplied = useMemo(() => {
    const val = parseFloat(appliedAmount) || 0
    return Math.min(Math.max(0, val), Math.min(availableCredit, orderSubtotal))
  }, [appliedAmount, availableCredit, orderSubtotal])

  const newOrderTotal = Math.max(0, orderSubtotal - numApplied)

  const handleApplyMax = () => {
    setAppliedAmount(Math.min(availableCredit, orderSubtotal).toFixed(2))
  }

  const handleConfirm = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      navigate('checkout')
    }, 800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Close">
            <X className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <div className="w-5" />
        </div>
      </header>

      <main className="px-4 py-6 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-3xl w-full">
        {/* Desktop back affordance */}
        <div className="hidden md:block">
          <button onClick={goBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900">
            <X className="h-4 w-4" /> Close
          </button>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Apply Business Credit
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Use your available credit balance to reduce your order total.
          </p>
        </div>

        {/* Available Credit + Order Subtotal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Available Credit Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <div className="w-6 h-6 rounded-lg bg-rose-50 text-primary flex items-center justify-center border border-rose-100">
              <CreditCard className="h-3.5 w-3.5" />
            </div>
            <span>Available Credit</span>
          </div>

          <div className="text-2xl font-black text-slate-900">
            {formatPrice(availableCredit)}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Expires Dec 31, 2024</p>
        </div>

        {/* Order Subtotal & Amount Input Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex justify-between items-baseline pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700">Order Subtotal</span>
            <span className="text-sm font-black text-slate-900">{formatPrice(orderSubtotal)}</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900 block">Amount to Apply</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={Math.min(availableCredit, orderSubtotal)}
                value={appliedAmount}
                onChange={(e) => setAppliedAmount(e.target.value)}
                className="h-12 pl-8 pr-28 rounded-2xl bg-white border-slate-200 text-sm font-bold text-slate-900"
              />
              <button
                type="button"
                onClick={handleApplyMax}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Apply Max
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              You can apply up to {formatPrice(orderSubtotal)} to cover this order entirely.
            </p>
          </div>
        </div>
        </div>

        {/* New Order Total Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Order Total</span>
            <span className="text-xl font-black text-slate-900">{formatPrice(newOrderTotal)}</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Credit Applied</span>
            <span className="text-base font-black text-primary">-{formatPrice(numApplied)}</span>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleConfirm}
            disabled={submitting || numApplied <= 0}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
          >
            {submitting ? 'Applying Credits...' : 'Confirm & Apply Credits'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ApplyCreditsPage
