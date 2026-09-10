'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Smartphone, Plus, CheckCircle2,
  Trash2, ShieldCheck, Check, Loader2, CreditCard,
  AlertCircle
} from 'lucide-react'

interface MFSAccount {
  id: string
  provider: string
  accountNumber: string
  accountType: string
  isDefault: boolean
  verified: boolean
}

export function UpiPaymentSetupPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()

  const [accounts, setAccounts] = useState<MFSAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const [provider, setProvider] = useState<'bKash' | 'Nagad' | 'Rocket' | 'Upay'>('bKash')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType] = useState('Merchant')
  const [isDefault, setIsDefault] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadMFS = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/payment-methods/mobile-banking', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) setAccounts(json.data)
      }
    } catch {
      // Graceful
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMFS()
  }, [token])

  const handleAddMFS = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountNumber || accountNumber.length < 11) {
      setErrorMsg('Please enter a valid 11-digit mobile number')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/payment-methods/mobile-banking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          accountNumber,
          accountType,
          isDefault,
        }),
      })

      if (res.ok) {
        setSuccessMsg(`${provider} account linked!`)
        setShowAddForm(false)
        setAccountNumber('')
        loadMFS()
        setTimeout(() => setSuccessMsg(''), 2500)
      } else {
        setErrorMsg('Failed to link MFS account')
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
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">UPI &amp; Mobile Banking</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-primary hover:bg-rose-100"
          title="Add MFS"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">MFS &amp; Instant Settlements</h1>
              <p className="text-xs text-slate-300">
                Link bKash, Nagad, Upay, or Rocket accounts for automated 1-click settlements.
              </p>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Add MFS Form Collapsible */}
        {showAddForm && (
          <form onSubmit={handleAddMFS} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xl space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Link Mobile Account
            </h2>

            <div className="grid grid-cols-4 gap-2">
              {(['bKash', 'Nagad', 'Rocket', 'Upay'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border text-center transition-all ${
                    provider === p
                      ? 'border-primary bg-rose-50 text-primary shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {provider} Number
              </label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Account Classification</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold px-3.5 text-slate-900 focus:outline-none focus:border-primary"
              >
                <option value="Merchant">Merchant Wholesale Account</option>
                <option value="Personal">Personal Account</option>
                <option value="Agent">Agent / Distributor Account</option>
              </select>
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
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Account'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="h-11 rounded-2xl border-slate-200 text-xs font-bold"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Existing MFS Accounts */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Loading Mobile Banking Links...</span>
            </div>
          ) : accounts.length > 0 ? (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900">{acc.provider}</h3>
                      <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {acc.accountType}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                      {acc.accountNumber}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Active
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
              <Smartphone className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 block">No MFS accounts linked</span>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Connect your bKash or Nagad wallet for 1-click order payments and refunds.
              </p>
            </div>
          )}
        </div>

        {!showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Link New Mobile Banking Account
          </Button>
        )}
      </main>
    </div>
  )
}

export default UpiPaymentSetupPage
