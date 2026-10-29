'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, CreditCard, Smartphone, Building2,
  Save, ShieldCheck, Loader2,
} from 'lucide-react'

/**
 * REAL add-payment-method (audit unit 22). The old page faked the save with
 * a setTimeout "success" — the card/wallet/bank went NOWHERE. All three real
 * rails exist and are wired here now, each with the server's honest verdict:
 *   - Wallets  → POST /api/payment-methods/mobile-banking (provider + number)
 *   - Cards    → POST /api/payment-methods (TOKENIZED: last 4 digits only —
 *                the API refuses full PANs, so this form never collects one;
 *                the old full-number+CVV inputs were a security smell with
 *                nowhere to send them)
 *   - Bank     → POST /api/bank-accounts (bank/routing/holder, audited via
 *                the financial-audit trail)
 * Unauthenticated visitors get the honest sign-in gate — a payment method
 * always belongs to an account.
 */

type TabType = 'card' | 'mfs' | 'bank'

export function AddPaymentMethodPage() {
  const { navigate, goBack } = useNavigationStore()
  const { isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('mfs')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auth honesty: a payment method always belongs to an account — render the
  // sign-in gate for guests instead of a form whose POST could only 401.
  const [authChecking, setAuthChecking] = useState(true)
  useEffect(() => {
    if (isAuthenticated) { setAuthChecking(false); return }
    const t = setTimeout(() => setAuthChecking(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  // Card form state (tokenized — last 4 only)
  const [cardLast4, setCardLast4] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cardNetwork, setCardNetwork] = useState<'visa' | 'mastercard' | 'amex' | 'other'>('visa')
  const [cardType, setCardType] = useState<'debit' | 'credit'>('debit')

  // MFS form state
  const [mfsProvider, setMfsProvider] = useState<'bkash' | 'nagad' | 'rocket'>('bkash')
  const [mfsNumber, setMfsNumber] = useState('')

  // Bank form state
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [branchName, setBranchName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  const handleAuthFail = () => {
    toast.error('Sign in first', { description: 'A payment method always belongs to an account.' })
    navigate('login')
  }

  const saveMfs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/payment-methods/mobile-banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: mfsProvider, accountNumber: mfsNumber.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201 || res.status === 200) {
        toast.success(`${mfsProvider === 'bkash' ? 'bKash' : mfsProvider === 'nagad' ? 'Nagad' : 'Rocket'} account linked`)
        navigate('payment-method')
        return
      }
      if (res.status === 401) return handleAuthFail()
      setError(json?.error || `The server refused (HTTP ${res.status}).`)
    } catch {
      setError('Network error — the wallet was NOT linked. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  const saveCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const last4 = cardLast4.replace(/\D/g, '')
    if (last4.length !== 4) {
      setError('Enter exactly the last 4 digits of the card.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: cardType,
          label: `${cardNetwork === 'other' ? 'Card' : cardNetwork[0].toUpperCase() + cardNetwork.slice(1)} ••${last4}`,
          accountNumber: last4,
          holderName: cardHolder.trim(),
          expiry: expiry.trim() || undefined,
          cardNetwork,
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201 || res.status === 200) {
        toast.success('Card tokenized and linked')
        navigate('payment-method')
        return
      }
      if (res.status === 401) return handleAuthFail()
      setError(json?.error || `The server refused (HTTP ${res.status}).`)
    } catch {
      setError('Network error — the card was NOT linked. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolder.trim(),
          branchName: branchName.trim() || undefined,
          routingNumber: routingNumber.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201 || res.status === 200) {
        toast.success('Bank account linked')
        navigate('payment-method')
        return
      }
      if (res.status === 401) return handleAuthFail()
      setError(json?.error || `The server refused (HTTP ${res.status}).`)
    } catch {
      setError('Network error — the account was NOT linked. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  // Gate guests — the doc contract above promises the honest sign-in gate.
  if (!authChecking && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to add a payment method"
        message="A payment method always belongs to an account. Sign in to link your wallet, card, or bank."
      />
    )
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8 text-slate-900 dark:text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-neutral-100">Add Payment Method</h1>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-6 space-y-5 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        {/* Method Switcher Tabs */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-card rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('card')}
            className={`py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'card' ? 'bg-white dark:bg-gray-900 text-primary shadow-xs' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Card
          </button>
          <button
            onClick={() => setActiveTab('mfs')}
            className={`py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'mfs' ? 'bg-white dark:bg-gray-900 text-primary shadow-xs' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            MFS (bKash)
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'bank' ? 'bg-white dark:bg-gray-900 text-primary shadow-xs' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Bank
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-800">
            {error}
          </div>
        )}

        {/* Card Form — tokenized */}
        {activeTab === 'card' && (
          <form onSubmit={saveCard} className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Debit / Credit / Corporate Card</h2>

            <div className="p-3 bg-slate-50 dark:bg-background rounded-2xl border border-slate-200 dark:border-neutral-800 text-[11px] text-slate-600 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed">
              The platform tokenizes cards: it stores ONLY the last 4 digits, network, expiry, and holder — never a
              full card number or CVV. Actual charges run through the gateways at checkout.
            </div>

            <div className="flex gap-2">
              {(['debit', 'credit'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setCardType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    cardType === t ? 'bg-rose-50 text-primary border-primary' : 'bg-slate-50 dark:bg-background text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800'
                  }`}
                >
                  {t === 'debit' ? 'Debit card' : 'Credit card'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="pm-last4" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Last 4 digits</label>
                <Input
                  id="pm-last4"
                  placeholder="9010"
                  inputMode="numeric"
                  maxLength={4}
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="pm-holder" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Cardholder name</label>
                <Input
                  id="pm-holder"
                  placeholder="e.g. John Doe / Acme Corp"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="pm-expiry" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Expiry (MM/YY)</label>
                <Input
                  id="pm-expiry"
                  placeholder="09/28"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold font-mono"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pm-network" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Network</label>
                <select
                  id="pm-network"
                  value={cardNetwork}
                  onChange={(e) => setCardNetwork(e.target.value as typeof cardNetwork)}
                  className="h-11 w-full rounded-2xl bg-slate-50 dark:bg-background border border-slate-200 dark:border-neutral-800 px-3 text-xs font-semibold text-slate-800 dark:text-neutral-200"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Linking…' : 'Tokenize & Link Card'}
            </Button>
          </form>
        )}

        {/* MFS Form */}
        {activeTab === 'mfs' && (
          <form onSubmit={saveMfs} className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Mobile Financial Services</h2>

            <div className="flex gap-2">
              {[
                { id: 'bkash', label: 'bKash' },
                { id: 'nagad', label: 'Nagad' },
                { id: 'rocket', label: 'Rocket' },
              ].map((prov) => (
                <button
                  type="button"
                  key={prov.id}
                  onClick={() => setMfsProvider(prov.id as typeof mfsProvider)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    mfsProvider === prov.id
                      ? 'bg-rose-50 text-primary border-primary'
                      : 'bg-slate-50 dark:bg-background text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800'
                  }`}
                >
                  {prov.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label htmlFor="pm-mfs-number" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Wallet number</label>
              <Input
                id="pm-mfs-number"
                placeholder="01XXXXXXXXX"
                type="tel"
                value={mfsNumber}
                onChange={(e) => setMfsNumber(e.target.value)}
                className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
                required
              />
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-1">
                The server validates the Bangladeshi mobile format — an invalid number is refused with the real reason.
              </p>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Link Wallet'}
            </Button>
          </form>
        )}

        {/* Bank Form */}
        {activeTab === 'bank' && (
          <form onSubmit={saveBank} className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Corporate Bank Account / L/C</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="pm-bank" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Bank name</label>
                <Input
                  id="pm-bank"
                  placeholder="e.g. Eastern Bank Ltd."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="pm-acc-holder" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Account title / company</label>
                <Input
                  id="pm-acc-holder"
                  placeholder="e.g. Acme Industrial Supplies Ltd."
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="pm-acc-no" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Account number</label>
                <Input
                  id="pm-acc-no"
                  placeholder="100XXXXXXXXX"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pm-routing" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Routing number</label>
                <Input
                  id="pm-routing"
                  placeholder="090270000"
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="pm-branch" className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Branch <span className="text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-normal">(optional)</span></label>
              <Input
                id="pm-branch"
                placeholder="e.g. Gulshan Corporate Branch"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Link Bank Account'}
            </Button>
          </form>
        )}

        {/* Security badge */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 border border-slate-200 dark:border-neutral-800 flex items-center gap-2.5 text-[11px] text-slate-600 dark:text-neutral-400 dark:text-neutral-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Every link above is a real database row with a financial-audit entry — the server&apos;s verdict is shown verbatim, success is never faked.</span>
        </div>
      </main>
    </div>
  )
}

export default AddPaymentMethodPage
