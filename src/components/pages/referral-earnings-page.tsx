'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, Users, Coins, Gift, CheckCircle2, Clock
} from 'lucide-react'

export function ReferralEarningsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [refData, setRefData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Honesty fix: the referral ledger is the signed-in account's real earnings —
  // guests get an account gate instead of a fabricated "+0 Pts".
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Deep links can mount before the boot session probe settles.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/referrals', { headers })
      .then(res => res.json().then(data => ({ res, data })).catch(() => ({ res, data: null })))
      .then(({ res, data }) => {
        if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
        if (!res.ok) {
          setLoadError(data?.error || `Failed to load your referral earnings (${res.status})`)
          return
        }
        if (data?.success && data?.data) {
          setRefData(data.data)
        } else {
          setLoadError('Your referral earnings are unavailable right now.')
        }
      })
      .catch(() => setLoadError('Could not reach the server to load your referral earnings.'))
      .finally(() => setLoading(false))
  }, [isAuthenticated, token])

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session is no longer valid. Sign in again to view your referral earnings." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view referral earnings"
        message="Referral rewards are credited to your account when invited merchants join. Sign in to see your real ledger."
      />
    )
  }
  if (loadError) {
    return (
      <div className="min-h-[60vh] bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <Coins className="h-8 w-8 mx-auto text-primary" />
          <h1 className="text-base font-bold text-foreground">Could not load referral earnings</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={() => window.location.reload()} className="h-9 px-4 font-bold text-xs rounded-xl">
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Referral Earnings Ledger</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('referral-program')}
          className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-xl"
        >
          Share Code →
        </Button>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-3xl md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Referral Earnings Ledger</h1>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('referral-program')}
            className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-xl"
          >
            Share Code
          </Button>
        </div>
        {/* Earnings Stats */}
        <div className="bg-gradient-to-r from-primary to-primary rounded-3xl p-6 text-white shadow-md space-y-2">
          <p className="text-xs font-bold text-primary/50 uppercase tracking-wider">Total Referral Reward Points</p>
          <h2 className="text-3xl md:text-4xl font-black">+{refData?.totalPointsEarned ?? 0} Pts</h2>
          <p className="text-xs text-primary/20">
            Earned from {refData?.successfulReferrals ?? 0} verified business onboarding events.
          </p>
        </div>

        {/* Referred Users List */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 md:col-span-2">
            Invited Merchants ({refData?.referralHistory?.length ?? 0})
          </h3>

          {!refData?.referralHistory?.length ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
              No colleagues have registered with your invite code yet.
            </div>
          ) : (
            refData.referralHistory.map((item: any) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      {item.referredUser?.email ? item.referredUser.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Verified Merchant'}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400">
                      Joined {new Date(item.createdAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-extrabold text-primary bg-primary/5 px-2.5 py-1 rounded-full">
                  +500 Pts Credited
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ReferralEarningsPage
