'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, ArrowUpRight,
  CheckCircle2, AlertCircle, Loader2,
  Lock, Clock, Ban,
} from 'lucide-react'

interface PayoutRow {
  id: string
  amount: number
  method: string
  status: string
  destination: string | null
  reference: string | null
  processedAt: string | null
  createdAt: string
}

interface WithdrawData {
  balance: number
  onHold: number
  available: number
  payouts: PayoutRow[]
}

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending verification', cls: 'bg-amber-500/10 text-amber-600', icon: Clock },
  processing: { label: 'Processing', cls: 'bg-amber-500/10 text-amber-600', icon: Clock },
  completed: { label: 'Settled', cls: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  failed: { label: 'Rejected', cls: 'bg-rose-500/10 text-rose-600', icon: Ban },
}

export function WithdrawMoneyPage() {
  const { goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const sessionUser = useAuthStore((s) => s.user)
  const { formatPrice } = useCurrencyStore()

  // Task 119: the rail is USER-TYPE AWARE — buyers withdraw from their
  // sourcing fund (/api/buyer/withdrawals, the Task 119 buyer rail with the
  // same hold/verify doctrine), sellers settle earnings (/api/wallet/withdraw,
  // Task 107). One honest page, two real rails — no dead ends.
  const isBuyer = sessionUser?.userType === 'buyer'
  const railPath = isBuyer ? '/api/buyer/withdrawals' : '/api/wallet/withdraw'

  const [data, setData] = useState<WithdrawData | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'bank' | 'bKash' | 'Nagad' | 'Rocket'>('bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [bankName, setBankName] = useState('City Bank PLC')

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(railPath, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) setData(json.data)
      else if (res.status === 401) setErrorMsg('Your session expired — sign in again to view your withdrawals.')
      else if (json?.error) setErrorMsg(json.error)
    } finally {
      setInitialLoading(false)
    }
  }, [token, railPath])

  useEffect(() => { load() }, [load])

  const availableBalance = data?.available ?? 0

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseFloat(amount)

    if (isNaN(numeric) || numeric < 50) {
      setErrorMsg('Minimum withdrawal threshold is ৳50')
      return
    }
    if (numeric > availableBalance) {
      setErrorMsg('Withdrawal amount exceeds the available balance (balance minus requests already pending verification)')
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
      const res = await fetch(railPath, {
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
        setSuccessMsg(json.message || `Withdrawal request for ৳${numeric.toLocaleString()} submitted — an admin verifies it before any money leaves.`)
        setAmount('')
        load()
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
    <div className="min-h-screen bg-background text-slate-900 dark:text-neutral-100 pb-24 md:pb-10">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">{isBuyer ? 'Withdraw Funds' : 'Request Payout'}</span>
        <div className="w-8" />
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-neutral-100">{isBuyer ? 'Withdraw Funds' : 'Request Payout'}</h1>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Balance box — honest three-way split under the payout doctrine */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-neutral-900 dark:to-rose-950 rounded-3xl p-5 text-gray-900 dark:text-white shadow-xl space-y-2">
          <span className="text-xs text-slate-600 dark:text-neutral-300">Available for withdrawal</span>
          <div className="text-2xl font-black font-mono">
            {initialLoading ? '…' : formatPrice(availableBalance)}
          </div>
          <div className="flex gap-4 pt-1 text-[11px] text-slate-600 dark:text-neutral-300 font-mono">
            <span>Wallet {formatPrice(data?.balance ?? 0)}</span>
            <span>· On hold {formatPrice(data?.onHold ?? 0)}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 pt-1 flex items-start gap-1.5">
            <Lock className="h-3 w-3 shrink-0 mt-0.5" />
            <span>Every request is held until an admin verifies the settlement — the same rule that protects buyer payments. Rejected requests release the hold instantly.</span>
          </p>
        </div>

        <form onSubmit={handleWithdraw} className="space-y-4">
          {/* Amount */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
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
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-mono">
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
                className="h-14 pl-10 pr-4 text-2xl font-black rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 font-mono text-slate-900 dark:text-neutral-100 focus:border-primary"
              />
            </div>
          </div>

          {/* Method Select */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400 block">
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
                    onClick={() => setMethod(id as 'bank' | 'bKash' | 'Nagad' | 'Rocket')}
                    className={`p-3.5 rounded-2xl border text-left space-y-1 transition-all ${
                      isSelected
                        ? 'border-primary bg-rose-50/60 dark:bg-rose-950/40 ring-2 ring-primary/20 shadow-xs'
                        : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-card'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-neutral-100'}`}>{label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 block">{desc}</span>
                  </button>
                )
              })}
            </div>

            {/* Account Details */}
            <div className="space-y-3 pt-2">
              {method === 'bank' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">Bank Name</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-11 rounded-2xl bg-slate-50 dark:bg-background border border-slate-200 dark:border-neutral-800 text-xs font-semibold px-3.5 text-slate-900 dark:text-neutral-100 focus:outline-none focus:border-primary"
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
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                  {method === 'bank' ? 'Account Number' : `${method} Wallet Number`}
                </label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={method === 'bank' ? '13-16 digit account number' : '01XXXXXXXXX'}
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                  Beneficiary / Corporate Account Title
                </label>
                <Input
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Exact legal name on account"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-300 flex items-center gap-2">
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
            {loading ? 'Submitting Request...' : `Request ৳${parseFloat(amount || '0').toLocaleString()} payout`}
          </Button>
        </form>

        {/* Payout requests — the queue the admin actually works from */}
        <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{isBuyer ? 'Your withdrawal requests' : 'Your payout requests'}</h2>
            <span className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-mono">{data?.payouts.length ?? 0}</span>
          </div>
          {initialLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2].map((i) => <div key={i} className="h-12 bg-slate-100 dark:bg-card rounded-2xl" />)}
            </div>
          ) : !data || data.payouts.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-neutral-500 dark:text-neutral-400 py-3 text-center">
              {isBuyer ? 'No withdrawal requests yet — the money in your wallet is all available.' : 'No payout requests yet — the money in your wallet is all available.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {data.payouts.map((p) => {
                const st = STATUS_STYLES[p.status] ?? STATUS_STYLES.pending
                const Icon = st.icon
                return (
                  <div key={p.id} className="rounded-2xl border border-slate-100 dark:border-neutral-800 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black font-mono">{formatPrice(p.amount)}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${st.cls}`}>
                        <Icon className="h-3 w-3" /> {st.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-mono break-all">
                      {p.destination ?? p.method}
                      {p.reference ? ` · ref ${p.reference}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-neutral-300">
                      {new Date(p.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {p.status === 'pending' || p.status === 'processing' ? ' · amount held until verified' : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default WithdrawMoneyPage
