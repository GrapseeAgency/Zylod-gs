'use client'

/**
 * VIP Wholesale Enterprise Club — rendered from the REAL tier config
 * (t187-d). GET /api/vip returns the platform's actual tiers (name, badge,
 * minSpendBDT, benefits list) plus the caller's current tier and lifetime
 * paid spend. The old page hardcoded four invented privilege promises that
 * drifted from the real config; benefits now come verbatim from the API, and
 * a failed fetch shows an honest error instead of fake promises.
 */
import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/page-loader'
import { toast } from 'sonner'
import {
  ArrowLeft, Crown, ShieldCheck, Check, RefreshCw,
} from 'lucide-react'

interface VipTier {
  id: string
  name: string
  minSpendBDT: number
  badge: string
  benefits: string[]
}

interface VipData {
  currentTier: string
  totalSpendBDT: number
  tiers: VipTier[]
}

export function VipBenefitsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [data, setData] = useState<VipData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchFailed, setFetchFailed] = useState(false)

  const loadVip = React.useCallback(async () => {
    setLoading(true)
    setFetchFailed(false)
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/vip', { headers })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && Array.isArray(json.data?.tiers)) {
        setData(json.data as VipData)
      } else {
        setData(null)
        setFetchFailed(true)
        toast.error('Could not load the VIP tier configuration.')
      }
    } catch {
      setData(null)
      setFetchFailed(true)
      toast.error('Could not load the VIP tier configuration.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadVip()
  }, [loadVip])

  return (
    <div className="flex flex-col min-h-screen bg-background text-gray-900 dark:text-white">
      <div className="md:hidden sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h1 className="font-bold text-base">VIP Wholesale Enterprise Club</h1>
          </div>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">VIP Wholesale Enterprise Club</h1>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-amber-600 dark:text-amber-400">Enterprise Procurement Privileges</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Membership tiers are based on your verified lifetime spend on Zylod.
          </p>
          {token && data && (
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
              Your lifetime paid spend: {formatPrice(data.totalSpendBDT)}
            </p>
          )}
        </div>

        {loading ? (
          <PageLoader />
        ) : fetchFailed || !data ? (
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The VIP tier configuration couldn&apos;t be loaded, so we won&apos;t guess at the benefits. Please try again.
            </p>
            <Button
              onClick={loadVip}
              variant="outline"
              className="h-10 rounded-xl text-xs font-bold gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.tiers.map((tier) => {
              const isCurrent = tier.id === data.currentTier
              return (
                <div
                  key={tier.id}
                  className={`bg-white dark:bg-slate-800/90 border rounded-3xl p-5 space-y-3 shadow-sm ${
                    isCurrent ? 'border-amber-400 ring-1 ring-amber-400/40' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Crown className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {tier.minSpendBDT > 0
                            ? `${formatPrice(tier.minSpendBDT)}+ lifetime paid spend`
                            : 'No spend requirement'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full">
                        {tier.badge}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                          Your tier
                        </span>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {tier.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        <Button
          onClick={() => navigate('exclusive-deals')}
          className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl text-sm"
        >
          View Exclusive Mill Deals →
        </Button>
      </div>
    </div>
  )
}

export default VipBenefitsPage
