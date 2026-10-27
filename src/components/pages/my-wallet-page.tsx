'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft,
  Clock, ShieldCheck, ChevronRight, Landmark,
  CreditCard, RefreshCw, Eye, EyeOff, Plus,
  FileText, CheckCircle2, TrendingUp, AlertCircle,
  HelpCircle, Receipt, DollarSign, Building2, XCircle,
  LogIn,
} from 'lucide-react'

type FundingClaim = {
  id: string
  provider: string
  reference: string
  amount: number
  currency: string
  status: string
  creditedAt: string | null
  createdAt: string
}

const claimChip: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  credited: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-card dark:text-slate-400 dark:border-slate-800',
}

export function MyWalletPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { currentCurrency, formatPrice } = useCurrencyStore()

  const [walletData, setWalletData] = useState<{
    balance: number
    totalDeposits: number
    totalWithdrawals: number
    escrowBalance?: number
    recentTransactions: Array<{
      id: string
      type: string
      amount: number
      balanceAfter: number
      description: string
      date: string
    }>
  }>({
    balance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    escrowBalance: 0,
    recentTransactions: [],
  })

  const [loading, setLoading] = useState(true)
  const [showBalance, setShowBalance] = useState(true)
  const [claims, setClaims] = useState<FundingClaim[]>([])

  // t214 MONEY-PATH HONESTY: a guest (or a session expired mid-flight) must
  // NEVER see this screen — the zeros below are not data, they would be a
  // fabricated financial state. The wallet is server truth (GET /api/wallet);
  // without a session there IS no wallet, so the sign-in wall renders instead.
  const isAuthed = useAuthStore((s) => s.isAuthenticated)
  // Server verdict when the token exists but the session died (401).
  const [sessionInvalid, setSessionInvalid] = useState(false)

  const loadClaims = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/wallet/topup', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401) {
        setSessionInvalid(true)
        return
      }
      if (res.ok && json?.success && Array.isArray(json.data)) setClaims(json.data)
    } catch {
      // the claims ledger is secondary — a network miss leaves the wallet usable
    }
  }

  const loadWallet = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/wallet', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        // Expired/invalid session: show the sign-in wall, never the zeros —
        // zeros would read as a real (empty) wallet.
        setSessionInvalid(true)
        return
      }
      if (res.ok) {
        const json = await res.json()
        if (json.data) setWalletData(json.data)
      }
    } catch {
      // Handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWallet()
    loadClaims()
  }, [token])

  // ─── t214 GUEST WALL — a wallet UI for a logged-out visitor would be a
  // fabricated financial statement (৳0 balance that is not server truth).
  // Same wall pattern as the cart page. ───
  if (!isAuthed || sessionInvalid) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-base font-black tracking-tight text-primary">Wholesale Wallet</span>
          <div className="w-8" />
        </header>
        <main className="max-w-lg mx-auto px-4 py-16 md:py-24 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 dark:bg-card flex items-center justify-center mb-4">
            <LogIn className="h-9 w-9 text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-base font-black">{sessionInvalid ? 'Your session expired' : 'Sign in to open your wallet'}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6 max-w-xs mx-auto">
            Your wallet balance, funding claims and payouts live in your Zylod account — sign in or create one to continue.
          </p>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            <Button
              onClick={() => navigate('login')}
              className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate('register-buyer')}
              variant="outline"
              className="w-full h-11 rounded-2xl font-bold text-sm"
            >
              Create Account
            </Button>
          </div>
        </main>
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
        <span className="text-base font-black tracking-tight text-primary">Wholesale Wallet</span>
        <button
          onClick={() => navigate('transaction-history')}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          title="History"
        >
          <Clock className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto lg:max-w-5xl px-4 py-5 md:px-6 md:py-6 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
        {/* Main Wallet Card */}
        <div className="bg-gradient-to-br from-slate-200 via-slate-100 to-rose-100 dark:from-slate-950 dark:via-slate-900 dark:to-rose-950 rounded-3xl p-6 text-gray-900 dark:text-white shadow-2xl space-y-5 relative overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-gray-900/10 flex items-center justify-center border border-black/10 dark:border-white/10">
                <Wallet className="h-4 w-4 text-rose-600 dark:text-rose-300" />
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Zylod Enterprise Balance</span>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            >
              {showBalance ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>

          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Available Payout &amp; Sourcing Fund</span>
            <div className="text-3xl md:text-4xl font-black tracking-tight mt-1">
              {showBalance ? formatPrice(walletData.balance) : '••••••••'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/10 dark:border-white/10">
            <div className="bg-black/5 dark:bg-gray-900/5 rounded-2xl p-3 border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Total Outflow</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-300 block mt-0.5">
                {showBalance ? formatPrice(walletData.totalWithdrawals) : '••••••'}
              </span>
            </div>
            <div className="bg-black/5 dark:bg-gray-900/5 rounded-2xl p-3 border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Total Inflow</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-300 block mt-0.5">
                {showBalance ? formatPrice(walletData.totalDeposits) : '••••••'}
              </span>
            </div>
            {/* Task 71: the SafePay escrow ledger is REAL now — show it. */}
            <div className="bg-black/5 dark:bg-gray-900/5 rounded-2xl p-3 border border-black/5 dark:border-white/5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">In Escrow</span>
              <span className="text-sm font-bold text-sky-600 dark:text-sky-300 block mt-0.5">
                {showBalance ? formatPrice(walletData.escrowBalance ?? 0) : '••••••'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
          {[
            { label: 'Add Money', icon: Plus, page: 'add-money', bg: 'bg-rose-50 border-rose-200 text-primary' },
            { label: 'Withdraw', icon: ArrowUpRight, page: 'withdraw-money', bg: 'bg-slate-100 dark:bg-card border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200' },
            { label: 'Statements', icon: Receipt, page: 'transaction-history', bg: 'bg-slate-100 dark:bg-card border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200' },
            { label: 'Overview', icon: TrendingUp, page: 'balance-overview', bg: 'bg-slate-100 dark:bg-card border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200' },
          ].map(({ label, icon: Icon, page, bg }) => (
            <button
              key={label}
              onClick={() => navigate(page as any)}
              className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02] shadow-2xs ${bg}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-bold text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {/* Quick Access Menu */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          {[
            { title: 'Commercial Bank Accounts', subtitle: 'Manage verified corporate bank routing', icon: Landmark, page: 'bank-accounts' },
            { title: 'UPI & Mobile Banking Setup', subtitle: 'bKash, Nagad, Rocket merchant links', icon: CreditCard, page: 'upi-payment-setup' },
            { title: 'Credit & Debit Cards', subtitle: 'Manage wholesale corporate payment cards', icon: CreditCard, page: 'credit-debit-cards' },
            { title: 'Trade Credit Facility', subtitle: '30-day revolving wholesale payment line', icon: ShieldCheck, page: 'credit-limit' },
            { title: 'VAT Commercial Invoices', subtitle: 'Mushak 6.3 compliant tax receipts', icon: FileText, page: 'invoice-management' },
          ].map(({ title, subtitle, icon: Icon, page }) => (
            <button
              key={title}
              onClick={() => navigate(page as any)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:bg-background dark:hover:bg-card transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400 shrink-0" />
            </button>
          ))}
        </div>

        {/* Funding Claims (Task 118) — the real walletTopups ledger with
            honest statuses: a claim NEVER moved money on its own; only an
            admin verification credits the wallet. */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">
              Funding claims
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={loadClaims} className="text-xs font-bold text-primary hover:underline">Refresh</button>
              <button
                onClick={() => navigate('add-money')}
                className="text-xs font-bold text-primary hover:underline"
              >
                New claim
              </button>
            </div>
          </div>
          {claims.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {claims.slice(0, 8).map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100">{formatPrice(c.amount)}</span>
                      <span className={`text-[9px] font-black border rounded-lg px-1.5 py-0.5 uppercase tracking-wide ${claimChip[c.status] ?? claimChip.cancelled}`}>
                        {c.status === 'credited' ? <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" /> :
                         c.status === 'pending' ? <Clock className="h-2.5 w-2.5 inline mr-0.5" /> :
                         <XCircle className="h-2.5 w-2.5 inline mr-0.5" />}
                        {c.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block font-mono truncate">
                      {c.provider} · {c.reference} · {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {c.status === 'pending' ? (
                    <span className="text-[10px] text-amber-600 font-bold shrink-0">awaiting verification</span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-300 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs space-y-2">
              <p>No funding claims yet.</p>
              <button
                onClick={() => navigate('add-money')}
                className="inline-flex items-center gap-1.5 text-primary font-bold hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Submit a funding claim
              </button>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">
              Recent Activity
            </h2>
            <button
              onClick={() => navigate('transaction-history')}
              className="text-xs font-bold text-primary hover:underline"
            >
              View All
            </button>
          </div>

          {walletData.recentTransactions.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {walletData.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => navigate('transaction-detail', { id: tx.id })}
                  className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:bg-background dark:hover:bg-card rounded-xl px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {tx.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">{tx.description}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block">{new Date(tx.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black font-mono shrink-0 ${
                    tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {tx.amount >= 0 ? '+' : ''}{formatPrice(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 dark:text-slate-500 dark:text-slate-400 text-xs">
              No transactions recorded yet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default MyWalletPage
