'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { soundEffects } from '@/lib/sound-effects'
import { toast } from 'sonner'
import {
  ArrowLeft, Gift, Coins, Wallet, Tag,
  CheckCircle2, AlertCircle, ChevronRight
} from 'lucide-react'

// Task 143 audit: the min-order copy MUST state the API's real rule —
// /api/rewards/redeem issues every voucher with minOrder = 3 × cash value
// and checkout enforces exactly that (drilled t143). The old copy claimed
// ৳500/৳1,000/৳2,500/৳5,000 minimums that checkout would never ask for.
// The ৳1,000 tier is honestly a WALLET CREDIT (no minimum — it is balance,
// not a voucher).
const REDEEM_OPTIONS = [
  { points: 500, bdt: 50, label: '৳50 Wholesale Voucher', minOrder: 150 },
  { points: 1000, bdt: 100, label: '৳100 Wholesale Voucher', minOrder: 300 },
  { points: 2500, bdt: 250, label: '৳250 Wholesale Voucher', minOrder: 750 },
  { points: 5000, bdt: 500, label: '৳500 Wholesale Voucher', minOrder: 1500 },
  { points: 10000, bdt: 1000, label: '৳1,000 Wallet Credit', minOrder: 0 },
]

export function RedeemPointsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [pointsBalance, setPointsBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<number | null>(null)
  const [customPoints, setCustomPoints] = useState('')
  const [customBusy, setCustomBusy] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/rewards/loyalty', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPointsBalance(data.data.pointsBalance)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const handleRedeem = async (option: typeof REDEEM_OPTIONS[0]) => {
    if (pointsBalance < option.points) {
      toast.error(`You need ${option.points} points to redeem this reward. Current balance: ${pointsBalance}`)
      return
    }

    try {
      setRedeeming(option.points)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pointsToRedeem: option.points,
          rewardType: option.minOrder === 0 ? 'wallet_credit' : 'voucher',
        }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setPointsBalance(prev => prev - option.points)
        soundEffects.playByName('chime')
        const code = data.data?.coupon?.code
        toast.success(
          code
            ? `${option.label} issued! Code: ${code} — single use, valid 30 days, minimum order ${formatPrice(option.bdt * 3)}. It is in your coupon vault.`
            : `${option.label} has been added to your wallet.`
        )
        navigate('my-coupons')
      } else {
        toast.error(data.error || 'Failed to redeem points')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setRedeeming(null)
    }
  }

  // Task 143: the API honors ANY redemption ≥ 100 points (৳ value = points ÷
  // 10, voucher minimum order = 3 × value) — the UI now exposes that freedom
  // instead of forcing buyers to wait for a fixed tier.
  const customValue = Math.floor(Number(customPoints) / 10)
  const customValid = Number.isInteger(Number(customPoints)) && Number(customPoints) >= 100 && Number(customPoints) <= pointsBalance

  const handleCustomRedeem = async () => {
    const pts = Number(customPoints)
    if (!customValid) {
      toast.error(`Enter a whole number of points between 100 and ${pointsBalance}.`)
      return
    }
    try {
      setCustomBusy(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pointsToRedeem: pts, rewardType: 'voucher' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPointsBalance(prev => prev - pts)
        setCustomPoints('')
        soundEffects.playByName('chime')
        const code = data.data?.coupon?.code
        toast.success(
          code
            ? `৳${customValue} voucher issued! Code: ${code} — single use, valid 30 days, minimum order ${formatPrice(customValue * 3)}. It is in your coupon vault.`
            : 'Redemption successful.'
        )
        navigate('my-coupons')
      } else {
        toast.error(data.error || 'Failed to redeem points')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCustomBusy(false)
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
            <Gift className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Redeem Points</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold text-amber-700">
          <Coins className="w-3.5 h-3.5" />
          {pointsBalance.toLocaleString()} Pts
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-3xl md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Redeem Points</h1>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold text-amber-700">
            <Coins className="w-3.5 h-3.5" />
            {pointsBalance.toLocaleString()} Pts
          </div>
        </div>
        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 text-white shadow-md space-y-2">
          <h2 className="text-base sm:text-lg md:text-2xl font-bold">Exchange Points for Real Savings</h2>
          <p className="text-xs text-amber-100">
            Convert your points into checkout discount vouchers.
          </p>
        </div>

        {/* Options List */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
            Redemption Rewards
          </h3>

          {REDEEM_OPTIONS.map(opt => {
            const canAfford = pointsBalance >= opt.points
            return (
              <div
                key={opt.points}
                className={`bg-white dark:bg-gray-900 rounded-3xl p-5 border shadow-sm flex items-center justify-between gap-4 transition ${
                  canAfford ? 'border-gray-100 dark:border-gray-800 hover:border-amber-300' : 'border-gray-100 dark:border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    opt.minOrder === 0 ? 'bg-primary/5 text-primary' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {opt.minOrder === 0 ? <Wallet className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{opt.label}</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      Cost: <strong className="text-amber-600">{opt.points.toLocaleString()} Points</strong>
                      {opt.minOrder > 0 && ` • Min Order ${formatPrice(opt.minOrder)}`}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={!canAfford || redeeming === opt.points}
                  onClick={() => handleRedeem(opt)}
                  className={`h-9 px-4 text-xs font-bold rounded-xl flex-shrink-0 shadow-sm ${
                    canAfford
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {redeeming === opt.points ? 'Redeeming...' : canAfford ? 'Redeem' : 'Need Pts'}
                </Button>
              </div>
            )
          })}

          {/* Custom redemption — the API's real freedom, now reachable */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-dashed border-amber-300 shadow-sm md:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Custom Voucher</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">Any amount from 100 points — ৳1 per 10 points, min order 3× the voucher value</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                step={1}
                value={customPoints}
                onChange={(e) => setCustomPoints(e.target.value)}
                placeholder={pointsBalance >= 100 ? `e.g. ${Math.min(pointsBalance, 1000)} (you have ${pointsBalance.toLocaleString()} pts)` : 'Earn more points first'}
                disabled={pointsBalance < 100}
                className="flex-1 h-10 px-3.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 disabled:bg-gray-50 dark:bg-gray-950 disabled:text-gray-400 dark:text-gray-500 min-w-0"
                aria-label="Custom points to redeem"
              />
              <Button
                size="sm"
                disabled={!customValid || customBusy || loading}
                onClick={handleCustomRedeem}
                className="h-10 px-5 text-xs font-bold rounded-xl flex-shrink-0 shadow-sm bg-amber-500 hover:bg-amber-600 text-white disabled:bg-gray-100 dark:bg-gray-900 disabled:text-gray-400 dark:text-gray-500"
              >
                {customBusy ? 'Redeeming...' : customValid && customValue > 0 ? `Get ৳${customValue} voucher` : 'Redeem'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RedeemPointsPage
