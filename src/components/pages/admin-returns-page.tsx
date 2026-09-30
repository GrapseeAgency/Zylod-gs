'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { toast } from 'sonner'
import {
  RotateCcw, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Package,
  User, Wallet, Truck, ScrollText, Inbox,
} from 'lucide-react'

// ── Real API types (GET /api/admin/returns · PATCH /api/admin/returns/[id]) ──
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

interface ApiAdminReturn {
  id: string
  returnNumber: string
  orderId: string
  status: string
  shippingMethod: string
  estimatedRefund: number
  resolutionNote: string | null
  resolvedById: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  items: ApiAdminReturnItem[]
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

type ReturnTab = 'all' | 'pending' | 'approved' | 'rejected'

const TAB_LABELS: Record<ReturnTab, string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const REFRESH_INTERVAL_MS = 30_000

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

// Real status → chip color (same palette language as the other admin queues)
const orderStatusChip: Record<string, string> = {
  processing: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800',
  shipped: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  delivered: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  cancelled: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900',
  paid: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  unpaid: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800',
  partial: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  refunded: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800',
}

// Return status → shadcn Badge tone (real statuses only)
const statusBadgeClass: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  refunded: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800',
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

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => { dialogOpenRef.current = dialog !== null }, [dialog])

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
        <p className="text-xs text-slate-500 max-w-sm mx-auto">The return review queue is restricted to Zylod admins. Sign in with an admin account to review buyer return requests.</p>
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
            <p className="text-[11px] text-slate-400">Review buyer return requests. Every approve/reject is a real, audit-logged decision — this queue cannot mark returns as refunded.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadReturns(true)}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
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
              className={`min-h-11 px-4 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${tab === t ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
            >
              {TAB_LABELS[t]}
              <span className={`tabular-nums ${tab === t ? 'text-white/80' : 'text-slate-400'}`}>{n == null ? '' : n.toLocaleString('en-BD')}</span>
            </button>
          )
        })}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the return review queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadReturns()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : returns.length === 0 ? (
        // Honest empty state — the DB truly has zero (or zero matching) return requests
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {tab === 'all' ? (
            <>
              <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <h2 className="text-sm font-black">No return requests yet</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                The returnRequests table currently holds zero rows — real counts, not a placeholder. When a buyer submits a return on a paid, delivered order it will appear here for review.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className={`h-10 w-10 mx-auto ${tab === 'pending' ? 'text-slate-300 dark:text-slate-700' : 'text-emerald-500'}`} />
              <h2 className="text-sm font-black">No {TAB_LABELS[tab].toLowerCase()} return requests</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
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
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Top row: number + status + order chips */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{r.returnNumber}</p>
                    <Badge variant="outline" className={`text-[10px] font-black rounded-lg ${statusBadgeClass[r.status] || chipClass}`}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
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
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <User className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Buyer</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{r.buyer?.name ?? '—'}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.buyer?.email ?? 'no email on file'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <Wallet className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Estimated refund</p>
                    <p className="text-xs font-black text-primary tabular-nums">{formatPrice(r.estimatedRefund)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <Truck className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Return method</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{shippingLabel(r.shippingMethod)}</p>
                  </div>
                </div>
              </div>

              {/* Items — real reasons / quantities / comments */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Package className="h-3 w-3" /> Items ({r.items.length})
                </p>
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {r.items.map((item) => (
                    <div key={item.id} className="px-3 py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 break-words">{item.reason}</p>
                        {item.comments && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 break-words">&ldquo;{item.comments}&rdquo;</p>
                        )}
                      </div>
                      <span className={`text-[10px] shrink-0 ${chipClass}`}>Qty {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution (shown only when a real decision exists) */}
              {r.resolutionNote && (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <ScrollText className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 break-words">
                    <span className="font-black">Decision note:</span> {r.resolutionNote}
                  </p>
                </div>
              )}
              {r.resolvedAt && (
                <p className="text-[10px] text-slate-400 tabular-nums">
                  Resolved {formatTimestamp(r.resolvedAt)}
                  {r.resolvedById ? ` · by admin ${r.resolvedById}` : ''}
                </p>
              )}

              {/* Actions — only for genuinely pending rows */}
              {r.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => openDialog(r, 'approve')}
                    disabled={submitting}
                    className="flex-1 min-h-11 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    onClick={() => openDialog(r, 'reject')}
                    disabled={submitting}
                    variant="outline"
                    className="flex-1 min-h-11 rounded-xl text-xs font-bold gap-1.5 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Honest data notes straight from the API */}
      {!loading && dataNotes.length > 0 && returns.length > 0 && (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-1">
          {dataNotes.map((noteLine, i) => (
            <p key={i} className="text-[10px] text-slate-400 leading-relaxed">· {noteLine}</p>
          ))}
        </div>
      )}

      {/* Approve / Reject decision dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
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
                <DialogDescription className="text-xs text-slate-500">
                  {dialog.action === 'approve'
                    ? 'Approving records a real decision (audit-logged). You may set the refund amount — clear the field to keep the buyer\u2019s original estimate. No money moves from this queue.'
                    : 'Rejecting records a real decision (audit-logged). A note of at least 3 characters is required — the buyer will see it on their order.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
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
                    <p className="text-[10px] text-slate-400">{note.trim().length}/3 characters minimum</p>
                  )}
                </div>

                {dialogError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {dialogError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={submitting} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700">
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
    </div>
  )
}

export default AdminReturnsPage
