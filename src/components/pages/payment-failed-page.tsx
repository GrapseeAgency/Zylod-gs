'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { ArrowLeft, AlertTriangle, RefreshCw, CreditCard, ChevronRight, HelpCircle, Building2, ArrowRight } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
export function PaymentFailedPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [failedItems, setFailedItems] = useState<Array<{
    id: string
    orderId: string
    orderNumber: string
    amount: number
    method: string
    reason: string
    date: string
  }>>([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFailed() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/payments/failed', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setFailedItems(json.data)
        }
      } finally {
        setLoading(false)
      }
    }
    loadFailed()
  }, [token])

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-rose-600">Failed Transactions</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6">
        {/* Banner */}
        <div className="bg-rose-50 dark:bg-rose-950 rounded-3xl p-5 text-rose-900 dark:text-white shadow-xl space-y-2 border border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-rose-400" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black text-rose-950 dark:text-white">Payment Authorizations Required</h1>
              <p className="text-xs text-rose-700 dark:text-rose-200">
                Transactions that could not be completed by your banking gateway.
              </p>
            </div>
          </div>
        </div>

        {/* Failed items list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {loading ? (
            <div className="py-12 md:col-span-2 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 dark:text-slate-400">
              <PageLoader className="min-h-0" />
            </div>
          ) : failedItems.length > 0 ? (
            failedItems.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-rose-200 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">PO #{item.orderNumber}</h3>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block mt-0.5">
                        Attempted via {item.method} • {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-black font-mono text-rose-600">
                    {formatPrice(item.amount)}
                  </span>
                </div>

                <div className="bg-rose-50/60 rounded-2xl p-3 text-xs text-rose-800 border border-rose-100">
                  <span className="font-bold block text-[10px] uppercase tracking-wider text-rose-500 mb-0.5">Gateway Error Reason</span>
                  {item.reason}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate('checkout', { orderId: item.orderId })}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Payment
                  </Button>
                  <Button
                    onClick={() => navigate('payment-method')}
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Change Method
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 md:col-span-2 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <RefreshCw className="h-10 w-10 mx-auto text-emerald-500 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Zero failed payments</span>
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                All wholesale gateway authorizations are operating normally.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default PaymentFailedPage
