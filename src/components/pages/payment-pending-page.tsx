'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { ArrowLeft, Clock, ShieldCheck, Lock, ChevronRight, AlertCircle, Building2, CheckCircle2, RefreshCw } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
import { AccountGate } from '@/components/shared/account-gate'
export function PaymentPendingPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [pendingItems, setPendingItems] = useState<Array<{
    id: string
    orderId: string
    orderNumber: string
    amount: number
    type: string
    method: string
    status: string
    date: string
    description: string
  }>>([])

  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Honesty fix: pending clearances are YOUR payments — guests must not see a
  // fabricated "৳0 / All settlements cleared" banner.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    async function loadPending() {
      if (!isAuthenticated) return
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/payments/pending', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
        if (!res.ok) {
          const json = await res.json().catch(() => null)
          throw new Error(json?.error || `Failed to load pending payments (${res.status})`)
        }
        const json = await res.json()
        if (json.data) setPendingItems(json.data)
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load pending payments')
      } finally {
        setLoading(false)
      }
    }
    loadPending()
  }, [isAuthenticated, token])

  const totalPending = pendingItems.reduce((acc, curr) => acc + curr.amount, 0)

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session is no longer valid. Sign in again to view your pending payments." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view pending clearances"
        message="Pending clearances are the payment reports on your own orders. Sign in to see the real amounts."
      />
    )
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-neutral-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Pending Clearances</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-3xl md:px-6 md:py-6 lg:max-w-4xl">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-amber-100 dark:from-neutral-900 dark:to-amber-950 rounded-3xl p-5 md:p-6 text-gray-900 dark:text-white shadow-xl space-y-2 border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-300">In Clearance Pipeline</span>
              <div className="text-2xl md:text-4xl font-black font-mono mt-0.5">
                {formatPrice(totalPending)}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-neutral-300 pt-1">
            Payments reported but not yet verified. Orders stay UNPAID until Zylod verifies the payment.
          </p>
        </div>

        {/* List */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {loading ? (
            <PageLoader label="Scanning Pending Clearances…" />
          ) : loadError ? (
            <div className="md:col-span-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-3xl p-6 text-center space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 block">Could not load pending payments</span>
              <p className="text-xs text-slate-500 dark:text-neutral-400">{loadError}</p>
            </div>
          ) : pendingItems.length > 0 ? (
            pendingItems.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('order-detail', { orderId: item.orderId })}
                className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3 cursor-pointer hover:border-amber-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-neutral-100">PO #{item.orderNumber}</h3>
                        <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          {item.type}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 block mt-0.5">
                        Initiated on {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-black font-mono text-slate-900 dark:text-neutral-100">
                    {formatPrice(item.amount)}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-neutral-400 dark:text-neutral-500 bg-slate-50 dark:bg-background p-3 rounded-2xl border border-slate-100 dark:border-neutral-800 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-neutral-800 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 block">All settlements cleared</span>
              <p className="text-xs text-slate-400 dark:text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
                No pending payments at this moment.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default PaymentPendingPage
