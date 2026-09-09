'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Gem, Sparkles, Clock, ShieldCheck,
  ShoppingBag, Check, Building2
} from 'lucide-react'

export function ExclusiveDealDetailPage() {
  const { currentPage, navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const dealId = pageParams?.id

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <h1 className="font-bold text-base">VIP Mill Allocation Detail</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto md:max-w-2xl lg:max-w-4xl w-full pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-6 lg:items-start">
        <div className="lg:col-span-2 bg-slate-800/90 border border-slate-700 rounded-3xl p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-amber-400 text-slate-950 font-bold uppercase text-[10px]">
              VIP Mill Direct Deal
            </Badge>
            <span className="text-xs text-amber-400 flex items-center gap-1 font-bold">
              <Sparkles className="w-3.5 h-3.5" /> 25% Off Export Rate
            </span>
          </div>

          <h2 className="text-base sm:text-lg md:text-2xl font-black text-white">
            100% Combed Cotton Ring-Spun Yarn Lot
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Regular Factory Rate:</span>
                <span className="line-through text-slate-500">{formatPrice(480)} / kg</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-amber-400">VIP Exclusive Price:</span>
                <span className="text-amber-400 font-black">{formatPrice(360)} / kg</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-400 font-semibold pt-1 border-t border-slate-800">
                <span>Your Savings on 1,000kg MOQ:</span>
                <span>{formatPrice(120000)} BDT</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <h3 className="font-bold text-white uppercase text-[11px] tracking-wider">Lot Specifications</h3>
              <p>• Verified Mill Origin: Narayanganj Textile Cluster</p>
              <p>• Packaging: 50kg export polypropylene bags</p>
              <p>• Lead Time: Ready for immediate container loading</p>
            </div>
          </div>

          <Button
            onClick={() => navigate('buy-now')}
            className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl text-sm lg:hidden"
          >
            Lock VIP Allocation with SafePay Escrow →
          </Button>
        </div>

        <aside className="hidden lg:block bg-slate-800/90 border border-slate-700 rounded-3xl p-6 space-y-3">
          <h3 className="font-bold text-white uppercase text-[11px] tracking-wider">Order Summary</h3>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Regular Factory Rate</span>
            <span className="line-through text-slate-500">{formatPrice(480)} / kg</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>VIP Exclusive Price</span>
            <span className="text-amber-400 font-bold">{formatPrice(360)} / kg</span>
          </div>
          <div className="flex justify-between text-xs text-emerald-400 font-semibold pt-2 border-t border-slate-800">
            <span>Savings on 1,000kg MOQ</span>
            <span>{formatPrice(120000)} BDT</span>
          </div>
          <Button
            onClick={() => navigate('buy-now')}
            className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-2xl text-sm"
          >
            Lock VIP Allocation with SafePay Escrow →
          </Button>
        </aside>
        </div>
      </div>
    </div>
  )
}

export default ExclusiveDealDetailPage
