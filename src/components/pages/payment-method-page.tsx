'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, CreditCard, Smartphone, Building2,
  ShieldCheck, Plus, CheckCircle2, Wallet, Banknote
} from 'lucide-react'

interface PaymentOption {
  id: string
  type: 'card' | 'mfs' | 'bank' | 'credit'
  title: string
  subtitle: string
  icon: string
  isDefault?: boolean
  badge?: string
}

export function PaymentMethodPage() {
  const { navigate, goBack } = useNavigationStore()
  const [selected, setSelected] = useState<string>('corporate-card')
  const [loading, setLoading] = useState(false)

  const paymentOptions: PaymentOption[] = [
    {
      id: 'corporate-card',
      type: 'card',
      title: 'Corporate Visa ending in 4242',
      subtitle: 'Expires 12/25 • Acme Corp',
      icon: 'card',
      isDefault: true,
      badge: 'Primary',
    },
    {
      id: 'bkash-merchant',
      type: 'mfs',
      title: 'bKash Merchant Direct (01711-XXXXXX)',
      subtitle: 'Instant B2B settlement • 0% fee',
      icon: 'mfs',
      badge: 'Instant',
    },
    {
      id: 'nagad-business',
      type: 'mfs',
      title: 'Nagad Direct Pay (01822-XXXXXX)',
      subtitle: 'Govt. verified escrow checkout',
      icon: 'mfs',
    },
    {
      id: 'bank-lc',
      type: 'bank',
      title: 'Bank Transfer / Letter of Credit (L/C)',
      subtitle: 'Eastern Bank Ltd. / City Bank Corporate',
      icon: 'bank',
      badge: 'Bulk Orders',
    },
    {
      id: 'trade-credit',
      type: 'credit',
      title: 'Zylod Net-30 Trade Credit',
      subtitle: 'Approved Limit: ৳ 500,000 (Available: ৳ 380,000)',
      icon: 'credit',
      badge: 'Net 30 Days',
    },
  ]

  const handleContinue = () => {
    navigate('checkout')
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Payment Method</h1>
          </div>
          <button
            onClick={() => navigate('add-payment-method')}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add Method
          </button>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-6 lg:max-w-4xl">
        {/* Step indicator */}
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
              ✓
            </div>
            <span className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wide">Address</span>
          </div>
          <div className="flex-1 h-0.5 bg-primary mx-2" />
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
              ✓
            </div>
            <span className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wide">Delivery</span>
          </div>
          <div className="flex-1 h-0.5 bg-primary mx-2" />
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
              3
            </div>
            <span className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wide">Payment</span>
          </div>
        </div>

        {/* Payment list */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {paymentOptions.map((opt) => {
            const isSelected = selected === opt.id

            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`w-full text-left bg-white rounded-3xl p-5 border transition-all shadow-2xs ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    {opt.type === 'card' && <CreditCard className="h-5 w-5 text-primary" />}
                    {opt.type === 'mfs' && <Smartphone className="h-5 w-5 text-primary" />}
                    {opt.type === 'bank' && <Building2 className="h-5 w-5 text-primary" />}
                    {opt.type === 'credit' && <Wallet className="h-5 w-5 text-primary" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs md:text-sm font-bold text-slate-900">{opt.title}</h3>
                      {opt.badge && (
                        <span className="bg-rose-50 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-100">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{opt.subtitle}</p>
                  </div>

                  {/* Radio circle */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected ? 'border-primary bg-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Security badge */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center gap-2.5 text-[11px] text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>All transactions protected by Bank-grade 256-bit SSL & Trade Assurance Escrow.</span>
        </div>

        {/* Confirm (desktop) */}
        <div className="hidden md:block">
          <Button
            onClick={handleContinue}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-sm"
          >
            Confirm Payment Method &amp; Review
          </Button>
        </div>
      </main>

      {/* Sticky footer */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30 md:hidden">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleContinue}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
          >
            Confirm Payment Method &amp; Review
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PaymentMethodPage
