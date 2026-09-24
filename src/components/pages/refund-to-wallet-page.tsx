'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, RefreshCw, Wallet, CheckCircle2,
  ShieldCheck, ArrowDownLeft, Loader2, FileText,
  AlertCircle
} from 'lucide-react'

export function RefundToWalletPage() {
  const { goBack, navigate, pageParams } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [refunds, setRefunds] = useState<Array<{
    id: string
    amount: number
    balanceAfter: number
    description: string
    relatedEntityId?: string
    createdAt: string
    status: string
  }>>([])

  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState(pageParams?.orderId || '')
  const [amount, setAmount] = useState(pageParams?.amount || '12000')
  const [reason, setReason] = useState('Order cancellation by buyer')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const loadRefunds = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/wallet/refund', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) setRefunds(json.data)
      }
    } catch {
      // Handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRefunds()
  }, [token])

  const handleClaimRefund = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/wallet/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          amount: parseFloat(amount),
          reason,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setSuccessMsg(json.message || 'Refund credited to your wholesale wallet instantly!')
        loadRefunds()
      } else {
        setErrorMsg(json.error || 'Failed to claim refund')
      }
    } catch {
      setErrorMsg('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Refund to Wallet</span>
        <button
          onClick={() => navigate('my-wallet')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Wallet"
        >
          <Wallet className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Refund to Wallet</h1>
          <button
            onClick={() => navigate('my-wallet')}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
            title="Wallet"
          >
            <Wallet className="h-4 w-4" />
          </button>
        </div>
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Instant Wallet Re-Credit</h1>
              <p className="text-xs text-slate-300">
                Approved refunds are credited to your wallet balance once the refund is processed — timing depends on verification of the original payment.
              </p>
            </div>
          </div>
        </div>

        {/* Claim Refund Form */}
        <form onSubmit={handleClaimRefund} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Process Direct Wallet Refund
          </h2>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Purchase Order ID</label>
            <Input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. ORD-102948"
              className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Refund Amount (BDT)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Refund Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold px-3.5 text-slate-900 focus:outline-none focus:border-primary"
            >
              <option value="Order cancellation by buyer">Order cancellation by buyer</option>
              <option value="Supplier stock shortfall">Supplier stock shortfall</option>
              <option value="Quality inspection discrepancy">Quality inspection discrepancy</option>
              <option value="Mutual RFQ cancellation">Mutual RFQ cancellation</option>
            </select>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMsg}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {submitting ? 'Crediting Wallet...' : 'Credit Instant Refund'}
          </Button>
        </form>

        {/* Refund History */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Refund History Ledger
          </h2>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-bold">Loading Refund History...</span>
            </div>
          ) : refunds.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {refunds.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ArrowDownLeft className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">{r.description}</span>
                      <span className="text-[10px] text-slate-400 block">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="text-xs font-black font-mono text-emerald-600 shrink-0">
                    +{formatPrice(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No refund transactions recorded.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default RefundToWalletPage
