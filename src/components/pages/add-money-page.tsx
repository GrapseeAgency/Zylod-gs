'use client'

/**
 * Add Money — the MANUAL funding claim page (Task 118 doctrine).
 *
 * A submission here is a CLAIM, not a deposit: POST /api/wallet/topup
 * creates a walletTopups row with status 'pending' and the wallet balance
 * does NOT change until a Zylod admin verifies the payment at
 * POST /api/admin/topups/[id]/verify — the same doctrine as order payments
 * (buyer submits a reference; only a verification marks it paid/credited).
 *
 * The claim form requires the real transaction reference (TRXID) — the
 * server rejects anything that is not 6-64 chars of [A-Za-z0-9-_], and
 * rejects a reference that was already claimed (409). Sender number and a
 * note are optional. The claim ledger below renders the caller's real
 * claims (GET /api/wallet/topup) with honest status chips — nothing here
 * ever claims "added to your wallet" on submission.
 *
 * Gateway funding (bKash checkout / SSLCommerz EasyCheckout) lives on the
 * finance overview — that leg is credited only by the verified callback/IPN.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { toast } from 'sonner'
import {
  ArrowLeft, Wallet, Plus, Loader2,
  ShieldCheck, AlertCircle, CheckCircle2,
  Clock, XCircle, Landmark, ChevronRight, Info,
} from 'lucide-react'

type ClaimRow = {
  id: string
  provider: string
  reference: string
  amount: number
  currency: string
  status: string
  creditedAt: string | null
  createdAt: string
}

const METHODS: { id: 'bKash' | 'Nagad' | 'Rocket' | 'bank_transfer'; label: string; desc: string; icon: typeof Wallet }[] = [
  { id: 'bKash', label: 'bKash', desc: 'Send Money / Payment', icon: Wallet },
  { id: 'Nagad', label: 'Nagad', desc: 'Send Money', icon: Wallet },
  { id: 'Rocket', label: 'Rocket', desc: 'DBBL mobile banking', icon: Wallet },
  { id: 'bank_transfer', label: 'Bank Transfer', desc: 'BEFTN / RTGS / cash deposit', icon: Landmark },
]

const claimChip: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  credited: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800',
}

const TRXID_RE = /^[A-Za-z0-9\-_]{6,64}$/

export function AddMoneyPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [amount, setAmount] = useState('5000')
  const [selectedMethod, setSelectedMethod] = useState<'bKash' | 'Nagad' | 'Rocket' | 'bank_transfer'>('bKash')
  const [senderNumber, setSenderNumber] = useState('')
  const [trxId, setTrxId] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submittedClaim, setSubmittedClaim] = useState<{ amount: number; reference: string; topupId: string } | null>(null)

  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [claimsLoading, setClaimsLoading] = useState(true)

  const presets = ['5000', '15000', '25000', '50000', '100000', '250000']

  const trxValid = TRXID_RE.test(trxId.trim())
  const amountNumeric = parseFloat(amount)
  const amountValid = Number.isFinite(amountNumeric) && amountNumeric >= 500

  const loadClaims = useCallback(async () => {
    if (!token) {
      setClaimsLoading(false)
      return
    }
    try {
      const res = await fetch('/api/wallet/topup', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) setClaims(Array.isArray(json.data) ? json.data : [])
    } catch {
      // the ledger is secondary — a network miss leaves the form usable
    } finally {
      setClaimsLoading(false)
    }
  }, [token])

  useEffect(() => { loadClaims() }, [loadClaims])

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountValid) {
      setErrorMsg('Minimum deposit amount for the wholesale wallet is ৳500')
      return
    }
    if (!trxValid) {
      setErrorMsg('Enter the real transaction reference (TRXID) from your ' + (selectedMethod === 'bank_transfer' ? 'bank receipt' : selectedMethod) + ' — 6-64 characters. Without it the claim cannot be verified.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNumeric,
          method: selectedMethod,
          transactionReference: trxId.trim(),
          ...(senderNumber.trim() ? { senderNumber: senderNumber.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      })

      const json = await res.json().catch(() => null)
      if (res.status === 201 && json?.success) {
        const d = json.data
        setSubmittedClaim({ amount: amountNumeric, reference: d.reference, topupId: d.topupId })
        setTrxId('')
        setNote('')
        toast.success('Claim submitted — pending verification', {
          description: `Ref ${d.reference}. Your balance changes only after an admin verifies the payment.`,
        })
        loadClaims()
      } else if (res.status === 409) {
        setErrorMsg(json?.error || 'This transaction reference was already submitted.')
      } else if (res.status === 401) {
        setErrorMsg('Your session expired. Sign in again to submit the claim.')
      } else if (res.status === 429) {
        setErrorMsg(json?.error || 'Too many claims — wait a moment and retry.')
      } else {
        setErrorMsg(json?.error || `Claim failed (HTTP ${res.status}).`)
      }
    } catch {
      setErrorMsg('Network connection error — the claim was NOT recorded. Retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Deposit Capital</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-4xl">
        {/* Banner + doctrine */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-gray-900/10 border border-white/20 flex items-center justify-center">
              <Plus className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Add Funds to Wallet</h1>
              <p className="text-xs text-slate-300">
                Send money to the Zylod company account, then submit the transaction reference here.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-white dark:bg-gray-900/5 border border-white/10 rounded-2xl p-3">
            <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-200">
              <span className="font-black text-white">Verification doctrine:</span> your claim stays
              <span className="font-black text-amber-300"> PENDING</span> and your balance does
              <span className="font-black text-white"> NOT</span> change until a Zylod finance admin
              confirms the money arrived — the same rule as order payments. Fake or duplicate
              references are rejected and audit-logged.
            </p>
          </div>
        </div>

        {/* Post-submit doctrine panel */}
        {submittedClaim && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border-2 border-amber-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-amber-500" />
              <h2 className="text-sm font-black text-amber-700 uppercase tracking-wide">Payment verification pending</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
              Your claim for <span className="font-black text-slate-900 dark:text-slate-100">{formatPrice(submittedClaim.amount)}</span> (ref{' '}
              <span className="font-mono font-bold">{submittedClaim.reference}</span>) is recorded and queued for the
              finance team. Your wallet balance is <span className="font-black">unchanged</span> until an admin verifies the
              payment. You will be notified the moment it is decided.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('my-wallet')} className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> View wallet
              </Button>
              <Button onClick={() => setSubmittedClaim(null)} variant="outline" className="h-9 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800">
                Submit another claim
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleClaim} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Amount Input */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">
              Enter Deposit Amount (BDT)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono">
                ৳
              </span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setErrorMsg('')
                }}
                className="h-14 pl-10 pr-4 text-2xl font-black rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100 focus:border-primary"
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
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  +৳{parseInt(p).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method + claim details */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">
              How did you pay?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {METHODS.map(({ id, label, desc, icon: Icon }) => {
                const isSelected = selectedMethod === id
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setSelectedMethod(id)}
                    className={`p-3.5 rounded-2xl border text-left space-y-1 transition-all ${
                      isSelected
                        ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`flex items-center gap-1.5 text-xs font-bold block ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block">{desc}</span>
                  </button>
                )
              })}
            </div>

            <div className="pt-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Transaction reference (TRXID) <span className="text-red-500">*</span>
              </label>
              <Input
                value={trxId}
                onChange={(e) => { setTrxId(e.target.value); setErrorMsg('') }}
                placeholder={selectedMethod === 'bank_transfer' ? 'e.g. BEFTN2451XXXXX' : 'e.g. 9GX7K2LM4P'}
                className={`h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-mono font-bold ${trxId && !trxValid ? 'border-red-300 focus:border-red-400' : ''}`}
                maxLength={64}
                required
              />
              <p className={`text-[10px] mt-1 flex items-center gap-1 ${trxId && !trxValid ? 'text-red-500 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                {trxId && !trxValid ? (
                  <><AlertCircle className="h-3 w-3" /> 6-64 characters — letters, numbers, dash, underscore</>
                ) : (
                  <><Info className="h-3 w-3" /> Copy it exactly from your {selectedMethod === 'bank_transfer' ? 'bank receipt' : `${selectedMethod} confirmation SMS`}</>
                )}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {selectedMethod === 'bank_transfer' ? 'Bank account / deposit slip number (optional)' : `${selectedMethod} number you paid from (optional)`}
              </label>
              <Input
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="01XXXXXXXXX or Bank Ref"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-mono font-bold"
                maxLength={20}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Note for the finance team (optional)</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. paid at Uttara branch counter 2"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
                maxLength={300}
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

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || !trxValid || !amountValid}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? 'Recording claim…' : `Submit ${formatPrice(amountNumeric || 0)} claim for verification`}
          </Button>
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 -mt-2">
            Submitting does not move money. Verification does.
          </p>
        </form>

        {/* Claim ledger */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Your funding claims</h2>
            <button onClick={loadClaims} className="text-xs font-bold text-primary hover:underline">Refresh</button>
          </div>
          {claimsLoading ? (
            <div className="px-5 pb-5 space-y-2">
              {[0, 1].map((i) => <div key={i} className="h-12 bg-slate-50 dark:bg-slate-950 rounded-xl animate-pulse" />)}
            </div>
          ) : claims.length === 0 ? (
            <div className="px-5 pb-6 py-4 text-center text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
              No funding claims yet. Submit your first claim above — it will appear here with its live status.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {claims.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100">{formatPrice(c.amount)}</span>
                      <span className={`text-[9px] font-black border rounded-lg px-1.5 py-0.5 uppercase tracking-wide ${claimChip[c.status] ?? claimChip.cancelled}`}>
                        {c.status === 'credited' ? <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" /> :
                         c.status === 'pending' ? <Clock className="h-2.5 w-2.5 inline mr-0.5" /> :
                         <XCircle className="h-2.5 w-2.5 inline mr-0.5" />}
                        {c.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block font-mono truncate">
                      {c.provider} · {c.reference} · {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AddMoneyPage
