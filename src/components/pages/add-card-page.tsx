'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, CreditCard, Lock, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2, Plus
} from 'lucide-react'

export function AddCardPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()

  const [cardNumber, setCardNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [cardType, setCardType] = useState('credit')
  const [brand, setBrand] = useState('Visa')
  const [isDefault, setIsDefault] = useState(true)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanNum = cardNumber.replace(/\s+/g, '')
    if (cleanNum.length < 15 || !holderName || !expiry) {
      setErrorMsg('Please enter complete 16-digit card number, name, and expiration date')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cardNumber: cleanNum,
          holderName,
          expiry,
          cardType,
          brand,
          isDefault,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setSuccessMsg('Card tokenized and saved securely!')
        setTimeout(() => navigate('credit-debit-cards'), 1500)
      } else {
        setErrorMsg(json.error || 'Failed to save card')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
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
        <span className="text-base font-black tracking-tight text-primary">Add Payment Card</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-3xl">
        {/* Virtual Card Preview */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 rounded-3xl p-6 text-white shadow-2xl space-y-5 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black tracking-widest uppercase text-rose-300">ZYLOD ENTERPRISE</span>
            <span className="text-sm font-black italic">{brand}</span>
          </div>

          <div className="py-2">
            <span className="text-xs text-slate-400 block font-mono">Card Number</span>
            <span className="text-lg font-black font-mono tracking-widest text-slate-100 mt-0.5 block">
              {cardNumber || '•••• •••• •••• ••••'}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Cardholder</span>
              <span className="font-bold text-slate-200 uppercase">{holderName || 'AUTHORIZED SIGNATORY'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Expires</span>
              <span className="font-bold font-mono text-slate-200">{expiry || 'MM/YY'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
            <div className="grid grid-cols-3 gap-2">
              {['Visa', 'Mastercard', 'Amex'].map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                    brand === b
                      ? 'border-primary bg-rose-50 text-primary shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Card Number
              </label>
              <Input
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4000 1234 5678 9010"
                maxLength={19}
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Cardholder Legal Name
              </label>
              <Input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Name printed on card"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
              />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Expiration (MM/YY)</label>
                <Input
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="12/28"
                  maxLength={5}
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Security Code (CVV)</label>
                <Input
                  type="password"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="•••"
                  maxLength={4}
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Set as Primary Card</span>
                <span className="text-[11px] text-slate-400 block">Use for 1-click wholesale checkout</span>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} className="data-[state=checked]:bg-primary" />
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

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? 'Encrypting & Tokenizing...' : 'Save Card Securely'}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default AddCardPage
