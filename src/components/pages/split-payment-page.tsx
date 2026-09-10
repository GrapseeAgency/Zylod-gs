'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { X, CreditCard, Building2, CheckCircle2 } from 'lucide-react'

export function SplitPaymentPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const totalAmount = 12450.00
  const orderNumber = 'Order #ZY-8924-XT'

  const [percentage, setPercentage] = useState(50)
  const [submitting, setSubmitting] = useState(false)

  const cardAmount = useMemo(() => {
    return (totalAmount * percentage) / 100
  }, [totalAmount, percentage])

  const bankAmount = useMemo(() => {
    return totalAmount - cardAmount
  }, [totalAmount, cardAmount])

  const handleConfirm = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      navigate('order-confirmation')
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Close">
            <X className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Split Payment</h1>
          <div className="w-5" />
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Split Payment</h1>

      <main className="px-4 py-6 space-y-5 max-w-lg mx-auto">
        {/* Total Amount Due Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-slate-900 block">Total Amount Due</span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">{orderNumber}</span>
          </div>

          <div className="text-xl font-black text-primary">
            {formatPrice(totalAmount)}
          </div>
        </div>

        {/* Payment Allocation Card */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-slate-900">Payment Allocation</h2>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
            {/* Method 1: Card */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-slate-600" />
                <span className="text-xs font-bold text-slate-800">Corporate Card ending 4492</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Amount</span>
                <span className="text-sm font-black text-slate-900">{formatPrice(cardAmount)}</span>
              </div>
            </div>

            {/* Slider with Percentage Labels */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Slider
                  value={[percentage]}
                  min={10}
                  max={90}
                  step={5}
                  onValueChange={(val) => setPercentage(val[0])}
                  className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:shadow-md"
                />
              </div>

              <div className="flex justify-between text-[11px] font-bold text-slate-500 pt-1">
                <span>{percentage}%</span>
                <span>{100 - percentage}%</span>
              </div>
            </div>

            {/* Method 2: Bank Transfer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-slate-600" />
                <span className="text-xs font-bold text-slate-800">Bank Transfer (ACH)</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Amount</span>
                <span className="text-sm font-black text-slate-900">{formatPrice(bankAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg mx-auto space-y-2">
          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
          >
            {submitting ? 'Authorizing Split Payment...' : 'Confirm Split Payment'}
          </Button>

          <Button
            variant="outline"
            onClick={goBack}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SplitPaymentPage
