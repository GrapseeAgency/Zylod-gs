'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { AccountGate } from '@/components/shared/account-gate'
import { ArrowLeft, Percent, DollarSign, Receipt, CheckCircle2, Calendar, FileText, ShieldCheck, TrendingUp, AlertCircle } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
export function CommissionHistoryPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token, isAuthenticated, user } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [data, setData] = useState<{
    totalGross: number
    totalCommissions: number
    items: Array<{
      id: string
      orderNumber: string
      subOrderNumber: string
      grossAmount: number
      ratePercent: string
      commissionAmount: number
      netPayout: number
      status: string
      date: string
    }>
  }>({
    totalGross: 0,
    totalCommissions: 0,
    items: [],
  })

  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Deep links can mount before the boot session probe settles — keep loading briefly.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    async function load() {
      if (!token) return
      try {
        const res = await fetch('/api/finance/commissions', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return
        }
        if (res.ok) {
          const json = await res.json()
          if (json.data) setData(json.data)
          else setLoadError('No commission data was returned for your account.')
        } else {
          setLoadError(`Could not load your commission statements (HTTP ${res.status}).`)
        }
      } catch {
        setLoadError('Network error while loading your commission statements. Check your connection and retry.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session has ended. Sign in again to view your commission statements." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view your commission statements"
        message="Commission statements show the real platform fees deducted from your fulfilled orders. Sign in to continue."
        showBecomeSupplier
      />
    )
  }
  if (isAuthenticated && user && user.userType !== 'supplier') {
    return (
      <AccountGate
        title="Supplier accounts only"
        message={`Commission statements belong to supplier accounts — you are signed in as a ${user.userType}.`}
        showBecomeSupplier
      />
    )
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100 md:hidden" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Commission Statements</span>
        <button
          onClick={() => navigate('earnings-dashboard')}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          title="Earnings"
        >
          <DollarSign className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:space-y-6 lg:max-w-4xl lg:py-8">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-slate-900 dark:to-rose-950 rounded-3xl p-5 md:p-8 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <Percent className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-300">Total Deductions</span>
              <div className="text-2xl md:text-4xl font-black font-mono mt-0.5">
                {formatPrice(data.totalCommissions)}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
            Commission entries recorded on fulfilled wholesale orders — amounts and rates come from your real order records.
          </p>
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-3xl px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-red-600">{loadError}</p>
          </div>
        )}

        {/* Ledger */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-background border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 md:hidden">
            <span>Sub-Order / Date</span>
            <span>Fee (3%) / Net</span>
          </div>

          {loading ? (
            <PageLoader label="Loading Commission Statements…" />
          ) : data.items.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                {data.items.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">PO #{item.orderNumber}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block mt-0.5">
                        Gross: {formatPrice(item.grossAmount)} • {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-black font-mono text-rose-600 block">
                        -{formatPrice(item.commissionAmount)}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 font-mono block">
                        Net: {formatPrice(item.netPayout)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-background text-left text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      <th className="py-3 px-5 font-bold">Sub-Order</th>
                      <th className="py-3 px-3 font-bold">Date</th>
                      <th className="py-3 px-3 font-bold text-right">Gross</th>
                      <th className="py-3 px-3 font-bold text-right">Fee (3%)</th>
                      <th className="py-3 px-5 font-bold text-right">Net Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:bg-background dark:hover:bg-card">
                        <td className="py-3 px-5 font-bold text-slate-900 dark:text-slate-100">PO #{item.orderNumber}</td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 dark:text-slate-500">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">{formatPrice(item.grossAmount)}</td>
                        <td className="py-3 px-3 text-right font-black font-mono text-rose-600">
                          -{formatPrice(item.commissionAmount)}
                        </td>
                        <td className="py-3 px-5 text-right font-bold font-mono text-emerald-600">
                          {formatPrice(item.netPayout)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 dark:text-slate-400 space-y-1">
              <Percent className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500 block">No commission records</span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default CommissionHistoryPage
