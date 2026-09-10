'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, ArrowUpRight, Landmark, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2, CreditCard,
  Building2, Lock, DollarSign, RefreshCw
} from 'lucide-react'

export function WithdrawMoneyPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [availableBalance, setAvailableBalance] = useState(0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'bank' | 'bKash' | 'Nagad' | 'Rocket'>('bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [bankName, setBankName] = useState('City Bank PLC')

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    async function loadBalance() {
      if (!token) return
      try {
        const res = await fetch('/api/wallet', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setAvailableBalance(json.data.balance || 0)
        }
      } finally {
        setInitialLoading(false)
      }
    }
    loadBalance()
  }, [token])

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseFloat(amount)

    if (isNaN(numeric) || numeric < 50) {
      setErrorMsg('Minimum withdrawal threshold is ৳50')
      return
    }
    if (numeric > availableBalance) {
      setErrorMsg('Withdrawal amount exceeds available wallet balance')
      return
    }
    if (!accountNumber || !holderName) {
      setErrorMsg('Please enter account number and beneficiary name')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: numeric,
          method,
          accountNumber,
          holderName,
          bankName: method === 'bank' ? bankName : undefined,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setSuccessMsg(json.message || `Payout of ৳${numeric.toLocaleString()} queued for settlement!`)
        setTimeout(() => navigate('my-wallet'), 2000)
      } else {
        setErrorMsg(json.error || 'Withdrawal failed. Please check details.')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Request Payout</span>
        <div className="w-8" />
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Request Payout</h1>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Available Balance Box */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-1">
          <span className="text-xs text-slate-300">Available Liquid Balance</span>
          <div className="text-2xl font-black font-mono">
            {formatPrice(availableBalance)}
          </div>
          <p className="text-[11px] text-slate-400 pt-1">
            Settlement SLA: Commercial Bank (1-2 business days), bKash/Nagad (Instant to 2 hours).
          </p>
        </div>

        <form onSubmit={handleWithdraw} className="space-y-4">
          {/* Amount */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                Payout Amount
              </label>
              <button
                type="button"
                onClick={() => setAmount(availableBalance.toString())}
                className="text-xs font-bold text-primary hover:underline"
              >
                Withdraw Max
              </button>
            </div>
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
                placeholder="0"
                className="h-14 pl-10 pr-4 text-2xl font-black rounded-2xl bg-slate-50 border-slate-200 font-mono text-slate-900 focus:border-primary"
              />
            </div>
          </div>

          {/* Method Select */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
              Payout Destination
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'bank', label: 'Commercial Bank', desc: 'BEFTN / RTGS corporate' },
                { id: 'bKash', label: 'bKash Merchant', desc: 'Direct merchant wallet' },
                { id: 'Nagad', label: 'Nagad Wallet', desc: 'Postal MFS payout' },
                { id: 'Rocket', label: 'DBBL Rocket', desc: 'Dutch-Bangla MFS' },
              ].map(({ id, label, desc }) => {
                const isSelected = method === id
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setMethod(id as any)}
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

            {/* Account Details */}
            <div className="space-y-3 pt-2">
              {method === 'bank' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Bank Name</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold px-3.5 text-slate-900 focus:outline-none focus:border-primary"
                  >
                    <option value="City Bank PLC">City Bank PLC</option>
                    <option value="BRAC Bank PLC">BRAC Bank PLC</option>
                    <option value="Dutch-Bangla Bank (DBBL)">Dutch-Bangla Bank (DBBL)</option>
                    <option value="Islami Bank Bangladesh PLC">Islami Bank Bangladesh PLC</option>
                    <option value="Eastern Bank PLC (EBL)">Eastern Bank PLC (EBL)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {method === 'bank' ? 'Account Number' : `${method} Wallet Number`}
                </label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={method === 'bank' ? '13-16 digit account number' : '01XXXXXXXXX'}
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Beneficiary / Corporate Account Title
                </label>
                <Input
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Exact legal name on account"
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                />
              </div>
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            {loading ? 'Submitting Request...' : `Withdraw ৳${parseFloat(amount || '0').toLocaleString()}`}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default WithdrawMoneyPage
