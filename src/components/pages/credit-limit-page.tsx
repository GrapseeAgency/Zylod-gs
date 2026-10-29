'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, ShieldCheck, CreditCard, TrendingUp,
  Plus, CheckCircle2, AlertCircle, Loader2,
  Calendar, Check, FileText, Landmark
} from 'lucide-react'

export function CreditLimitPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [limitData, setLimitData] = useState<{
    creditLimit: number
    usedCredit: number
    availableCredit: number
    currency: string
    interestFreeGracePeriod: string
    nextSettlementDate: string
    status: string
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showIncreaseForm, setShowIncreaseForm] = useState(false)
  const [requestedLimit, setRequestedLimit] = useState('500000')
  const [reason, setReason] = useState('Higher seasonal procurement for wholesale inventory')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadLimit() {
      if (!token) return
      try {
        const res = await fetch('/api/credits/limit', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return
        }
        if (res.ok) {
          const json = await res.json()
          if (json.data) setLimitData(json.data)
          else setLoadError('No trade credit facility data is available for your account yet.')
        } else {
          setLoadError(`Could not load your trade credit line (HTTP ${res.status}).`)
        }
      } catch {
        setLoadError('Network error while loading your trade credit line. Check your connection and retry.')
      } finally {
        setLoading(false)
      }
    }
    loadLimit()
  }, [token])

  // Deep links can mount before the boot session probe settles — keep loading briefly.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  const handleRequestIncrease = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/credits/limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestedLimit: parseFloat(requestedLimit),
          reason,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setSuccessMsg(json.message || 'Increase request submitted for underwriting review.')
        setShowIncreaseForm(false)
      } else {
        setErrorMsg(json.error || 'Failed to submit credit request')
      }
    } catch {
      setErrorMsg('Network connection error')
    } finally {
      setSubmitting(false)
    }
  }

  const usedPct = limitData && limitData.creditLimit > 0
    ? Math.round((limitData.usedCredit / limitData.creditLimit) * 100)
    : 0

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session has ended. Sign in again to view your trade credit line." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view your trade credit line"
        message="Your credit line shows your real approved facility and utilization. Sign in to continue."
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
        <span className="text-base font-black tracking-tight text-primary">Trade Credit Line</span>
        <button
          onClick={() => navigate('credit-score')}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center text-slate-700 dark:text-neutral-300 hover:bg-slate-200"
          title="Score"
        >
          <TrendingUp className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg lg:max-w-4xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6">
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-3xl px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-red-600">{loadError}</p>
          </div>
        )}
        {limitData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* Main Credit Card */}
        <div className="bg-gradient-to-br from-slate-200 via-slate-100 to-rose-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-rose-950 rounded-3xl p-6 text-gray-900 dark:text-white shadow-2xl space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-center text-rose-600 dark:text-rose-300">
            <span className="text-xs font-bold uppercase tracking-wider">Approved Revolving Line</span>
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              ACTIVE
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-500 dark:text-neutral-400 block">Available Sourcing Credit</span>
            <div className="text-3xl font-black font-mono mt-0.5">
              {formatPrice(limitData.availableCredit)}
            </div>
          </div>

          <div className="w-full bg-black/5 dark:bg-gray-900/10 h-2.5 rounded-full overflow-hidden p-0.5 border border-black/10 dark:border-white/10">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${Math.max(5, usedPct)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/10 dark:border-white/10 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 block uppercase font-bold">Total Facility</span>
              <span className="font-bold text-slate-800 dark:text-neutral-100 font-mono mt-0.5 block">{formatPrice(limitData.creditLimit)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 block uppercase font-bold">Drawn / Utilized</span>
              <span className="font-bold text-rose-600 dark:text-rose-300 font-mono mt-0.5 block">{formatPrice(limitData.usedCredit)}</span>
            </div>
          </div>
        </div>

        {/* Perks */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
            Terms &amp; Settlement SLA
          </h2>
          <div className="divide-y divide-slate-50 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">Interest-Free Grace Period</span>
              <span className="font-bold text-emerald-600">30 Days (0% APR)</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">Next Settlement Cycle</span>
              <span className="font-bold text-slate-900 dark:text-neutral-100">
                {limitData.nextSettlementDate ? new Date(limitData.nextSettlementDate).toLocaleDateString() : 'Active Cycle'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">Underwriting Sponsor</span>
              <span className="font-bold text-slate-900 dark:text-neutral-100">City Bank Wholesale Trade Partner</span>
            </div>
          </div>
        </div>
        </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Increase Request Form */}
        {showIncreaseForm ? (
          <form onSubmit={handleRequestIncrease} className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-xl space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
              Request Credit Limit Increase
            </h2>

            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                Requested Credit Ceiling (BDT)
              </label>
              <Input
                type="number"
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(e.target.value)}
                placeholder="500000"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                Business Justification
              </label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for line expansion"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
              />
            </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Underwriting Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIncreaseForm(false)}
                className="h-11 rounded-2xl border-slate-200 dark:border-neutral-800 text-xs font-bold"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            onClick={() => setShowIncreaseForm(true)}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Request Credit Limit Increase
          </Button>
        )}
      </main>
    </div>
  )
}

export default CreditLimitPage
