'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Wallet, ShieldCheck, Lock,
  ArrowDownLeft, ArrowUpRight, TrendingUp,
  RefreshCw, DollarSign, PieChart, Building2,
  CheckCircle2, Sparkles, AlertCircle
} from 'lucide-react'

export function BalanceOverviewPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [data, setData] = useState<{
    availableBalance: number
    heldInEscrow: number
    releasedEscrow: number
    totalInflow: number
    totalOutflow: number
    totalDeposits: number
    totalWithdrawals: number
    totalPayments: number
    totalRefunds: number
    totalCashback: number
  }>({
    availableBalance: 0,
    heldInEscrow: 0,
    releasedEscrow: 0,
    totalInflow: 0,
    totalOutflow: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalPayments: 0,
    totalRefunds: 0,
    totalCashback: 0,
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!token) return
      try {
        const res = await fetch('/api/wallet/balance', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setData(json.data)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Balance Breakdown</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-5xl md:px-6 md:py-8 md:space-y-8">
        {/* Desktop page title */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Balance Breakdown</h1>
          <p className="text-sm text-slate-500 mt-1">Wallet, escrow, and capital flow overview</p>
        </div>

        {/* Total Funds Highlight */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-6 md:p-8 text-white shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-rose-300">
            <PieChart className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Net Position</span>
          </div>
          <div>
            <span className="text-xs text-slate-300">Total Liquid + Escrow Asset Value</span>
            <div className="text-3xl md:text-4xl font-black mt-0.5">
              {formatPrice(data.availableBalance + data.heldInEscrow)}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Protected by Bangladesh Bank Escrow Regulations</span>
          </div>
        </div>

        {/* Breakdown and Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:content-start">
          <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200 shadow-2xs space-y-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Liquid</span>
            <span className="text-base md:text-lg font-black text-slate-900 block font-mono">
              {formatPrice(data.availableBalance)}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold block">Ready for instant payout</span>
          </div>

          <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200 shadow-2xs space-y-1">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
              <Lock className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Held in Escrow</span>
            <span className="text-base md:text-lg font-black text-slate-900 block font-mono">
              {formatPrice(data.heldInEscrow)}
            </span>
            <span className="text-[10px] text-amber-600 font-bold block">Releasing on delivery</span>
          </div>
        </div>

        {/* Detailed Financial Ledger Breakdown */}
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-2xs space-y-3 lg:col-span-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Historical Capital Flow
          </h2>

          <div className="divide-y divide-slate-50 text-xs md:text-sm">
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-slate-700">Total Topups &amp; Deposits</span>
              </div>
              <span className="font-bold text-slate-900 font-mono">+{formatPrice(data.totalDeposits)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-rose-600" />
                <span className="font-semibold text-slate-700">Bank &amp; MFS Withdrawals</span>
              </div>
              <span className="font-bold text-slate-900 font-mono">-{formatPrice(data.totalWithdrawals)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-600" />
                <span className="font-semibold text-slate-700">Wholesale Order Payments</span>
              </div>
              <span className="font-bold text-slate-900 font-mono">-{formatPrice(data.totalPayments)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-slate-700">Order Refunds Received</span>
              </div>
              <span className="font-bold text-emerald-600 font-mono">+{formatPrice(data.totalRefunds)}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="font-semibold text-slate-700">Volume Rebates &amp; Cashback</span>
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
            className="h-12 rounded-2xl border-slate-200 text-slate-800 font-bold text-xs hover:bg-slate-50"
          >
            Request Payout
          </Button>
        </div>
      </main>
    </div>
  )
}

export default BalanceOverviewPage
