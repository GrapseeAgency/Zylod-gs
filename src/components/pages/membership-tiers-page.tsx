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
  ArrowLeft, Award, Crown, Check, Sparkles, ChevronRight
} from 'lucide-react'

export function MembershipTiersPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [tiers, setTiers] = useState<any[]>([])
  const [currentTier, setCurrentTier] = useState('standard')
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Honesty fix: the VIP API computes YOUR current tier from YOUR paid orders —
  // guests must not see a fabricated "Your Active Tier" card.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/vip', { headers })
      .then(async res => {
        if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || `Failed to load membership tiers (${res.status})`)
        if (data.success && data.data) {
          setTiers(data.data.tiers || [])
          setCurrentTier(data.data.currentTier || 'standard')
        } else {
          throw new Error('Membership tiers are unavailable right now.')
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error) setLoadError(e.message)
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated, token])

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session is no longer valid. Sign in again to view your membership tier." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view your membership tier"
        message="Your active tier is calculated from your real paid order volume. Sign in to see where you stand."
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Membership Tiers</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-2xl mx-auto lg:max-w-6xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">Wholesale Volume Tiers</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
            Higher recorded procurement volume automatically unlocks the next tier and its listed benefits.
          </p>
        </div>

        {/* Tiers List */}
        {loadError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 text-xs text-red-800 dark:text-red-300 flex items-center gap-3">
            <Award className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span>{loadError} Refresh the page to try again.</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {tiers.map(tier => {
            const isCurrent = currentTier.toLowerCase() === tier.id.toLowerCase()
            return (
              <div
                key={tier.id}
                className={`bg-white dark:bg-gray-900 rounded-3xl p-5 border shadow-sm space-y-3 transition ${
                  isCurrent ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">{tier.name}</h3>
                      {isCurrent && (
                        <Badge className="bg-amber-500 text-white text-[10px] uppercase font-bold">
                          Your Active Tier
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      Spend Threshold: <strong>{formatPrice(tier.minSpendBDT)} / year</strong>
                    </p>
                  </div>

                  <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {tier.benefits.map((b: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MembershipTiersPage
