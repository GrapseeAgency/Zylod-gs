'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, Wallet, CreditCard, Receipt, Clock, ArrowRight, ArrowDownToLine,
  ArrowUpFromLine, Plus, Trash2, Smartphone, Banknote, Landmark, Loader2,
  ShieldCheck, CheckCircle2, Copy, Info,
} from 'lucide-react'

interface FinanceData {
  balance: number
  totalEarned: number
  totalUsed: number
  currency: string
  history: Array<{ id: string; date: string; description: string; amount: number; type: string; balance: number }>
}

interface PaymentMethod {
  id: string
  type: string
  label: string
  accountNumber: string
  holderName: string | null
  expiry: string | null
  cardNetwork: string | null
  isDefault: boolean
}

type FinanceTab = 'overview' | 'topup' | 'withdraw' | 'methods' | 'history'

// Bangladeshi mobile financial services + cards the user supports
const WALLET_METHODS = [
  { type: 'bKash', label: 'bKash', color: '#E2136E', hint: 'Send Money via bKash' },
  { type: 'Nagad', label: 'Nagad', color: '#F6921E', hint: 'Send Money via Nagad' },
  { type: 'Upay', label: 'Upay', color: '#7B2FBE', hint: 'Send Money via Upay' },
  { type: 'Rocket', label: 'Rocket', color: '#8C3494', hint: 'Send Money via Rocket' },
]

const CARD_NETWORKS = ['Visa', 'Mastercard', 'Amex'] as const

function methodMeta(type: string) {
  const wallet = WALLET_METHODS.find(w => w.type === type)
  if (wallet) return wallet
  return { type, label: type === 'debit' ? 'Debit Card' : 'Credit Card', color: '#1a1f36', hint: '' }
}

export function GenericFinancePage({ pageId }: { pageId: string }) {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { token } = useAuthStore()
  const { toast } = useToast()

  const [tab, setTab] = useState<FinanceTab>('overview')
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(false)

  const authHeaders = useCallback((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // Map the routed pageId to the relevant tab (single-page wallet experience)
  useEffect(() => {
    if (pageId === 'add-money' || pageId === 'refund-to-wallet' || pageId === 'top-up') setTab('topup')
    else if (pageId === 'withdraw-money') setTab('withdraw')
    else if (pageId === 'bank-accounts' || pageId === 'credit-debit-cards' || pageId === 'add-card' || pageId === 'add-bank-account' || pageId === 'upi-payment-setup') setTab('methods')
    else if (pageId === 'transaction-history' || pageId === 'transaction-detail' || pageId === 'payment-history' || pageId === 'payment-pending' || pageId === 'payment-failed') setTab('history')
    else setTab('overview')
  }, [pageId])

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/credits', { headers: authHeaders() })
      const json = await res.json()
      if (json.success && json.data) setData(json.data)
    } catch { /* keep last known state */ }
    finally { setLoading(false) }
  }, [authHeaders])

  const loadMethods = useCallback(async () => {
    setMethodsLoading(true)
    try {
      const res = await fetch('/api/payment-methods', { headers: authHeaders() })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) setMethods(json.data)
    } catch { /* ignore */ }
    finally { setMethodsLoading(false) }
  }, [authHeaders])

  useEffect(() => { loadBalance() }, [loadBalance])
  useEffect(() => { loadMethods() }, [loadMethods])

  const title = pageId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Banner */}
      <div className="relative overflow-hidden py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
        <div className="max-w-7xl mx-auto relative z-10">
          <button
            onClick={() => navigate('buyer-dashboard')}
            className="flex items-center gap-1.5 text-white/80 hover:text-white mb-3 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          </div>
          <p className="text-white/80 text-sm sm:text-base">
            Pay and get paid with bKash, Nagad, Upay, Rocket, or your card.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Balance strip */}
        {loading ? (
          <Skeleton className="h-24 rounded-xl mb-6" />
        ) : (
          <Card className="border-border/50 bg-card mb-6">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10 text-primary"><Wallet className="h-6 w-6" /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Available Balance</p>
                  <h3 className="text-3xl font-bold text-primary">{formatPrice(data?.balance || 0)}</h3>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setTab('topup')}><ArrowDownToLine className="mr-1.5 h-4 w-4" /> Add Money</Button>
                <Button variant="outline" onClick={() => setTab('withdraw')}><ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            ['overview', 'Overview'],
            ['topup', 'Add Money'],
            ['withdraw', 'Withdraw'],
            ['methods', 'Payment Methods'],
            ['history', 'History'],
          ] as [FinanceTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <Overview data={data} loading={loading} formatPrice={formatPrice} navigate={navigate} />}
        {tab === 'topup' && <TopUpPanel token={token} formatPrice={formatPrice} onDone={loadBalance} />}
        {tab === 'withdraw' && <WithdrawPanel token={token} formatPrice={formatPrice} onDone={loadBalance} />}
        {tab === 'methods' && <MethodsPanel methods={methods} loading={methodsLoading} token={token} onChanged={loadMethods} formatPrice={formatPrice} />}
        {tab === 'history' && <HistoryPanel data={data} loading={loading} formatPrice={formatPrice} />}
      </div>
    </div>
  )
}

// ============ OVERVIEW ============
function Overview({ data, loading, formatPrice, navigate }: {
  data: FinanceData | null; loading: boolean; formatPrice: (n: number) => string
  navigate: (page: string) => void
}) {
  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="border-border/50 bg-card">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Credits Earned</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatPrice(data?.totalEarned || 0)}</h3>
          </div>
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CreditCard className="h-6 w-6" /></div>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Spent / Debited</p>
            <h3 className="text-2xl font-bold text-foreground mt-1">{formatPrice(data?.totalUsed || 0)}</h3>
          </div>
          <div className="p-3 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400"><Receipt className="h-6 w-6" /></div>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-card">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Order Invoices</p>
            <h3 className="text-2xl font-bold text-foreground mt-1">{data?.history?.length || 0}</h3>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary"><Clock className="h-6 w-6" /></div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============ TOP UP ============
function TopUpPanel({ token, formatPrice, onDone }: { token: string | null; formatPrice: (n: number) => string; onDone: () => void }) {
  const { toast } = useToast()
  const [method, setMethod] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Gateway result banner — callback redirects back with ?topup=success|failed|cancelled
  const [banner, setBanner] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('topup')
    if (result === 'success') setBanner('success')
    else if (result === 'failed') setBanner('failed')
    else if (result === 'cancelled') setBanner('cancelled')
    if (result) {
      params.delete('topup'); params.delete('reason')
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // bKash goes direct; the rest + cards go through the SSLCommerz checkout
  const TOPUP_METHODS = [
    ...WALLET_METHODS,
    { type: 'card', label: 'Card', color: '#1a1f36', hint: 'Visa / Mastercard / Amex' },
  ]

  const submit = async () => {
    if (!method) return
    if (!amount || Number(amount) < 10) { toast({ title: 'Enter an amount of at least ৳10', variant: 'destructive' }); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/topup/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ amount: Number(amount), method }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not start payment')
      // Redirect to the real gateway (bKash checkout / SSLCommerz EasyCheckout).
      // The wallet is credited only after server-side verification on return.
      window.location.href = json.data.redirectUrl
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Could not start payment', variant: 'destructive' })
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {banner && (
        <Card className={`border ${banner === 'success' ? 'border-emerald-300 bg-emerald-50' : banner === 'cancelled' ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50'}`}>
          <CardContent className="p-4 flex items-center gap-3">
            {banner === 'success'
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              : <ShieldCheck className={`h-5 w-5 shrink-0 ${banner === 'cancelled' ? 'text-amber-600' : 'text-red-600'}`} />}
            <p className="text-sm font-medium">
              {banner === 'success' && 'Top-up verified and credited to your wallet.'}
              {banner === 'cancelled' && 'Payment was cancelled. Nothing was charged.'}
              {banner === 'failed' && 'Payment could not be verified. If money left your account, contact support with your TrxID.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-semibold">Choose payment method</p>
            <div className="grid grid-cols-2 gap-3">
              {TOPUP_METHODS.map(w => (
                <button
                  key={w.type}
                  onClick={() => setMethod(w.type)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${method === w.type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-6 w-6 rounded-full" style={{ background: w.color }} />
                    <span className="font-semibold text-sm">{w.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{w.hint}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardContent className="p-5 space-y-4">
            {!method ? (
              <div className="text-center py-10 text-sm text-muted-foreground space-y-2">
                <Smartphone className="h-8 w-8 mx-auto opacity-50" />
                <p>Select a payment method to continue</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full" style={{ background: methodMeta(method).color }} />
                  <p className="font-semibold text-sm">Pay with {methodMeta(method).label}</p>
                </div>
                <div className="space-y-2">
                  <Label>Amount (৳)</Label>
                  <Input type="number" min="10" placeholder="e.g. 500" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  You&apos;ll be redirected to the secure {method === 'bKash' ? 'bKash' : 'gateway'} checkout. Your wallet is credited only after the payment is verified server-side.
                </p>
                <Button className="w-full" disabled={submitting} onClick={submit}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Continue to Payment
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============ WITHDRAW ============
function WithdrawPanel({ token, formatPrice, onDone }: { token: string | null; formatPrice: (n: number) => string; onDone: () => void }) {
  const { toast } = useToast()
  const [method, setMethod] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!method) return
    if (!amount || Number(amount) < 50) { toast({ title: 'Minimum withdrawal is ৳50', variant: 'destructive' }); return }
    if (accountNumber.trim().length < 6) { toast({ title: 'Enter a valid account number', variant: 'destructive' }); return }
    if (holderName.trim().length < 2) { toast({ title: 'Enter the account holder name', variant: 'destructive' }); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ amount: Number(amount), method, accountNumber: accountNumber.trim(), holderName: holderName.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Withdrawal failed')
      toast({ title: 'Withdrawal requested', description: `${formatPrice(Number(amount))} is being processed.` })
      setMethod(null); setAmount(''); setAccountNumber(''); setHolderName('')
      onDone()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Withdrawal failed', variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const withdrawTargets = [...WALLET_METHODS, { type: 'bank', label: 'Bank Transfer', color: '#0f766e', hint: 'Direct bank deposit' }]

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-border/50 bg-card">
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold">Withdraw to</p>
          <div className="grid grid-cols-2 gap-3">
            {withdrawTargets.map(w => (
              <button
                key={w.type}
                onClick={() => setMethod(w.type)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${method === w.type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-6 w-6 rounded-full" style={{ background: w.color }} />
                  <span className="font-semibold text-sm">{w.label}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{w.hint}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardContent className="p-5 space-y-4">
          {!method ? (
            <div className="text-center py-10 text-sm text-muted-foreground space-y-2">
              <Landmark className="h-8 w-8 mx-auto opacity-50" />
              <p>Select where to withdraw your funds</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full" style={{ background: methodMeta(method).color }} />
                <p className="font-semibold text-sm">Withdraw to {methodMeta(method).label}</p>
              </div>
              <div className="space-y-2">
                <Label>Amount (৳)</Label>
                <Input type="number" min="50" placeholder="e.g. 1000" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{method === 'bank' ? 'Bank Account Number' : 'Account / Mobile Number'}</Label>
                <Input placeholder={method === 'bank' ? 'Bank account number' : '01XXXXXXXXX'} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account Holder Name</Label>
                <Input placeholder="Full name" value={holderName} onChange={e => setHolderName(e.target.value)} />
              </div>
              <Button className="w-full" disabled={submitting} onClick={submit}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />} Request Withdrawal
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============ PAYMENT METHODS ============
function MethodsPanel({ methods, loading, token, onChanged, formatPrice }: {
  methods: PaymentMethod[]; loading: boolean; token: string | null
  onChanged: () => void; formatPrice: (n: number) => string
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'wallet' | 'card'>('wallet')
  const [form, setForm] = useState({ type: 'bKash', label: '', accountNumber: '', holderName: '', expiry: '', cardNetwork: 'Visa' })
  const [saving, setSaving] = useState(false)

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/payment-methods/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Delete failed')
      toast({ title: 'Payment method removed' })
      onChanged()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Delete failed', variant: 'destructive' })
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = mode === 'wallet'
        ? { type: form.type, label: form.label || form.type, accountNumber: form.accountNumber }
        : { type: 'debit', label: form.label || `${form.cardNetwork} Debit`, accountNumber: form.accountNumber, holderName: form.holderName, expiry: form.expiry, cardNetwork: form.cardNetwork }
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed')
      toast({ title: 'Payment method saved' })
      setOpen(false)
      setForm({ type: 'bKash', label: '', accountNumber: '', holderName: '', expiry: '', cardNetwork: 'Visa' })
      onChanged()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Save failed', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Saved payment methods</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Add Method</Button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : methods.length === 0 ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-10 text-center text-sm text-muted-foreground space-y-2">
            <CreditCard className="h-8 w-8 mx-auto opacity-50" />
            <p className="font-medium">No payment methods yet</p>
            <p className="text-xs">Add bKash, Nagad, Upay, Rocket, or a debit/credit card.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add your first method</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {methods.map(m => {
            const meta = methodMeta(m.type)
            const isWallet = ['bKash', 'Nagad', 'Upay', 'Rocket'].includes(m.type)
            return (
              <Card key={m.id} className="border-border/50 bg-card">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}22`, color: meta.color }}>
                    {isWallet ? <Smartphone className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{m.label || meta.label}</p>
                      {m.isDefault && <Badge className="text-[10px]">Default</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {isWallet ? m.accountNumber : `${m.cardNetwork ? m.cardNetwork + ' ' : ''}•••• ${m.accountNumber}${m.expiry ? ` · ${m.expiry}` : ''}`}
                    </p>
                  </div>
                  <button onClick={() => remove(m.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
            <DialogDescription>Pay with a mobile wallet or a card (Stripe-style, securely tokenized).</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button size="sm" variant={mode === 'wallet' ? 'default' : 'outline'} onClick={() => setMode('wallet')}><Smartphone className="mr-1.5 h-4 w-4" /> Mobile Wallet</Button>
            <Button size="sm" variant={mode === 'card' ? 'default' : 'outline'} onClick={() => setMode('card')}><CreditCard className="mr-1.5 h-4 w-4" /> Card</Button>
          </div>

          {mode === 'wallet' ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Wallet</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WALLET_METHODS.map(w => (
                    <button key={w.type} onClick={() => setForm(f => ({ ...f, type: w.type }))} className={`p-2 rounded-lg border text-sm font-medium flex items-center gap-2 ${form.type === w.type ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <span className="h-4 w-4 rounded-full" style={{ background: w.color }} />{w.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input placeholder="01XXXXXXXXX" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Label (optional)</Label>
                <Input placeholder={`e.g. My ${form.type}`} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Card Network</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CARD_NETWORKS.map(n => (
                    <button key={n} onClick={() => setForm(f => ({ ...f, cardNetwork: n }))} className={`p-2 rounded-lg border text-sm font-medium ${form.cardNetwork === n ? 'border-primary bg-primary/5' : 'border-border'}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Card Number (last 4 digits)</Label>
                <Input placeholder="4242" maxLength={4} value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Only the last 4 digits are stored — the full number never leaves your device.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Expiry</Label>
                  <Input placeholder="MM/YY" maxLength={5} value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cardholder</Label>
                  <Input placeholder="Full name" value={form.holderName} onChange={e => setForm(f => ({ ...f, holderName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Label (optional)</Label>
                <Input placeholder={`e.g. ${form.cardNetwork} Debit`} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Method</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ HISTORY ============
function HistoryPanel({ data, loading, formatPrice }: {
  data: FinanceData | null; loading: boolean; formatPrice: (n: number) => string
}) {
  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
  if (!data?.history || data.history.length === 0) {
    return (
      <Card className="border-border/50 bg-card">
        <CardContent className="p-10 text-center text-sm text-muted-foreground space-y-2">
          <Clock className="h-8 w-8 mx-auto opacity-50" />
          <p className="font-medium">No financial activity recorded yet.</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="divide-y divide-border/40 p-2">
        {data.history.map(item => (
          <div key={item.id} className="py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{item.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.date}</p>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${item.amount >= 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                {item.amount >= 0 ? `+${formatPrice(item.amount)}` : formatPrice(item.amount)}
              </span>
              <p className="text-[10px] text-muted-foreground">Balance: {formatPrice(item.balance)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default GenericFinancePage