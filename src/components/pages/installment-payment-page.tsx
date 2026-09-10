'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Menu, Search, ArrowLeft, CheckCircle2, MoreHorizontal,
  FileCheck, Building2, ArrowRight
} from 'lucide-react'

interface InstallmentPlan {
  id: string
  months: string
  subtitle: string
  monthlyPayment: number
  apr: string
}

export function InstallmentPaymentPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const totalAmount = 12450.00
  const poNumber = 'PO #8472-BD'

  const plans: InstallmentPlan[] = [
    {
      id: '3-months',
      months: '3 Months',
      subtitle: 'Short-term financing',
      monthlyPayment: 4150.00,
      apr: '0% APR',
    },
    {
      id: '6-months',
      months: '6 Months',
      subtitle: 'Standard corporate terms',
      monthlyPayment: 2126.95,
      apr: '2.5% APR',
    },
  ]

  const [selectedPlan, setSelectedPlan] = useState<string>('3-months')
  const [submitting, setSubmitting] = useState(false)

  const handleApply = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      navigate('order-confirmation')
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          </div>
          <button className="p-1 text-slate-700 hover:text-slate-900">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-4 md:space-y-5 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-8">
        {/* Title */}
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            B2B Installment Plans
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 leading-relaxed">
            Flexible payment options tailored for high-volume corporate purchasing.
          </p>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900">Order Summary</span>
            <span className="text-xs font-black text-primary uppercase">{poNumber}</span>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs font-semibold text-slate-600">Total Amount</span>
            <span className="text-lg font-black text-slate-900">{formatPrice(totalAmount)}</span>
          </div>
        </div>

        {/* Plans List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id

            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full text-left bg-white rounded-3xl p-5 border transition-all shadow-2xs ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <h2 className={`text-base font-black ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
                      {plan.months}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">{plan.subtitle}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between text-xs">
                    <div>
                      <span className="text-slate-500 font-medium block">Monthly Payment</span>
                      <span className="text-base font-black text-slate-900">
                        {formatPrice(plan.monthlyPayment)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-500 font-medium block">Interest Rate</span>
                      <span className="text-xs font-black text-slate-800">{plan.apr}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Application Requirements Card */}
        <div className="bg-slate-100/70 rounded-3xl p-5 border border-slate-200/80 space-y-3">
          <h2 className="text-xs font-black text-slate-900">Application Requirements</h2>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Valid Trade License Verification</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Bank Statement (Last 3 Months)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center shrink-0">
                <MoreHorizontal className="h-3 w-3" />
              </div>
              <span>Corporate Guarantor Signature required for &gt;$10k</span>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg mx-auto md:max-w-2xl">
          <Button
            onClick={handleApply}
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? 'Submitting Application...' : 'Apply for Installments'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default InstallmentPaymentPage
