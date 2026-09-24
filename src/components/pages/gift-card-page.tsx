'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { X, Gift, Info } from 'lucide-react'

export function GiftCardPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Close">
            <X className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <div className="w-5" />
        </div>
      </header>

      <main className="px-4 py-6 md:px-6 md:py-8 space-y-4 max-w-lg mx-auto w-full">
        {/* Desktop back affordance */}
        <div className="hidden md:block">
          <button onClick={goBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            <X className="h-4 w-4" /> Close
          </button>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-xl md:text-2xl font-black tracking-tight">
            Gift Card Redemption
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Redeem a gift card code to add credit to your wallet.
          </p>
        </div>

        {/* Honest unavailability state — no gift-card backend exists */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 text-primary flex items-center justify-center border border-rose-100 dark:border-rose-900 shrink-0">
              <Gift className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-black">Gift cards are not available yet</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Zylod does not issue or redeem gift cards yet. There are no codes to enter and no
                promotional balances — any message claiming otherwise did not come from Zylod.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800">
            <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              When gift cards launch, redemption will happen here and the credited amount will appear in
              your real wallet transaction history.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button onClick={() => navigate('wallet')} className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs">
              Open Wallet
            </Button>
            <Button onClick={goBack} variant="outline" className="flex-1 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold h-11 rounded-2xl text-xs">
              Back
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default GiftCardPage
