'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Wallet, Plus, Check, Loader2,
  ShieldCheck, CreditCard, Landmark, AlertCircle,
  Sparkles, CheckCircle2, ArrowRight
} from 'lucide-react'

export function AddMoneyPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [amount, setAmount] = useState('25000')
  const [selectedMethod, setSelectedMethod] = useState<'bKash' | 'Nagad' | 'Bank' | 'Card'>('bKash')
  const [senderNumber, setSenderNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const presets = ['5000', '15000', '25000', '50000', '100000', '250000']

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseFloat(amount)
    if (isNaN(numeric) || numeric < 500) {
      setErrorMsg('Minimum deposit amount for wholesale wallet is ৳500')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: numeric,
          method: selectedMethod,
          senderNumber,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setSuccessMsg(json.message || `Successfully added ৳${numeric.toLocaleString()} to your wallet!`)
        setTimeout(() => {
          navigate('my-wallet')
        }, 1800)
      } else {
        setErrorMsg(json.error || 'Deposit failed. Please try again.')
      }
    } catch {
      setErrorMsg('Network connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Deposit Capital</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-4xl">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Plus className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Add Funds to Wallet</h1>
              <p className="text-xs text-slate-300">
                Instant funding via Bangladesh Mobile Financial Services or Commercial EFTN.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleTopup} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Amount Input */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
              Enter Deposit Amount (BDT)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400 font-mono">
                ৳
              </span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setErrorMsg('')
                }}
                className="h-14 pl-10 pr-4 text-2xl font-black rounded-2xl bg-slate-50 border-slate-200 font-mono text-slate-900 focus:border-primary"
                placeholder="0"
              />
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`py-2 px-1 text-xs font-bold font-mono rounded-xl border transition-all ${
                    amount === p
                      ? 'border-primary bg-rose-50 text-primary'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  +৳{parseInt(p).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
              Funding Gateway
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'bKash', label: 'bKash Direct', desc: 'Instant 0% gateway fee' },
                { id: 'Nagad', label: 'Nagad Direct', desc: 'Instant postal MFS' },
                { id: 'Bank', label: 'Bank Transfer', desc: 'BEFTN / RTGS corporate' },
                { id: 'Card', label: 'Corporate Card', desc: 'Visa / Mastercard B2B' },
              ].map(({ id, label, desc }) => {
                const isSelected = selectedMethod === id
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setSelectedMethod(id as any)}
                    className={`p-3.5 rounded-2xl border text-left space-y-1 transition-all ${
                      isSelected
                        ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${isSelected ? 'text-primary' : 'text-slate-900'}`}>{label}</span>
                    <span className="text-[10px] text-slate-400 block">{desc}</span>
                  </button>
                )
              })}
            </div>

            {selectedMethod !== 'Card' && (
              <div className="pt-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {selectedMethod} Account / Reference Number
                </label>
                <Input
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="01XXXXXXXXX or Bank Ref"
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
                />
              </div>
            )}
          </div>
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

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? 'Processing Deposit...' : `Proceed to Add ৳${parseInt(amount || '0').toLocaleString()}`}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default AddMoneyPage
