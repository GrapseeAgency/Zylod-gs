'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, DollarSign, TrendingUp, BarChart3,
  Calendar, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Building2, Receipt, Percent, Loader2, ChevronRight
} from 'lucide-react'

export function EarningsDashboardPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [data, setData] = useState<{
    grossGMV: number
    netEarnings: number
    platformCommission: number
    availablePayout: number
    pendingEscrow: number
    totalOrders: number
    commissionRate: string
    recentSales: Array<{ total: number; date: string }>
  }>({
    grossGMV: 0,
    netEarnings: 0,
    platformCommission: 0,
    availablePayout: 0,
    pendingEscrow: 0,
    totalOrders: 0,
    commissionRate: '3.0%',
    recentSales: [],
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEarnings() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/finance/earnings', {
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
    loadEarnings()
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Earnings &amp; Revenue</span>
        <button
          onClick={() => navigate('commission-history')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
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
            className="h-10 rounded-2xl border-slate-200 text-slate-800 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <Percent className="h-4 w-4" />
            Commission Ledger
          </Button>
        </div>

        {/* Main Earnings Card */}
        <div className="bg-gradient-to-br from-slate-900 via-rose-950 to-slate-950 rounded-3xl p-6 text-white shadow-2xl space-y-4">
          <div className="flex justify-between items-center text-rose-300">
            <span className="text-xs font-bold uppercase tracking-wider">Net Realized Revenue</span>
            <span className="text-xs font-black bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
              {data.totalOrders} Orders
            </span>
          </div>

          <div>
            <div className="text-3xl md:text-4xl font-black font-mono">
              {formatPrice(data.netEarnings)}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              After {data.commissionRate} Zylod platform wholesale commission
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross GMV</span>
              <span className="text-sm font-bold text-slate-100 block font-mono mt-0.5">
                {formatPrice(data.grossGMV)}
              </span>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Orders</span>
              <span className="text-sm font-bold text-amber-300 block font-mono mt-0.5">
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
            className="h-12 rounded-2xl border-slate-200 text-slate-800 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <Percent className="h-4 w-4" />
            Commission Ledger
          </Button>
        </div>

        {/* Financial Highlights Breakdown */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Revenue Analytics Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 md:rounded-xl md:border md:border-slate-100 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 font-medium">Gross Merchandise Value (GMV)</span>
              <span className="font-bold text-slate-900 font-mono">{formatPrice(data.grossGMV)}</span>
            </div>
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 md:rounded-xl md:border md:border-slate-100 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 font-medium">Platform Sourcing Commission (3.0%)</span>
              <span className="font-bold text-rose-600 font-mono">-{formatPrice(data.platformCommission)}</span>
            </div>
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 md:rounded-xl md:border md:border-slate-100 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 font-medium">Available for Bank Payout</span>
              <span className="font-bold text-emerald-600 font-mono">{formatPrice(data.availablePayout)}</span>
            </div>
            <div className="py-2.5 flex justify-between md:px-4 md:py-4 md:bg-slate-50 md:rounded-xl md:border md:border-slate-100 md:flex-col md:items-start md:gap-1">
              <span className="text-slate-500 font-medium">Total Orders Recorded</span>
              <span className="font-bold text-amber-600 font-mono">{data.totalOrders}</span>
            </div>
          </div>
        </div>

        {/* Recent Wholesale Sales */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Recent Sales Activity
          </h2>
          {data.recentSales.length > 0 ? (
            <div className="divide-y divide-slate-50 text-xs">
              {data.recentSales.map((sale, i) => (
                <div key={i} className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-semibold text-slate-700">Sub-Order Fulfillment</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold font-mono text-slate-900 block">{formatPrice(sale.total)}</span>
                    <span className="text-[10px] text-slate-400 block">{new Date(sale.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              No sales orders recorded yet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default EarningsDashboardPage
