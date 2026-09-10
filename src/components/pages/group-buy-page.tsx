'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Users2, Clock, Percent, TrendingDown,
  Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react'

export function GroupBuyPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/group-buy')
      const data = await res.json()
      if (data.success && data.data) {
        setCampaigns(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-red-600" />
            <h1 className="font-bold text-gray-900 text-base">Wholesale Group Buy</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full space-y-4 pb-24 md:max-w-6xl md:px-6 md:py-6 md:space-y-5 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Wholesale Group Buy</h1>
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 rounded-3xl p-5 text-white shadow-md space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-100">
            <Sparkles className="w-4 h-4 text-amber-200" />
            Volume Order Pooling
          </div>
          <h2 className="text-base sm:text-lg md:text-xl font-bold">Combine Quantities with Other Merchants to Unlock Container Rates</h2>
          <p className="text-xs text-red-100">
            Reserve units in live volume pools. Once target batch quantity is reached, the factory ships at up to 35% discount.
          </p>
        </div>

        {/* Campaign Feed */}
        <div className="space-y-4">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-gray-100 animate-pulse space-y-3">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-6 w-full rounded" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No active group buy pools at this moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(camp => (
              <div
                key={camp.id}
                onClick={() => navigate('group-buy-detail', { id: camp.id })}
                className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-4 hover:border-red-200 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-red-200 text-[10px] font-bold">
                        Save {camp.savingsPercent}%
                      </Badge>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Ends: {new Date(camp.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 line-clamp-1">{camp.title}</h3>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black text-red-600">{formatPrice(camp.discountedPrice)}</p>
                    <p className="text-[11px] text-gray-400 line-through">{formatPrice(camp.originalPrice)}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 bg-slate-50 rounded-2xl p-3 border border-gray-100">
                  <div className="flex justify-between text-xs font-bold text-gray-700">
                    <span>Pool Progress: {camp.currentQty} / {camp.targetQty} Units</span>
                    <span className="text-red-600">{camp.progressPercent}% Full</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-red-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${camp.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-500 font-medium">
                    Protected by SafePay Volume Escrow
                  </span>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl px-4"
                  >
                    Join Pool →
                  </Button>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GroupBuyPage
