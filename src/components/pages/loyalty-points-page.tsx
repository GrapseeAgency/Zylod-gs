'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, Coins, Sparkles, TrendingUp, History,
  Gift, Trophy, ChevronRight, Award
} from 'lucide-react'

export function LoyaltyPointsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated, user } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  // t216 honesty fix: loyalty points belong to BUYER purchase activity.
  // Guests and non-buyer accounts get an account gate — never a fabricated
  // "Bronze Tier / 0 points" card.
  const [loyalty, setLoyalty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  // Deep links can mount before the boot session probe settles.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    // The loyalty API serves any authenticated account (it awards real signup
    // points to suppliers too) — the page must not hide REAL data behind a
    // role guess. Only guests are gated.
    if (!isAuthenticated) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setSessionExpired(false)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/rewards/loyalty', { headers })
      .then(async res => {
        if (cancelled) return
        if (res.status === 401) { setSessionExpired(true); return }
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || `Failed to load loyalty points (${res.status})`)
        if (!data?.success || !data?.data) throw new Error('Loyalty points are unavailable right now.')
        setLoyalty(data.data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load loyalty points')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated, token, retryNonce])

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session is no longer valid. Sign in again to view your loyalty points." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view loyalty points"
        message="Loyalty points are earned on wholesale purchase orders, reviews, and referrals. Sign in to see your real balance."
      />
    )
  }
  if (loadError) {
    return (
      <div className="min-h-[60vh] bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <Coins className="h-8 w-8 mx-auto text-amber-500" />
          <h1 className="text-base font-bold text-foreground">Could not load loyalty points</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={() => setRetryNonce(n => n + 1)} className="h-9 px-4 font-bold text-xs rounded-xl">
            Try again
          </Button>
        </div>
      </div>
    )
  }
  if (loading || !loyalty) {
    return (
      <div className="min-h-[60vh] bg-background flex items-center justify-center">
        <Coins className="h-8 w-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum': return 'from-primary via-purple-600 to-primary/80'
      case 'gold': return 'from-amber-500 via-orange-500 to-yellow-600'
      case 'silver': return 'from-slate-600 via-slate-700 to-neutral-800'
      default: return 'from-amber-700 via-orange-800 to-stone-800'
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Loyalty Points</h1>
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
            <span className="text-[11px] font-extrabold uppercase tracking-widest bg-white dark:bg-gray-900/20 px-3 py-1 rounded-full backdrop-blur-sm">
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
            className="py-4 bg-white dark:bg-gray-900 font-bold rounded-2xl border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 text-xs sm:text-sm gap-2"
          >
            <Award className="w-4 h-4 text-primary" /> View All Tiers
          </Button>
        </div>

        {/* Ways to Earn Points */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                className="p-3 bg-slate-50 dark:bg-background hover:bg-amber-50 rounded-2xl flex items-center justify-between cursor-pointer transition border border-gray-100 dark:border-gray-800"
              >
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.title}</span>
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
