'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Wallet, ShieldCheck,
  ArrowDownLeft, ArrowUpRight, TrendingUp,
  RefreshCw, DollarSign, PieChart, Building2,
  CheckCircle2, Sparkles, AlertCircle
} from 'lucide-react'

export function BalanceOverviewPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [data, setData] = useState<{
    availableBalance: number
    totalInflow: number
    totalOutflow: number
    totalDeposits: number
    totalWithdrawals: number
    totalPayments: number
    totalRefunds: number
    totalCashback: number
  }>({
    availableBalance: 0,
    totalInflow: 0,
    totalOutflow: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalPayments: 0,
    totalRefunds: 0,
    totalCashback: 0,
  })

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Auth honesty: wallet balance is user-scoped — gate guests instead of
  // rendering "৳0 available" as if it were their real wallet.
  const [authChecking, setAuthChecking] = useState(true)
  useEffect(() => {
    if (isAuthenticated) { setAuthChecking(false); return }
    const t = setTimeout(() => setAuthChecking(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    async function load() {
      if (!token || !isAuthenticated) { setLoading(false); return }
      try {
        const res = await fetch('/api/wallet/balance', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return
        }
        if (res.ok) {
          const json = await res.json()
          if (json.data) setData(json.data)
        } else {
          setLoadError(`Could not load your wallet balance (HTTP ${res.status}).`)
        }
      } catch {
        setLoadError('Network error — could not reach the wallet service.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, isAuthenticated])

  // Auth gates — guests first, then expired session, then a real load failure
  // (never a fabricated ৳0 balance).
  if (!authChecking && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view your wallet"
        message="Your balance and cash-flow figures come from your real wallet record. Sign in to continue."
      />
    )
  }
  if (sessionExpired) {
    return (
      <AccountGate
        title="Session expired"
        message="Your session has ended. Sign in again to view your wallet balance."
      />
    )
  }
  if (!loading && loadError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-md">
          <AlertCircle className="h-10 w-10 mx-auto text-primary" />
          <p className="text-sm font-bold text-slate-900 dark:text-neutral-100">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-neutral-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Balance Breakdown</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-5xl md:px-6 md:py-8 md:space-y-8">
        {/* Desktop page title */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-neutral-100">Balance Breakdown</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-1">Wallet balance and cash-flow overview</p>
        </div>

        {/* Total Funds Highlight */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-neutral-900 dark:to-rose-950 rounded-3xl p-6 md:p-8 text-gray-900 dark:text-white shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300">
            <PieChart className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Net Position</span>
          </div>
          <div>
            <span className="text-xs text-slate-600 dark:text-neutral-300">Total Wallet Balance</span>
            <div className="text-3xl md:text-4xl font-black mt-0.5">
              {formatPrice(data.availableBalance)}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-black/10 dark:border-white/10 text-xs text-slate-600 dark:text-neutral-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Figures come from your real wallet record and transaction history</span>
          </div>
        </div>

        {/* Breakdown and Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:content-start">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 md:p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">Available Liquid</span>
            <span className="text-base md:text-lg font-black text-slate-900 dark:text-neutral-100 block font-mono">
              {formatPrice(data.availableBalance)}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold block">Ready for instant payout</span>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 md:p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">Total Inflow</span>
            <span className="text-base md:text-lg font-black text-slate-900 dark:text-neutral-100 block font-mono">
              {formatPrice(data.totalInflow)}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold block">Deposits, refunds & cashback</span>
          </div>
        </div>

        {/* Detailed Financial Ledger Breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3 lg:col-span-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
            Historical Capital Flow
          </h2>

          <div className="divide-y divide-slate-50 text-xs md:text-sm">
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-slate-700 dark:text-neutral-300">Total Topups &amp; Deposits</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-neutral-100 font-mono">+{formatPrice(data.totalDeposits)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-rose-600" />
                <span className="font-semibold text-slate-700 dark:text-neutral-300">Bank &amp; MFS Withdrawals</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-neutral-100 font-mono">-{formatPrice(data.totalWithdrawals)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-600 dark:text-neutral-400 dark:text-neutral-500" />
                <span className="font-semibold text-slate-700 dark:text-neutral-300">Wholesale Order Payments</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-neutral-100 font-mono">-{formatPrice(data.totalPayments)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <span className="font-semibold text-slate-700 dark:text-neutral-300">Order Refunds Received</span>
              </div>
              <span className="font-bold text-emerald-600 font-mono">+{formatPrice(data.totalRefunds)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="font-semibold text-slate-700 dark:text-neutral-300">Volume Rebates &amp; Cashback</span>
              </div>
              <span className="font-bold text-purple-600 font-mono">+{formatPrice(data.totalCashback)}</span>
            </div>
          </div>
        </div>
        </div>

        {/* CTA Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2 md:max-w-md">
          <Button
            onClick={() => navigate('add-money')}
            className="h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md"
          >
            Add Money
          </Button>
          <Button
            onClick={() => navigate('withdraw-money')}
            variant="outline"
            className="h-12 rounded-2xl border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-neutral-200 font-bold text-xs hover:bg-slate-50 dark:bg-background dark:hover:bg-card"
          >
            Request Payout
          </Button>
        </div>
      </main>
    </div>
  )
}

export default BalanceOverviewPage
