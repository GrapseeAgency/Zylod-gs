'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Clock, ShieldCheck, Lock,
  ChevronRight, Loader2, AlertCircle, Building2,
  CheckCircle2, RefreshCw
} from 'lucide-react'

export function PaymentPendingPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
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

  useEffect(() => {
    async function loadPending() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/payments/pending', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setPendingItems(json.data)
        }
      } finally {
        setLoading(false)
      }
    }
    loadPending()
  }, [token])

  const totalPending = pendingItems.reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Pending Clearances</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-3xl md:px-6 md:py-6 lg:max-w-4xl">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-amber-950 rounded-3xl p-5 md:p-6 text-white shadow-xl space-y-2 border border-amber-800/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-300">In Clearance Pipeline</span>
              <div className="text-2xl md:text-4xl font-black font-mono mt-0.5">
                {formatPrice(totalPending)}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-300 pt-1">
            Funds in transit or held in Trade Assurance Escrow awaiting delivery inspection.
          </p>
        </div>

        {/* List */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Scanning Pending Clearances...</span>
            </div>
          ) : pendingItems.length > 0 ? (
            pendingItems.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('order-detail', { orderId: item.orderId })}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 cursor-pointer hover:border-amber-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900">PO #{item.orderNumber}</h3>
                        <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          {item.type}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Initiated on {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-black font-mono text-slate-900">
                    {formatPrice(item.amount)}
                  </span>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 block">All settlements cleared</span>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No pending payments or escrow holds at this moment.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default PaymentPendingPage
