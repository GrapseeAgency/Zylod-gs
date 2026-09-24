'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Receipt, CheckCircle2, ShieldCheck,
  Download, Share2, ArrowDownLeft, ArrowUpRight,
  Clock, Hash, Building2, CreditCard, Loader2
} from 'lucide-react'

export function TransactionDetailPage() {
  const { goBack, pageParams, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const txId = pageParams?.id || ''
  const [data, setData] = useState<{
    id: string
    type: string
    amount: number
    balanceAfter: number
    description: string
    createdAt: string
    status: string
    fee: number
    currency: string
    referenceNumber: string
    paymentMethod: string
  } | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDetail() {
      if (!token || !txId) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/wallet/transactions/${txId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setData(json.data)
        }
      } catch {
        // Handled
      } finally {
        setLoading(false)
      }
    }
    loadDetail()
  }, [token, txId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isCredit = (data?.amount ?? 0) >= 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Transaction Receipt</span>
        <button
          onClick={() => window.print()}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Print"
        >
          <Download className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Receipt Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-5 text-center relative overflow-hidden">
          <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center ${
            isCredit ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100' : 'bg-rose-50 text-rose-600 border-2 border-rose-100'
          }`}>
            {isCredit ? <ArrowDownLeft className="h-8 w-8" /> : <ArrowUpRight className="h-8 w-8" />}
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              {data?.status || 'SETTLED'}
            </span>
            <div className="text-3xl font-black font-mono text-slate-900 mt-2">
              {isCredit ? '+' : ''}{formatPrice(Math.abs(data?.amount || 0))}
            </div>
            <p className="text-xs font-bold text-slate-500 mt-1">{data?.description}</p>
          </div>

          <div className="border-t border-dashed border-slate-200 pt-4 text-left divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400 font-medium">Reference Number</span>
              <span className="font-mono font-bold text-slate-900">{data?.referenceNumber || txId}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400 font-medium">Payment Gateway</span>
              <span className="font-bold text-slate-900">{data?.paymentMethod || 'Zylod Wallet'}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400 font-medium">Transaction Date</span>
              <span className="font-bold text-slate-900">
                {data?.createdAt ? new Date(data.createdAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400 font-medium">Transaction Fee</span>
              <span className="font-bold text-emerald-600">৳0.00 (Free)</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400 font-medium">Updated Wallet Balance</span>
              <span className="font-mono font-bold text-slate-900">{formatPrice(data?.balanceAfter || 0)}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Recorded in your Zylod transaction history</span>
          </div>
        </div>

        {/* Back CTA */}
        <Button
          onClick={() => navigate('transaction-history')}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
        >
          Back to Transaction Ledger
        </Button>
      </main>
    </div>
  )
}

export default TransactionDetailPage
