'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { X, CreditCard, Wallet, Info, RefreshCw, AlertTriangle } from 'lucide-react'

interface WalletBalance {
  availableBalance: number
  currency: string
}

export function ApplyCreditsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [balance, setBalance] = useState<WalletBalance | null>(null)

  const loadBalance = useCallback(async () => {
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const res = await fetch('/api/wallet/balance', { credentials: 'include' })
      if (res.status === 401) { setNeedsAuth(true); setBalance(null); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load wallet balance (HTTP ${res.status})`)
        setBalance(null)
        return
      }
      setBalance(json.data as WalletBalance)
    } catch {
      setError('Network error while loading your wallet balance. Check your connection and retry.')
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBalance() }, [loadBalance])

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

      <main className="px-4 py-6 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-3xl w-full">
        {/* Desktop back affordance */}
        <div className="hidden md:block">
          <button onClick={goBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            <X className="h-4 w-4" /> Close
          </button>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-xl md:text-2xl font-black tracking-tight">
            Apply Wallet Credit
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Your real wallet balance, loaded from your account.
          </p>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mx-auto" />
            <p className="text-[11px] text-slate-400 mt-3">Loading your wallet balance…</p>
          </div>
        ) : needsAuth ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <h2 className="text-sm font-black">Sign in required</h2>
            <p className="text-xs text-slate-500">Sign in to see your wallet credit.</p>
            <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
            <h2 className="text-sm font-black">Could not load balance</h2>
            <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
            <Button onClick={loadBalance} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : balance ? (
          <>
            {/* Real Balance Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950 text-primary flex items-center justify-center border border-rose-100 dark:border-rose-900">
                  <CreditCard className="h-3.5 w-3.5" />
                </div>
                <span>Available Wallet Balance</span>
              </div>
              <div className="text-2xl font-black">
                {formatPrice(balance.availableBalance)}
              </div>
              <p className="text-[11px] text-slate-400 font-medium capitalize">Currency: {balance.currency || '--'}</p>
            </div>

            {/* Honest availability notice */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Info className="h-4 w-4 text-primary" />
                <span>Applying credit at checkout is not available yet</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Orders on Zylod currently start UNPAID and are paid in full via verified bank transfer or
                mobile wallet — the checkout does not deduct from your wallet balance yet. Your balance above
                is real and reflects deposits, refunds, and cashback recorded on your account.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button onClick={() => navigate('wallet')} className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs gap-2">
                  <Wallet className="h-4 w-4" /> Open Wallet
                </Button>
                <Button onClick={goBack} variant="outline" className="flex-1 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold h-11 rounded-2xl text-xs">
                  Back
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}

export default ApplyCreditsPage
