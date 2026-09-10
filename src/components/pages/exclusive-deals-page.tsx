'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Gem, Sparkles, Clock, ShoppingBag,
  TrendingDown, ShieldCheck, ChevronRight
} from 'lucide-react'

export function ExclusiveDealsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deals/exclusive')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setDeals(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-amber-400" />
            <h1 className="font-bold text-base">VIP Exclusive Deals</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('vip-membership')}
          className="h-8 text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl"
        >
          My VIP Status
        </Button>
      </div>

      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto lg:max-w-6xl w-full space-y-4 md:space-y-6 pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 rounded-3xl p-5 md:p-6 text-slate-950 shadow-xl space-y-1.5 md:flex md:items-center md:justify-between md:gap-6 md:space-y-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-900">
              <Sparkles className="w-4 h-4" /> Tier Member Special Allocations
            </div>
            <h2 className="text-base sm:text-lg md:text-2xl font-black">Direct-From-Mill Factory Clearances</h2>
            <p className="text-xs text-slate-900">
              Exclusive wholesale export lots unlocked exclusively for Silver, Gold, and Platinum tier verified accounts.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => navigate('vip-membership')}
            className="hidden md:inline-flex h-9 text-xs font-bold bg-slate-950 hover:bg-slate-900 text-amber-400 rounded-xl shrink-0"
          >
            My VIP Status
          </Button>
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="bg-slate-800 rounded-3xl p-4 border border-slate-700 animate-pulse space-y-3">
                <Skeleton className="h-28 w-full rounded-2xl bg-slate-700" />
                <Skeleton className="h-4 w-3/4 rounded bg-slate-700" />
              </div>
            ))
          ) : deals.length === 0 ? (
            <div className="col-span-2 lg:col-span-3 text-center py-16 text-slate-400">
              No exclusive deals active at this moment.
            </div>
          ) : (
            deals.map(deal => (
              <div
                key={deal.id}
                onClick={() => navigate('product-detail', { id: deal.productId })}
                className="bg-slate-800/90 border border-slate-700 rounded-3xl p-4 space-y-3 shadow-md hover:border-amber-400 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-amber-400/10 text-amber-400 border border-amber-400/30 text-[10px] uppercase font-bold">
                      {deal.requiredTier} Tier
                    </Badge>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ends in {deal.expiresInHours}h
                    </span>
                  </div>

                  <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-700">
                    <img
                      src={deal.thumbnailUrl || 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=400&q=80'}
                      alt={deal.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2">{deal.name}</h3>
                    <p className="text-[11px] text-slate-400">MOQ: {deal.moq} Units</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-black text-amber-400">{formatPrice(deal.vipPriceBDT)}</span>
                      <span className="text-[11px] text-slate-500 line-through">{formatPrice(deal.regularPriceBDT)}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      Save {formatPrice(deal.savingsPerUnitBDT)}/unit
                    </span>
                  </div>

                  <Button
                    size="sm"
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
                  >
                    View Lot →
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ExclusiveDealsPage
