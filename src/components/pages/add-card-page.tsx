'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, CreditCard, Lock, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2, LogIn,
} from 'lucide-react'

/**
 * t214 MONEY-PATH HONESTY REWRITE — this page used to collect a FULL PAN +
 * CVV ("Encrypting & Tokenizing...", "Card tokenized and saved securely!")
 * while the POST /api/cards contract stores ONLY the last 4 digits, network
 * and expiry. No gateway, no tokenization vault, no charge capability exists
 * anywhere in the codebase — the form was a fake-verification theater that
 * collected sensitive data it could never use (PCI smell), and accepted
 * arbitrary numbers with zero validation.
 *
 * The honest contract, identical to the real rails elsewhere on the platform:
 *   - The form collects the LAST 4 DIGITS ONLY — it is a reconciliation
 *     reference (brand + last4 + holder + expiry), never a payment
 *     instrument. Zylod cannot charge it and no checkout path can use it:
 *     orders pay via wallet balance (real debit) or verified bank/mobile
 *     transfer (webhook/admin verification) or COD (pay-on-delivery).
 *   - REAL validation: Luhn checksum on the card number field is used only
 *     to DERIVE and sanity-check the last-4 entry (the full number never
 *     leaves the input and is never stored or sent), expiry must be MM/YY
 *     and not in the past, holder name required.
 *   - GUEST WALL: a payment method always belongs to an account — the API
 *     401s without a session, so the sign-in state renders first.
 */

type Brand = 'Visa' | 'Mastercard' | 'Amex'

/** Luhn checksum — used to validate the card reference before deriving last4. */
function luhnValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** MM/YY that parses and is not in the past. */
function expiryValid(v: string): boolean {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v)
  if (!m) return false
  const month = parseInt(m[1], 10)
  const year = 2000 + parseInt(m[2], 10)
  const now = new Date()
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)
  return endOfMonth >= now
}

export function AddCardPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const isAuthed = useAuthStore((s) => s.isAuthenticated)

  // The card REFERENCE fields — last 4 only, exactly what the server stores.
  const [last4, setLast4] = useState('')
  const [fullNumber, setFullNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [brand, setBrand] = useState<Brand>('Visa')
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit')
  const [isDefault, setIsDefault] = useState(true)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // ─── t214 GUEST WALL — a payment method always belongs to an account ───
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-background text-slate-900 dark:text-neutral-100">
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-base font-black tracking-tight text-primary">Add Payment Card</span>
          <div className="w-8" />
        </header>
        <main className="max-w-lg mx-auto px-4 py-16 md:py-24 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 dark:bg-card flex items-center justify-center mb-4">
            <LogIn className="h-9 w-9 text-slate-400 dark:text-neutral-500" />
          </div>
          <h2 className="text-base font-black">Sign in to add a card</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 mb-6 max-w-xs mx-auto">
            Saved card references belong to your Zylod account — sign in or create one to continue.
          </p>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            <Button
              onClick={() => navigate('login')}
              className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm"
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate('register-buyer')}
              variant="outline"
              className="w-full h-11 rounded-2xl font-bold text-sm"
            >
              Create Account
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = fullNumber.replace(/\s+/g, '')

    // REAL validation — the Luhn checksum runs on the device and the full
    // number is discarded; only the last 4 travel to the server.
    if (!luhnValid(digits)) {
      setErrorMsg('That card number fails the Luhn checksum — check the digits and try again. (The full number is used only for this check and is never stored.)')
      return
    }
    const derived = digits.slice(-4)
    if (holderName.trim().length < 2) {
      setErrorMsg('Enter the cardholder legal name exactly as printed on the card.')
      return
    }
    if (!expiryValid(expiry.trim())) {
      setErrorMsg('Enter a valid future expiry in MM/YY format.')
      return
    }
    if (/^\d{4}$/.test(last4.trim()) && last4.trim() !== derived) {
      setErrorMsg(`The last-4 field (${last4.trim()}) does not match the card number entered (…${derived}).`)
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cardNumber: derived,
          holderName: holderName.trim(),
          expiry: expiry.trim(),
          cardType,
          brand,
          isDefault,
        }),
      })

      const json = await res.json().catch(() => null)
      if (res.ok && json.success) {
        setSuccessMsg('Card reference saved — brand, last 4, holder and expiry only. Zylod cannot charge this card; checkout pays by wallet balance or a verified bank/mobile transfer.')
        setTimeout(() => navigate('credit-debit-cards'), 1800)
      } else if (res.status === 401) {
        setErrorMsg('Your session expired — sign in again to save the card reference.')
      } else {
        setErrorMsg(json.error || `Failed to save the card reference (HTTP ${res.status})`)
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-neutral-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Add Payment Card</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-3xl">
        {/* Honesty banner — what this entry IS and IS NOT */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-4 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-neutral-400">
            <span className="font-black text-slate-900 dark:text-neutral-100">Card references only.</span> Zylod saves the
            brand, last 4 digits, holder and expiry — never the full number or CVV. Cards on file are for
            reconciliation display; they <span className="font-black">cannot be charged</span>. Checkout pays with your
            wallet balance (real debit) or a verified bank / mobile-banking transfer.
          </p>
        </div>

        {/* Card preview — reference styling only, no fake metal card */}
        <div className="bg-gradient-to-br from-slate-200 via-slate-100 to-rose-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-rose-950 rounded-3xl p-6 text-gray-900 dark:text-white shadow-2xl space-y-5 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black tracking-widest uppercase text-rose-600 dark:text-rose-300">ZYLOD · CARD REFERENCE</span>
            <span className="text-sm font-black italic">{brand}</span>
          </div>

          <div className="py-2">
            <span className="text-xs text-slate-500 dark:text-neutral-400 block font-mono">Card Number</span>
            <span className="text-lg font-black font-mono tracking-widest text-slate-800 dark:text-neutral-100 mt-0.5 block">
              {fullNumber ? `•••• •••• •••• ${fullNumber.replace(/\s+/g, '').slice(-4)}` : '•••• •••• •••• ••••'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-neutral-400 block mt-1">
              Only the last 4 digits are stored — the full number stays on this device.
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 block uppercase font-bold">Cardholder</span>
              <span className="font-bold text-slate-700 dark:text-neutral-200 uppercase">{holderName || 'AUTHORIZED SIGNATORY'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 block uppercase font-bold">Expires</span>
              <span className="font-bold font-mono text-slate-700 dark:text-neutral-200">{expiry || 'MM/YY'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3.5">
            <div className="grid grid-cols-3 gap-2">
              {(['Visa', 'Mastercard', 'Amex'] as Brand[]).map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                    brand === b
                      ? 'border-primary bg-rose-50 text-primary shadow-xs'
                      : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-neutral-300'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                Card Number <span className="font-normal text-slate-400 dark:text-neutral-500">(checked on-device, never stored)</span>
              </label>
              <Input
                value={fullNumber}
                onChange={(e) => setFullNumber(e.target.value.replace(/[^\d ]/g, '').slice(0, 23))}
                placeholder="4000 1234 5678 9010"
                inputMode="numeric"
                autoComplete="off"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                  Cardholder Legal Name
                </label>
                <Input
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Name printed on card"
                  autoComplete="off"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">Expiration (MM/YY)</label>
                <Input
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value.slice(0, 5))}
                  placeholder="12/28"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">Card Type</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['credit', 'debit'] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setCardType(t)}
                      className={`py-2 text-xs font-bold rounded-xl border capitalize transition-all ${
                        cardType === t
                          ? 'border-primary bg-rose-50 text-primary'
                          : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-neutral-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-neutral-100 block">Set as Primary Reference</span>
                <span className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 block">Display ordering only — not a checkout payment method</span>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} className="data-[state=checked]:bg-primary" />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              {successMsg}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {loading ? 'Saving card reference…' : 'Save Card Reference'}
          </Button>

          <p className="flex items-start gap-2 text-[10px] text-slate-400 dark:text-neutral-500 leading-relaxed">
            <Lock className="h-3 w-3 shrink-0 mt-0.5" />
            No card can be charged on Zylod. Orders are paid from your wallet balance (debited in real time) or by a
            bank / mobile transfer that a finance admin verifies against the real receipt.
          </p>
        </form>
      </main>
    </div>
  )
}

export default AddCardPage
