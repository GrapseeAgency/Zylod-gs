'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { toast } from 'sonner'
import { EvidenceThumbs } from '@/components/pages/evidence-thumbs'
import {
  RotateCcw, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Package,
  User, Wallet, Truck, ScrollText, Inbox, Banknote, PackageCheck,
} from 'lucide-react'

// ── Real API types (GET /api/admin/returns · PATCH · POST …/refund) ──
interface ApiRefund {
  id: string
  amount: number
  /** bank_transfer | mobile_banking | cash */
  method: string
  /** Real-world transaction id / UTR / TxnID from the actual transfer. */
  reference: string
  status: string
  processedById: string
  note: string | null
  createdAt: string
}

interface ApiAdminReturnItem {
  id: string
  orderItemId: string
  reason: string
  quantity: number
  comments: string | null
}

interface ApiAdminReturnOrder {
  orderNumber: string | null
  /** Derived from sub-order statuses server-side (orders has no status column). */
  status: string | null
  paymentStatus: string | null
}

interface ApiAdminReturnBuyer {
  id: string
  /** From buyerProfiles.fullName (users has no name column) — null when absent. */
  name: string | null
  email: string | null
}

/** Buyer-provided evidence photo metadata (bytes are served by /api/attachments/[id]). */
interface ApiReturnEvidence {
  id: string
  mimeType: string
  sizeBytes: number
  note: string | null
  url: string
}

interface ApiReturnReceipt {
  supplierId: string
  itemsRestored: number
  restoredValue: number
  note: string | null
  createdAt: string
}

interface ApiAdminReturn {
  id: string
  returnNumber: string
  orderId: string
  status: string
  shippingMethod: string
  estimatedRefund: number
  /** Real sums from the refunds ledger — estimatedRefund − refundTotal = refundRemaining. */
  refundTotal: number
  refundRemaining: number
  resolutionNote: string | null
  resolvedById: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  items: ApiAdminReturnItem[]
  refunds: ApiRefund[]
  /** Seller receipts of the returned GOODS (Task 60-a) + the supplier denominator. */
  receipts: ApiReturnReceipt[]
  supplierCount: number
  /** Buyer-provided evidence photos — review only, never fabricated. */
  evidence: ApiReturnEvidence[]
  order: ApiAdminReturnOrder | null
  buyer: ApiAdminReturnBuyer | null
}

interface ApiReturnCounts {
  pending: number
  approved: number
  rejected: number
  refunded: number
  total: number
}

type ReturnTab = 'all' | 'pending' | 'approved' | 'rejected' | 'refunded'

const TAB_LABELS: Record<ReturnTab, string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  refunded: 'Refunded',
}

const REFRESH_INTERVAL_MS = 30_000

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 rounded-lg px-2 py-1 text-slate-500 dark:text-neutral-400'

// Real status → chip color (same palette language as the other admin queues)
const orderStatusChip: Record<string, string> = {
  processing: 'text-slate-600 dark:text-neutral-400 dark:text-neutral-300 bg-slate-50 dark:bg-background border-slate-100 dark:border-neutral-800',
  shipped: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  delivered: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  cancelled: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900',
  paid: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  unpaid: 'text-slate-600 dark:text-neutral-400 dark:text-neutral-300 bg-slate-50 dark:bg-background border-slate-100 dark:border-neutral-800',
  partial: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  refunded: 'text-slate-600 dark:text-neutral-400 dark:text-neutral-300 bg-slate-50 dark:bg-background border-slate-100 dark:border-neutral-800',
}

// Return status → shadcn Badge tone (real statuses only)
const statusBadgeClass: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  refunded: 'bg-slate-50 text-slate-600 dark:text-neutral-400 border-slate-200 dark:bg-background dark:text-neutral-300 dark:border-neutral-800',
}

// Real refund method value → honest label
function refundMethodLabel(method: string): string {
  if (method === 'bank_transfer') return 'Bank transfer'
  if (method === 'mobile_banking') return 'Mobile banking'
  if (method === 'cash') return 'Cash'
  return method // any other real value, verbatim
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function shippingLabel(method: string): string {
  if (method === 'pickup') return 'Pickup'
  if (method === 'dropoff') return 'Drop-off'
  return method // any other real value, verbatim
}

export function AdminReturnsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [returns, setReturns] = useState<ApiAdminReturn[]>([])
  const [counts, setCounts] = useState<ApiReturnCounts | null>(null)
  const [dataNotes, setDataNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tab, setTab] = useState<ReturnTab>('all')

  // Decision dialog state (no optimistic moves — server response applied on 200)
  const [dialog, setDialog] = useState<{ ret: ApiAdminReturn; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [refundInput, setRefundInput] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Record-refund dialog state (POST /api/admin/returns/[id]/refund)
  const [refundDialog, setRefundDialog] = useState<{ ret: ApiAdminReturn } | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('')
  const [refundRef, setRefundRef] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [refundError, setRefundError] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = dialog !== null || refundDialog !== null
  }, [dialog, refundDialog])

  const loadReturns = useCallback(async (background = false) => {
    // A background refresh never fights a foreground load; a tab switch always wins.
    if (background && inflightRef.current) return
    inflightRef.current = true
    const seq = ++seqRef.current
    const apply = (fn: () => void) => { if (seq === seqRef.current) fn() }
    if (background) apply(() => setRefreshing(true))
    else {
      setLoading(true)
      setError('')
      setRefreshError('')
    }
    apply(() => setRefreshError(''))
    try {
      const res = await fetch(`/api/admin/returns?status=${tab}&take=100`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setReturns([]); setCounts(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load return requests (HTTP ${res.status})`
        apply(() => { if (background) setRefreshError(msg); else setError(msg) })
        return
      }
      apply(() => {
        setReturns(Array.isArray(json.data?.returns) ? json.data.returns : [])
        setCounts(json.data?.counts ?? null)
        setDataNotes(Array.isArray(json.data?.dataNotes) ? json.data.dataNotes : [])
        setLastUpdated(new Date())
        setNeedsAuth(false)
      })
    } catch {
      const msg = 'Network error while loading return requests. Check your connection and retry.'
      apply(() => { if (background) setRefreshError(msg); else setError(msg) })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [tab])

  // Initial load + auto-refresh every 30s (cleared on unmount, paused while the decision dialog is open)
  useEffect(() => {
    loadReturns()
    const id = setInterval(() => { if (!dialogOpenRef.current) loadReturns(true) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadReturns])

  const openDialog = (ret: ApiAdminReturn, action: 'approve' | 'reject') => {
    setDialog({ ret, action })
    setNote('')
    // Prefill with the REAL stored estimate — the admin edits or clears it; empty keeps it.
    setRefundInput(action === 'approve' ? String(ret.estimatedRefund) : '')
    setDialogError('')
  }

  const closeDialog = () => {
    setDialog(null)
    setNote('')
    setRefundInput('')
    setDialogError('')
  }

  const openRefundDialog = (ret: ApiAdminReturn) => {
    setRefundDialog({ ret })
    // Prefill with the row's REAL stored estimate — editable; validated
    // client-side against the real remaining budget (estimate − refunded).
    setRefundAmount(String(ret.estimatedRefund))
    setRefundMethod('')
    setRefundRef('')
    setRefundNote('')
    setRefundError('')
  }

  const closeRefundDialog = () => {
    setRefundDialog(null)
    setRefundAmount('')
    setRefundMethod('')
    setRefundRef('')
    setRefundNote('')
    setRefundError('')
  }

  const submitRefund = async () => {
    if (!refundDialog) return
    const { ret } = refundDialog
    const raw = refundAmount.trim()
    const amount = Number(raw)
    const remaining = ret.refundRemaining

    // Client-side mirror of the server's real guards (the server re-checks
    // everything — these only avoid a doomed round trip).
    if (raw.length === 0 || !Number.isFinite(amount) || amount <= 0) {
      setRefundError('Refund amount must be a positive number.')
      return
    }
    if (Math.round(amount * 100) / 100 > remaining) {
      setRefundError(`Refund amount exceeds the remaining refund budget: ${formatPrice(remaining)} remains on ${ret.returnNumber}.`)
      return
    }
    const trimmedRef = refundRef.trim()
    if (trimmedRef.length < 4) {
      setRefundError('A real transaction reference (at least 4 characters) is required — no reference, no refund record.')
      return
    }
    if (!refundMethod) {
      setRefundError('Select the transfer method that was actually used.')
      return
    }
    const trimmedNote = refundNote.trim()

    setRefundSubmitting(true)
    setRefundError('')
    try {
      const res = await fetch(`/api/admin/returns/${ret.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: Math.round(amount * 100) / 100,
          method: refundMethod,
          reference: trimmedRef,
          ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error, verbatim (409 conflict, 422 budget, 401 …)
        const msg = json?.error || `Refund record failed (HTTP ${res.status})`
        setRefundError(msg)
        toast.error(msg)
        return
      }
      // Real 2xx — apply the server-serialized row, toast, refresh counts.
      const updated = json.return as ApiAdminReturn
      setReturns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(json.message || `Refund recorded for ${updated.returnNumber}.`)
      closeRefundDialog()
      loadReturns(true)
    } catch {
      const msg = 'Network error while recording the refund. Check your connection and retry.'
      setRefundError(msg)
      toast.error(msg)
    } finally {
      setRefundSubmitting(false)
    }
  }

  const submitDecision = async () => {
    if (!dialog) return
    const { ret, action } = dialog
    const trimmedNote = note.trim()

    if (action === 'reject' && trimmedNote.length < 3) {
      setDialogError('A rejection note of at least 3 characters is required — the buyer will see it on their order.')
      return
    }
    let refundAmount: number | undefined
    if (action === 'approve') {
      const raw = refundInput.trim()
      if (raw.length > 0) {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0) {
          setDialogError('Refund amount must be a number of at least 0 — clear the field to keep the buyer\u2019s original estimate.')
          return
        }
        refundAmount = n
      }
    }

    setSubmitting(true)
    setDialogError('')
    try {
      const res = await fetch(`/api/admin/returns/${ret.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
          ...(refundAmount !== undefined ? { refundAmount } : {}),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error, verbatim (409 conflict, 422 validation, 401 …)
        const msg = json?.error || `Action failed (HTTP ${res.status})`
        setDialogError(msg)
        toast.error(msg)
        return
      }
      // Real 2xx — apply the server's serialized row, toast, then refresh counts.
      const updated = json.data as ApiAdminReturn
      setReturns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(json.message || `Return request ${updated.returnNumber} ${action === 'approve' ? 'approved' : 'rejected'}.`)
      closeDialog()
      loadReturns(true)
    } catch {
      const msg = 'Network error while submitting the decision. Check your connection and retry.'
      setDialogError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">The return review queue is restricted to Zylod admins. Sign in with an admin account to review buyer return requests.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  const tabCount = (t: ReturnTab): number | null => {
    if (!counts) return null
    if (t === 'all') return counts.total
    return counts[t]
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Return Requests</h1>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Approve/reject is audit-logged. Record a refund only after the money really moved — every record needs the real transfer reference.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadReturns(true)}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-neutral-800 dark:border-neutral-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Verbatim refresh error (last good data — even an honest empty list — stays on screen) */}
      {refreshError && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-2xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{refreshError}</span>
          <button onClick={() => loadReturns(true)} className="ml-auto underline underline-offset-2 shrink-0">Retry</button>
        </div>
      )}

      {/* Status tabs with real counts */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TAB_LABELS) as ReturnTab[]).map((t) => {
          const n = tabCount(t)
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-11 px-4 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${tab === t ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-neutral-800 dark:border-neutral-700 text-slate-600 dark:text-neutral-400 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
            >
              {TAB_LABELS[t]}
              <span className={`tabular-nums ${tab === t ? 'text-white/80' : 'text-slate-400 dark:text-neutral-500'}`}>{n == null ? '' : n.toLocaleString('en-BD')}</span>
            </button>
          )
        })}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-neutral-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the return review queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadReturns()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : returns.length === 0 ? (
        // Honest empty state — the DB truly has zero (or zero matching) return requests
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-slate-200 dark:border-neutral-800 text-center space-y-2">
          {tab === 'all' ? (
            <>
              <Inbox className="h-10 w-10 text-slate-300 dark:text-neutral-700 dark:text-neutral-300 mx-auto" />
              <h2 className="text-sm font-black">No return requests yet</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-md mx-auto leading-relaxed">
                The returnRequests table currently holds zero rows — real counts, not a placeholder. When a buyer submits a return on a paid, delivered order it will appear here for review.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className={`h-10 w-10 mx-auto ${tab === 'pending' ? 'text-slate-300 dark:text-neutral-700' : 'text-emerald-500'}`} />
              <h2 className="text-sm font-black">No {TAB_LABELS[tab].toLowerCase()} return requests</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-md mx-auto leading-relaxed">
                No return request currently has status &ldquo;{tab}&rdquo;. Switch to All to see every return request in the database.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto scrollbar-thin pr-1 space-y-3">
          {returns.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 md:p-5 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Top row: number + status + order chips */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-800 dark:text-neutral-200">{r.returnNumber}</p>
                    <Badge variant="outline" className={`text-[10px] font-black rounded-lg ${statusBadgeClass[r.status] || chipClass}`}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Submitted {formatTimestamp(r.createdAt)} · Order {r.order?.orderNumber ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold border rounded-lg px-2 py-0.5 ${r.order?.status ? (orderStatusChip[r.order.status] || chipClass) : chipClass}`}>
                    {r.order?.status ?? 'no order'}
                  </span>
                  <span className={`text-[10px] font-bold border rounded-lg px-2 py-0.5 ${r.order?.paymentStatus ? (orderStatusChip[r.order.paymentStatus] || chipClass) : chipClass}`}>
                    {r.order?.paymentStatus ?? 'no order'}
                  </span>
                </div>
              </div>

              {/* Buyer + refund + shipping */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2">
                  <User className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Buyer</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-neutral-300 truncate">{r.buyer?.name ?? '—'}</p>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 truncate">{r.buyer?.email ?? 'no email on file'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2">
                  <Wallet className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Estimated refund</p>
                    <p className="text-xs font-black text-primary tabular-nums">{formatPrice(r.estimatedRefund)}</p>
                    {r.refundTotal > 0 && (
                      <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {formatPrice(r.refundTotal)} refunded · {formatPrice(r.refundRemaining)} remaining
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2">
                  <Truck className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Return method</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-neutral-300">{shippingLabel(r.shippingMethod)}</p>
                  </div>
                </div>
              </div>

              {/* Task 60-a — goods receipt by the seller(s), distinct from money */}
              {r.supplierCount > 0 && (
                <div
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                    r.receipts.length >= r.supplierCount
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
                      : 'bg-slate-50 dark:bg-background border-slate-100 dark:border-neutral-800'
                  }`}
                >
                  <PackageCheck
                    className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                      r.receipts.length >= r.supplierCount ? 'text-emerald-600' : 'text-slate-400 dark:text-neutral-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
                      Goods received by seller
                    </p>
                    {r.receipts.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
                        Not yet — stock restores when each seller confirms the goods arrived
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-slate-700 dark:text-neutral-300">
                          {r.receipts.length}/{r.supplierCount} seller(s) · {r.receipts.reduce((s, x) => s + x.itemsRestored, 0)} line(s) back in stock
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 tabular-nums">
                          {r.receipts.map((rc) => formatPrice(rc.restoredValue)).join(' + ')} stock value restored
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Items — real reasons / quantities / comments */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <Package className="h-3 w-3" /> Items ({r.items.length})
                </p>
                <div className="rounded-xl border border-slate-100 dark:border-neutral-800 divide-y divide-slate-100 dark:divide-neutral-800">
                  {r.items.map((item) => (
                    <div key={item.id} className="px-3 py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-neutral-300 break-words">{item.reason}</p>
                        {item.comments && (
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5 break-words">&ldquo;{item.comments}&rdquo;</p>
                        )}
                      </div>
                      <span className={`text-[10px] shrink-0 ${chipClass}`}>Qty {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buyer evidence photos — review only, never fabricated (empty rows stay honestly empty) */}
              <EvidenceThumbs photos={Array.isArray(r.evidence) ? r.evidence : []} label="Buyer evidence" />

              {/* Refunds — real ledger rows (money that actually moved outside the system) */}
              {r.refunds.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                    <Banknote className="h-3 w-3" /> Refunds ({r.refunds.length})
                  </p>
                  <div className="rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 divide-y divide-emerald-100 dark:divide-emerald-900">
                    {r.refunds.map((f) => (
                      <div key={f.id} className="px-3 py-2 flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {formatPrice(f.amount)} <span className="font-bold">· {refundMethodLabel(f.method)}</span>
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-neutral-400 dark:text-neutral-500 break-all">ref {f.reference}</p>
                          {f.note && <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5 break-words">&ldquo;{f.note}&rdquo;</p>}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">{formatTimestamp(f.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution (shown only when a real decision exists) */}
              {r.resolutionNote && (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2">
                  <ScrollText className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 dark:text-neutral-400 dark:text-neutral-500 dark:text-neutral-300 break-words">
                    <span className="font-black">Decision note:</span> {r.resolutionNote}
                  </p>
                </div>
              )}
              {r.resolvedAt && (
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 tabular-nums">
                  Resolved {formatTimestamp(r.resolvedAt)}
                  {r.resolvedById ? ` · by admin ${r.resolvedById}` : ''}
                </p>
              )}

              {/* Actions — only for genuinely actionable rows */}
              {r.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => openDialog(r, 'approve')}
                    disabled={submitting || refundSubmitting}
                    className="flex-1 min-h-11 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    onClick={() => openDialog(r, 'reject')}
                    disabled={submitting || refundSubmitting}
                    variant="outline"
                    className="flex-1 min-h-11 rounded-xl text-xs font-bold gap-1.5 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              )}
              {r.status === 'approved' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => openRefundDialog(r)}
                    disabled={submitting || refundSubmitting || r.refundRemaining <= 0}
                    className="flex-1 min-h-11 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    {r.refundRemaining <= 0 ? 'Refund budget used' : 'Record refund'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Honest data notes straight from the API */}
      {!loading && dataNotes.length > 0 && returns.length > 0 && (
        <div className="rounded-2xl border border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-background/40 p-4 space-y-1">
          {dataNotes.map((noteLine, i) => (
            <p key={i} className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 leading-relaxed">· {noteLine}</p>
          ))}
        </div>
      )}

      {/* Approve / Reject decision dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  {dialog.action === 'approve' ? (
                    <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Approve {dialog.ret.returnNumber}</>
                  ) : (
                    <><XCircle className="h-4 w-4 text-red-600" /> Reject {dialog.ret.returnNumber}</>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
                  {dialog.action === 'approve'
                    ? 'Approving records a real decision (audit-logged). You may set the refund amount — clear the field to keep the buyer\u2019s original estimate. No money moves from this queue.'
                    : 'Rejecting records a real decision (audit-logged). A note of at least 3 characters is required — the buyer will see it on their order.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2 text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
                  Order {dialog.ret.order?.orderNumber ?? '—'} · {dialog.ret.items.length} item{dialog.ret.items.length === 1 ? '' : 's'} · estimated refund {formatPrice(dialog.ret.estimatedRefund)}
                </div>

                {dialog.action === 'approve' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="refund-amount" className="text-xs font-bold">Refund amount (optional)</Label>
                    <Input
                      id="refund-amount"
                      inputMode="decimal"
                      value={refundInput}
                      onChange={(e) => setRefundInput(e.target.value)}
                      placeholder="Leave empty to keep the buyer's estimate"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="decision-note" className="text-xs font-bold">
                    {dialog.action === 'reject' ? 'Rejection note (required, min 3 characters)' : 'Note (optional)'}
                  </Label>
                  <Textarea
                    id="decision-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={dialog.action === 'reject' ? 'Explain the real reason this return is rejected…' : 'Optional context for this approval…'}
                    className="min-h-[80px] rounded-xl text-xs"
                  />
                  {dialog.action === 'reject' && (
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{note.trim().length}/3 characters minimum</p>
                  )}
                </div>

                {dialogError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {dialogError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={submitting} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-neutral-800 dark:border-neutral-700">
                  Cancel
                </Button>
                <Button
                  onClick={submitDecision}
                  disabled={
                    submitting ||
                    (dialog.action === 'reject' && note.trim().length < 3)
                  }
                  className={`min-h-11 rounded-xl text-xs font-bold text-white ${dialog.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {submitting
                    ? 'Saving…'
                    : dialog.action === 'approve'
                      ? 'Confirm approve'
                      : 'Confirm reject'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record-refund dialog (approved rows only — documents real money movement) */}
      <Dialog open={refundDialog !== null} onOpenChange={(open) => { if (!open) closeRefundDialog() }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          {refundDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" /> Record refund — {refundDialog.ret.returnNumber}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
                  Only record a refund AFTER the money actually left — via bank transfer, mobile banking, or cash.
                  This writes a real ledger row and marks the return refunded. It does not move money, and the order&rsquo;s
                  payment status is never modified.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 px-3 py-2 text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
                  Order {refundDialog.ret.order?.orderNumber ?? '—'} · estimate {formatPrice(refundDialog.ret.estimatedRefund)}
                  {' '}· remaining <span className="font-bold tabular-nums">{formatPrice(refundDialog.ret.refundRemaining)}</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="refund-record-amount" className="text-xs font-bold">Amount</Label>
                  <Input
                    id="refund-record-amount"
                    inputMode="decimal"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
                    Prefilled with the stored estimate. Must be &gt; 0 and ≤ {formatPrice(refundDialog.ret.refundRemaining)} (estimate minus what is already refunded).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Transfer method</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue placeholder="Select the method actually used" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="mobile_banking">Mobile banking</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="refund-record-reference" className="text-xs font-bold">Transaction reference</Label>
                  <Input
                    id="refund-record-reference"
                    value={refundRef}
                    onChange={(e) => setRefundRef(e.target.value)}
                    placeholder="e.g. UTR / TxnID from the transfer receipt"
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Transaction ID / UTR from the real transfer — no reference, no refund record.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="refund-record-note" className="text-xs font-bold">Note (optional)</Label>
                  <Textarea
                    id="refund-record-note"
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    placeholder="Optional context — e.g. which bank account received it…"
                    className="min-h-[64px] rounded-xl text-xs"
                  />
                </div>

                {refundError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {refundError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeRefundDialog} disabled={refundSubmitting} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-neutral-800 dark:border-neutral-700">
                  Cancel
                </Button>
                <Button
                  onClick={submitRefund}
                  disabled={refundSubmitting || refundRef.trim().length < 4 || !refundMethod}
                  className="min-h-11 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {refundSubmitting ? 'Recording…' : 'Record refund'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminReturnsPage
