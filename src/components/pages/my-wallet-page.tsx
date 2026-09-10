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
  HelpCircle, Receipt, DollarSign, Building2
} from 'lucide-react'

export function MyWalletPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { currentCurrency, formatPrice } = useCurrencyStore()

  const [walletData, setWalletData] = useState<{
    balance: number
    escrowBalance: number
    totalDeposits: number
    totalWithdrawals: number
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
    escrowBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    recentTransactions: [],
  })

  const [loading, setLoading] = useState(true)
  const [showBalance, setShowBalance] = useState(true)

  const loadWallet = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/wallet', {
        headers: { Authorization: `Bearer ${token}` },
      })
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
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Wholesale Wallet</span>
        <button
          onClick={() => navigate('transaction-history')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="History"
        >
          <Clock className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto lg:max-w-5xl px-4 py-5 md:px-6 md:py-6 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
        {/* Main Wallet Card */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 rounded-3xl p-6 text-white shadow-2xl space-y-5 relative overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                <Wallet className="h-4 w-4 text-rose-300" />
              </div>
              <span className="text-xs font-bold text-slate-300">Zylod Enterprise Balance</span>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="text-slate-400 hover:text-white p-1"
            >
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>

          <div>
            <span className="text-xs text-slate-400 block font-medium">Available Payout &amp; Sourcing Fund</span>
            <div className="text-3xl md:text-4xl font-black tracking-tight mt-1">
              {showBalance ? formatPrice(walletData.balance) : '••••••••'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Escrow Held</span>
              <span className="text-sm font-bold text-amber-300 block mt-0.5">
                {showBalance ? formatPrice(walletData.escrowBalance) : '••••••'}
              </span>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Total Inflow</span>
              <span className="text-sm font-bold text-emerald-300 block mt-0.5">
                {showBalance ? formatPrice(walletData.totalDeposits) : '••••••'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
          {[
            { label: 'Add Money', icon: Plus, page: 'add-money', bg: 'bg-rose-50 border-rose-200 text-primary' },
            { label: 'Withdraw', icon: ArrowUpRight, page: 'withdraw-money', bg: 'bg-slate-100 border-slate-200 text-slate-800' },
            { label: 'Statements', icon: Receipt, page: 'transaction-history', bg: 'bg-slate-100 border-slate-200 text-slate-800' },
            { label: 'Overview', icon: TrendingUp, page: 'balance-overview', bg: 'bg-slate-100 border-slate-200 text-slate-800' },
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
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
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
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{title}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
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
            <div className="divide-y divide-slate-100">
              {walletData.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => navigate('transaction-detail', { id: tx.id })}
                  className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {tx.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">{tx.description}</span>
                      <span className="text-[10px] text-slate-400 block">{new Date(tx.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black font-mono shrink-0 ${
                    tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {tx.amount >= 0 ? '+' : ''}{formatPrice(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              No transactions recorded yet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default MyWalletPage
