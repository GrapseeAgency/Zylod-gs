'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Gift, Wallet, QrCode, CheckCircle2,
  AlertCircle, ShieldCheck
} from 'lucide-react'

export function GiftCardPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [currentBalance, setCurrentBalance] = useState(1245.00)
  const [giftCode, setGiftCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null)

  const handleFormatCode = (val: string) => {
    // Keep uppercase alphanumeric
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16)
    setGiftCode(clean)
  }

  const handleCheckBalance = () => {
    if (!giftCode || giftCode.length < 8) {
      setStatusMsg({ type: 'info', text: 'Please enter a valid 16-digit card code to check balance.' })
      return
    }
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      setStatusMsg({ type: 'info', text: `Gift Card #${giftCode.slice(0, 4)}... has an active balance of $250.00.` })
    }, 600)
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!giftCode || giftCode.length < 8) {
      setStatusMsg({ type: 'info', text: 'Please enter a complete 16-digit code.' })
      return
    }
    setApplying(true)
    setTimeout(() => {
      setApplying(false)
      setCurrentBalance((prev) => prev + 250.00)
      setStatusMsg({ type: 'success', text: '$250.00 added to your account balance successfully!' })
      setGiftCode('')
    }, 900)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5 md:p-8">
          {/* Top Title with Gift Icon */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base md:text-2xl font-black text-slate-900 leading-tight">
                Redeem Gift Card
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1 leading-relaxed">
                Add funds to your WholesaleBD account balance.
              </p>
            </div>
          </div>

          {/* Current Balance Box */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Balance
              </span>
              <span className="text-2xl md:text-3xl font-black text-slate-900 mt-0.5 block">
                {formatPrice(currentBalance)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
              <Wallet className="h-5 w-5" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleApply} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-900 block">
                Gift Card Code
              </label>
              <div className="relative">
                <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  value={giftCode}
                  onChange={(e) => handleFormatCode(e.target.value)}
                  placeholder="ENTER 16-DIGIT CODE"
                  className="h-12 pl-11 pr-4 rounded-2xl bg-white border-slate-200 text-xs font-mono font-bold tracking-widest uppercase text-slate-800 placeholder:text-slate-300"
                />
              </div>
              <p className="text-[10px] text-slate-400 pl-1 font-medium">
                Code is case-insensitive. Dashes are not required.
              </p>
            </div>

            {statusMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-slate-500 shrink-0" />
                )}
                <span>{statusMsg.text}</span>
              </motion.div>
            )}

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCheckBalance}
                disabled={checking}
                className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs"
              >
                {checking ? 'Checking...' : 'Check Balance'}
              </Button>

              <Button
                type="submit"
                disabled={applying}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
              >
                {applying ? 'Applying...' : 'Apply to Account'}
              </Button>
            </div>
          </form>

          {/* Terms Footer */}
          <p className="text-[10px] text-slate-400 text-center leading-relaxed pt-2 border-t border-slate-100">
            By redeeming a gift card, you agree to our{' '}
            <span className="text-primary font-bold">Terms &amp; Conditions</span>. Gift cards are non-refundable.
          </p>
        </div>
      </main>
    </div>
  )
}
