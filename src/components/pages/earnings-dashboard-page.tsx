'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, DollarSign, TrendingUp, BarChart3,
  Calendar, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Building2, Receipt, Percent, Loader2, ChevronRight
} from 'lucide-react'

interface EarningsData {
  grossGMV: number
  netEarnings: number
  platformCommission: number
  availablePayout: number
  pendingEscrow: number
  totalPaidOut?: number
  totalOrders: number
  commissionRate: string
  recentSales: Array<{ total: number; date: string }>
}

export function EarningsDashboardPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token, isAuthenticated, user } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  // t216 honesty fix: this is a SUPPLIER money page. Guests and buyer
  // accounts get an account gate — never a fabricated ৳0 revenue dashboard.
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const isSupplier = isAuthenticated && user?.userType === 'supplier'

  // Deep links can mount before the boot session probe settles — keep the
  // skeleton up briefly, then show the honest sign-in gate for real guests.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isSupplier) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setSessionExpired(false)
    ;(async () => {
      try {
        const res = await fetch('/api/finance/earnings', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (cancelled) return
        if (res.status === 401) { setSessionExpired(true); return }
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || `Failed to load earnings (${res.status})`)
        if (!json?.data) throw new Error('Earnings data is unavailable right now.')
        setData(json.data)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load earnings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isSupplier, token, retryNonce])

  // ── Honest gates — no fabricated numbers beyond this point ──
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view earnings"
        message="Earnings & Revenue shows the real payout state of a supplier account. Sign in with your supplier account to continue."
        showBecomeSupplier
      />
    )
  }
  if (isAuthenticated && !isSupplier) {
    return (
      <AccountGate
        title="Supplier accounts only"
        message={`Earnings & Revenue belongs to supplier accounts — you are signed in as a ${user?.userType ?? 'buyer'}, so there is no supplier revenue to show. Register a supplier business to start selling on Zylod.`}
        showBecomeSupplier
      />
    )
  }
  if (sessionExpired) {
    return (
      <AccountGate
        title="Session expired"
        message="Your session is no longer valid. Sign in again with your supplier account to view earnings."
      />
    )
  }
  if (loading || (!data && !loadError)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  if (loadError || !data) {
    return (
      <div className="min-h-[60vh] bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-3">
          <ShieldCheck className="h-8 w-8 mx-auto text-primary" />
          <h1 className="text-base font-bold text-foreground">Could not load your earnings</h1>
          <p className="text-sm text-muted-foreground">{loadError || 'Earnings data is unavailable right now.'}</p>
          <Button
            onClick={() => setRetryNonce(n => n + 1)}
            className="h-9 px-4 font-bold text-xs rounded-xl"
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Earnings &amp; Revenue</span>
        <button
          onClick={() => navigate('commission-history')}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          title="Commissions"
        >
          <Percent className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 md:space-y-6 space-y-4 lg:max-w-[1280px]">
        {/* Desktop Page Header */}
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-primary">Earnings &amp; Revenue</h1>
          <Button
            onClick={() => navigate('commission-history')}
            variant="outline"
            className="h-10 rounded-2xl border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:bg-background dark:hover:bg-card flex items-center justify-center gap-2"
          >
            <Percent className="h-4 w-4" />
            Commission Ledger
          </Button>
        </div>

        {/* Main Earnings Card */}
        <div className="bg-gradient-to-br from-slate-100 via-rose-100 to-slate-200 dark:from-slate-900 dark:via-rose-950 dark:to-slate-950 rounded-3xl p-6 text-gray-900 dark:text-white shadow-2xl space-y-4">
          <div className="flex justify-between items-center text-rose-600 dark:text-rose-300">
            <span className="text-xs font-bold uppercase tracking-wider">Net Realized Revenue</span>
            <span className="text-xs font-black bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
              {data.totalOrders} Orders
            </span>
          </div>

          <div>
            <div className="text-3xl md:text-4xl font-black font-mono">
              {formatPrice(data.netEarnings)}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
              After {data.commissionRate} Zylod platform wholesale commission
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-black/10 dark:border-white/10">
            <div className="bg-black/5 dark:bg-gray-900/5 rounded-2xl p-3 border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Gross GMV</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block font-mono mt-0.5">
                {formatPrice(data.grossGMV)}
              </span>
            </div>
            <div className="bg-black/5 dark:bg-gray-900/5 rounded-2xl p-3 border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Total Orders</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-300 block font-mono mt-0.5">
                {data.totalOrders}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => navigate('withdraw-money')}
            className="h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="h-4 w-4" />
            Withdraw Proceeds
          </Button>
          <Button
            onClick={() => navigate('commission-history')}
            variant="outline"
            className="h-12 rounded-2xl border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:bg-background dark:hover:bg-card flex items-center justify-center gap-2"
          >
            <Percent className="h-4 w-4" />
            Commission Ledger
          </Button>
        </div>

        {/* Financial Highlights Breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">
            Revenue Analytics Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 dark:bg-background md:rounded-xl md:border md:border-slate-100 dark:border-slate-800 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Gross Merchandise Value (GMV)</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{formatPrice(data.grossGMV)}</span>
            </div>
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 dark:bg-background md:rounded-xl md:border md:border-slate-100 dark:border-slate-800 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Platform Sourcing Commission (3.0%)</span>
              <span className="font-bold text-rose-600 font-mono">-{formatPrice(data.platformCommission)}</span>
            </div>
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 dark:bg-background md:rounded-xl md:border md:border-slate-100 dark:border-slate-800 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Available for Bank Payout</span>
              <span className="font-bold text-emerald-600 font-mono">{formatPrice(data.availablePayout)}</span>
            </div>
            {/* Task 73: these two were hidden zeros before the escrow + payout
                ledgers existed — now they are the seller's real money state. */}
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-amber-50 md:rounded-xl md:border md:border-amber-100 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Held in SafePay Escrow (in transit)</span>
              <span className="font-bold text-amber-600 font-mono">{formatPrice(data.pendingEscrow)}</span>
            </div>
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-emerald-50 md:rounded-xl md:border md:border-emerald-100 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Escrow Released &amp; Paid to Wallet</span>
              <span className="font-bold text-emerald-700 font-mono">{formatPrice(data.totalPaidOut ?? 0)}</span>
            </div>
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 dark:bg-background md:rounded-xl md:border md:border-slate-100 dark:border-slate-800 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Total Orders Recorded</span>
              <span className="font-bold text-amber-600 font-mono">{data.totalOrders}</span>
            </div>
          </div>
        </div>

        {/* Recent Wholesale Sales */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">
            Recent Sales Activity
          </h2>
          {data.recentSales.length > 0 ? (
            <div className="divide-y divide-slate-50 text-xs">
              {data.recentSales.map((sale, i) => (
                <div key={i} className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Sub-Order Fulfillment</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100 block">{formatPrice(sale.total)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block">{new Date(sale.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs">
              No sales orders recorded yet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default EarningsDashboardPage
