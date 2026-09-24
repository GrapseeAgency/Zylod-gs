'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ShieldCheck, Search, RefreshCw, AlertTriangle, XCircle, CheckCircle2,
  CreditCard, ChevronDown, ChevronUp, Clock, FileText
} from 'lucide-react'

// ── Real API types ─────────────────────────────────────────────────────
interface ApiPayment { id: string; method: string; amount: number; status: string; transactionId: string | null; paidAt: string | null }
interface AdminOrder {
  id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  status: string
  placedAt: string
  buyer: { id: string; email: string | null; name: string | null; userType: string } | null
  payments: ApiPayment[]
  subOrderCount: number
}

export function AdminPaymentsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [tab, setTab] = useState<'unpaid' | 'paid'>('unpaid')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [form, setForm] = useState({ transactionId: '', method: 'bank_transfer', amount: '', note: '' })
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadOrders = useCallback(async (opts?: { tab?: 'unpaid' | 'paid'; q?: string; page?: number }) => {
    const useTab = opts?.tab ?? tab
    const useQ = opts?.q ?? q
    const usePage = opts?.page ?? page
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const params = new URLSearchParams({ paymentStatus: useTab, page: String(usePage), limit: '20' })
      if (useQ) params.set('q', useQ)
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setNeedsAuth(true); setOrders([]); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load orders (HTTP ${res.status})`)
        setOrders([])
        return
      }
      setOrders(Array.isArray(json.data.orders) ? json.data.orders : [])
      setTotalPages(json.data.pagination?.totalPages || 0)
      setTotal(json.data.pagination?.total || 0)
    } catch {
      setError('Network error while loading the queue. Check your connection and retry.')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [tab, q, page])

  useEffect(() => { loadOrders() }, [loadOrders])

  const switchTab = (t: 'unpaid' | 'paid') => {
    setTab(t)
    setPage(1)
    setExpandedId(null)
    loadOrders({ tab: t, page: 1 })
  }

  const openVerify = (o: AdminOrder) => {
    setExpandedId(expandedId === o.id ? null : o.id)
    setFormError('')
    setSuccessMsg('')
    // Amount prefilled from the SERVER's order total — the API re-validates it anyway.
    setForm({ transactionId: '', method: 'bank_transfer', amount: String(o.totalAmount), note: '' })
  }

  const submitVerify = async (o: AdminOrder) => {
    setVerifyingId(o.id)
    setFormError('')
    setSuccessMsg('')
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(o.id)}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transactionId: form.transactionId.trim(),
          method: form.method,
          amount: Number(form.amount),
          note: form.note.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setFormError(json?.error || `Verification failed (HTTP ${res.status})`)
        return
      }
      // Real success — the order is now genuinely marked paid server-side.
      setSuccessMsg(json?.data?.message || `Payment verified for order #${o.orderNumber}`)
      setExpandedId(null)
      loadOrders()
    } catch {
      setFormError('Network error while submitting verification. Check your connection and retry.')
    } finally {
      setVerifyingId(null)
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">This queue is restricted to Zylod admins. Sign in with an admin account to verify payments.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Payment Verification</h1>
            <p className="text-[11px] text-slate-400">Record bank / mobile transfers ONLY after confirming money arrived in the company account. Every action is audit-logged.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadOrders()} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => switchTab('unpaid')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition ${tab === 'unpaid' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Awaiting verification
        </button>
        <button
          onClick={() => switchTab('paid')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition ${tab === 'paid' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Verified / paid
        </button>
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadOrders({ q, page: 1 }) } }}
            placeholder="Search order # or buyer email…"
            className="h-9 pl-9 rounded-xl text-xs"
          />
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-2xl px-4 py-3 text-xs font-bold">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadOrders()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {tab === 'unpaid' ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-sm font-black">No orders awaiting verification</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {q ? `No ${tab} orders match "${q}".` : 'There are no UNPAID orders right now. New orders appear here the moment buyers place them — payments become "paid" only after your verification or a valid webhook.'}
              </p>
            </>
          ) : (
            <>
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No verified payments yet</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {q ? `No ${tab} orders match "${q}".` : 'Orders you (or the payment webhook) mark as paid will be listed here for audit.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const isExpanded = expandedId === o.id
            return (
              <div key={o.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[150px]">
                    {tab === 'unpaid'
                      ? <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      : <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                    <span className="text-xs font-black">#{o.orderNumber}</span>
                  </div>
                  <div className="min-w-[160px] text-xs text-slate-500 dark:text-slate-400">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{o.buyer?.name || '--'}</p>
                    <p className="truncate">{o.buyer?.email || 'no email on account'}</p>
                  </div>
                  <div className="text-right min-w-[110px] ml-auto">
                    <p className="text-sm font-black text-primary">{formatPrice(o.totalAmount)}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400">{o.paymentStatus} · {o.status}</p>
                  </div>
                  <div className="text-[10px] text-slate-400 min-w-[90px]">
                    {new Date(o.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="block">{o.subOrderCount} shipment{o.subOrderCount === 1 ? '' : 's'}</span>
                  </div>
                  {tab === 'unpaid' && (
                    <Button onClick={() => openVerify(o)} className="h-9 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5">
                      {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Close</> : <><CreditCard className="h-3.5 w-3.5" /> Verify payment</>}
                    </Button>
                  )}
                </div>

                {/* Existing real payment rows */}
                {o.payments.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {o.payments.map((p) => (
                      <span key={p.id} className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                        {p.method || '--'} · {formatPrice(p.amount)} · {p.status}{p.transactionId ? ` · ${p.transactionId}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Verify form */}
                {tab === 'unpaid' && isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Confirm the buyer&apos;s transfer actually arrived (correct amount, matching reference) in the company bank / wallet BEFORE recording. The recorded amount must equal the order total {formatPrice(o.totalAmount)} — the server rejects mismatches, and duplicate transaction IDs are rejected.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Transaction / reference ID *</label>
                        <Input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} placeholder="e.g. the bank reference number" className="h-10 rounded-xl text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Method *</label>
                        <select
                          value={form.method}
                          onChange={(e) => setForm({ ...form, method: e.target.value })}
                          className="h-10 w-full rounded-xl border border-input bg-white dark:bg-slate-900 px-3 text-xs font-bold"
                        >
                          <option value="bank_transfer">Bank transfer</option>
                          <option value="mobile_banking">Mobile banking (bKash / Nagad)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Amount received *</label>
                        <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-10 rounded-xl text-xs font-bold" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Note (optional)</label>
                        <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. verified against bank statement 12/05" className="h-10 rounded-xl text-xs" />
                      </div>
                    </div>

                    {formError && (
                      <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                        <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {formError}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button variant="outline" onClick={() => setExpandedId(null)} className="h-10 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700">Cancel</Button>
                      <Button
                        onClick={() => submitVerify(o)}
                        disabled={verifyingId === o.id || !form.transactionId.trim() || !form.amount}
                        className="h-10 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {verifyingId === o.id ? 'Recording…' : 'Confirm money received & mark paid'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">{total} order{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadOrders({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadOrders({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminPaymentsPage
