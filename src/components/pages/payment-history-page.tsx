'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, CreditCard, CheckCircle2, Clock,
  AlertCircle, ChevronRight, Loader2, Filter,
  Receipt, DollarSign, Building2
} from 'lucide-react'

export function PaymentHistoryPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [payments, setPayments] = useState<Array<{
    id: string
    orderId: string
    orderNumber: string
    amount: number
    method: string
    status: string
    transactionId: string
    paidAt: string | null
    orderTotal: number
  }>>([])

  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    async function load() {
      if (!token) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const url = `/api/payments/history?status=${filterStatus}`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setPayments(json.data)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, filterStatus])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Payment History</span>
        <button
          onClick={() => navigate('payment-pending')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Pending"
        >
          <Clock className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-5">
        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Payments' },
            { id: 'success', label: 'Completed' },
            { id: 'pending', label: 'Pending' },
            { id: 'failed', label: 'Failed' },
          ].map(({ id, label }) => {
            const isSelected = filterStatus === id
            return (
              <button
                key={id}
                onClick={() => setFilterStatus(id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            )
          })}

          <button
            onClick={() => navigate('payment-pending')}
            className="hidden md:flex ml-auto w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
            title="Pending"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>

        {/* Payments List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Loading Payment Records...</span>
            </div>
          ) : payments.length > 0 ? (
            <>
            <div className="divide-y divide-slate-100 md:hidden">
              {payments.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate('order-detail', { orderId: p.orderId })}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      p.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                      p.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">PO #{p.orderNumber}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          p.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                          p.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {p.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Via {p.method} • {p.transactionId}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black font-mono text-slate-900 block">
                      {formatPrice(p.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/50 text-left">
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Order</th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Method</th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Transaction</th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Amount</th>
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate('order-detail', { orderId: p.orderId })}
                      className="cursor-pointer hover:bg-red-50/30"
                    >
                      <td className="px-4 py-3 text-xs font-bold text-slate-900 whitespace-nowrap">PO #{p.orderNumber}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.method}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono max-w-[180px] truncate">{p.transactionId}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          p.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                          p.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-black font-mono text-slate-900 whitespace-nowrap">
                        {formatPrice(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-[10px] text-slate-400 whitespace-nowrap">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <CreditCard className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-600 block">No payment records found</span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default PaymentHistoryPage
