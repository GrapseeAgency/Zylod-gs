'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Info } from 'lucide-react'

export function InstallmentPaymentPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          </div>
          <div className="w-5" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-4 md:space-y-5 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-8">
        {/* Title */}
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Installment Plans
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 leading-relaxed">
            Pay for your order over time — not offered yet.
          </p>
        </div>

        {/* Honest state card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-primary flex items-center justify-center border border-rose-100 shrink-0">
              <Info className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 pt-1">
              Financing is not available yet
            </h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Zylod doesn&apos;t offer installment/financing plans yet. Orders start UNPAID and are
            paid in full via verified bank transfer or mobile wallet. When financing becomes
            available, it will appear here.
          </p>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg mx-auto md:max-w-2xl space-y-2">
          <Button
            onClick={() => navigate('my-orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
          >
            View My Orders
          </Button>

          <Button
            variant="outline"
            onClick={goBack}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  )
}

export default InstallmentPaymentPage
