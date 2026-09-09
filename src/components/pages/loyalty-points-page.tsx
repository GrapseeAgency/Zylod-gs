'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Coins, Sparkles, TrendingUp, History,
  Gift, Trophy, ChevronRight, Award
} from 'lucide-react'

export function LoyaltyPointsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [loyalty, setLoyalty] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/rewards/loyalty', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setLoyalty(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum': return 'from-indigo-600 via-purple-600 to-indigo-800'
      case 'gold': return 'from-amber-500 via-orange-500 to-yellow-600'
      case 'silver': return 'from-slate-600 via-slate-700 to-slate-800'
      default: return 'from-amber-700 via-orange-800 to-stone-800'
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-gray-900 text-base">Loyalty Points</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('points-history')}
          className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
        >
          <History className="w-3.5 h-3.5" /> History
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-4xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Points Card */}
        <div className={`bg-gradient-to-r ${getTierColor(loyalty?.tier)} rounded-3xl p-6 md:p-8 text-white shadow-xl space-y-4`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
              {loyalty?.tier || 'Bronze'} Tier Merchant
            </span>
            <span className="text-xs text-white/80">10 Pts = ৳1 BDT</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-white/80">Available Point Balance</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">{loyalty?.pointsBalance?.toLocaleString() ?? 0}</h2>
            <p className="text-xs text-amber-200 font-bold">
              ≈ {formatPrice(loyalty?.cashValueBDT ?? 0)} Wholesale Credit Value
            </p>
          </div>

          {/* Tier Progress */}
          <div className="space-y-1.5 pt-2 border-t border-white/20">
            <div className="flex justify-between text-xs text-white/90 font-medium">
              <span>Next Tier: <strong className="capitalize">{loyalty?.nextTier}</strong></span>
              <span>{loyalty?.pointsNeededForNextTier ? `+${loyalty.pointsNeededForNextTier} pts needed` : 'Highest Tier Achieved!'}</span>
            </div>
            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${loyalty?.tierProgressPercent ?? 20}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 md:max-w-md gap-3">
          <Button
            onClick={() => navigate('redeem-points')}
            className="py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-sm text-xs sm:text-sm gap-2"
          >
            <Gift className="w-4 h-4" /> Redeem Points
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('membership-tiers')}
            className="py-4 bg-white font-bold rounded-2xl border-gray-200 text-gray-800 text-xs sm:text-sm gap-2"
          >
            <Award className="w-4 h-4 text-indigo-600" /> View All Tiers
          </Button>
        </div>

        {/* Ways to Earn Points */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Quick Ways to Earn Points
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { title: 'Daily App Check-in', pts: '+50 to +500 Pts', nav: 'daily-checkin' },
              { title: 'Lucky Spin & Win', pts: 'Up to +500 Pts', nav: 'spin-win' },
              { title: 'Wholesale Purchase Orders', pts: '1 Pt per ৳100 spent', nav: 'category-browser' },
              { title: 'Invite Retail Colleagues', pts: '+500 Pts per signup', nav: 'referral-program' },
            ].map(item => (
              <div
                key={item.title}
                onClick={() => navigate(item.nav as any)}
                className="p-3 bg-slate-50 hover:bg-amber-50 rounded-2xl flex items-center justify-between cursor-pointer transition border border-gray-100"
              >
                <span className="text-xs font-bold text-gray-800">{item.title}</span>
                <span className="text-xs font-extrabold text-amber-600">{item.pts} →</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoyaltyPointsPage
