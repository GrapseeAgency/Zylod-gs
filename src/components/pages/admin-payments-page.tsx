'use client'

/**
 * Admin Payments — oversight + verification over the REAL manual payment
 * chain (Task 56-b), on the dedicated /api/admin/payments contracts:
 *
 *   GET  /api/admin/payments        — ?status=<pending|success|failed|refunded>&page&limit
 *                                     (+ whole-table stats: the 4 real statuses + total)
 *   POST /api/admin/payments/[id]/verify — { action: 'verify' | 'reject', note? }
 *                                     the admin-override decision on a pending
 *                                     submission (honest partial math server-side).
 *
 * payments.status real values: pending | success | failed | refunded
 * (prisma/schema.prisma). Tabs/stats are built from exactly those — nothing
 * is filtered client-side so counts and pagination stay real.
 *
 * Live: joins the session admin's own token-gated room admin:<adminUserId>
 * (the house admin-room convention — room-token authorizes admins to their
 * own id only) and refetches on payment:submitted / payment:verified /
 * payment:rejected. Degrades gracefully: no session id or a denied join
 * simply means no live refresh — the list, stats, refresh button and 30s
 * polling still work.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { toast } from 'sonner'
import {
  ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle,
  Wallet, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react'

// ── Real API types (GET /api/admin/payments) ──────────────────────────
interface ApiPaymentRow {
  id: string
  orderId: string
  orderNumber: string
  orderTotal: number
  orderPaymentStatus: string
  method: string
  brand: string | null
  amount: number
  status: string
  transactionId: string | null
  submittedAt: string | null
  paidAt: string | null
  buyer: { displayName: string | null }
  suppliers: string[]
}

interface ApiStats {
  pending: number
  success: number
  failed: number
  refunded: number
  total: number
}

/** REAL payments.status values (prisma/schema.prisma) — no invented states. */
const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'success', label: 'Success' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'all', label: 'All' },
]

const REFRESH_INTERVAL_MS = 30_000
const PAGE_SIZE = 20

const statusChip: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  refunded: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
}

function StatusChip({ status }: { status: string }) {
  const cls = statusChip[status] ?? 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-950 dark:border-slate-800'
  return <span className={`text-[10px] font-black border rounded-lg px-2 py-1 uppercase tracking-wide ${cls}`}>{status}</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function AdminPaymentsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const sessionUser = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [rows, setRows] = useState<ApiPaymentRow[]>([])
  const [stats, setStats] = useState<ApiStats | null>(null)
  const [statusTab, setStatusTab] = useState('pending')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Verify/reject dialog state (no optimistic moves — server response applied on 200)
  const [dialogTarget, setDialogTarget] = useState<{ row: ApiPaymentRow; action: 'verify' | 'reject' } | null>(null)
  const [dialogNote, setDialogNote] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [deciding, setDeciding] = useState(false)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = dialogTarget !== null
  }, [dialogTarget])

  const loadPayments = useCallback(async (opts?: { status?: string; page?: number; background?: boolean }) => {
    const useStatus = opts?.status ?? statusTab
    const usePage = opts?.page ?? page
    const background = opts?.background ?? false
    // A background refresh never fights a foreground load; a tab switch always wins.
    if (background && inflightRef.current) return
    inflightRef.current = true
    const seq = ++seqRef.current
    const apply = (fn: () => void) => { if (seq === seqRef.current) fn() }
    if (background) apply(() => setRefreshing(true))
    else {
      setLoading(true)
      setError('')
    }
    try {
      const params = new URLSearchParams({ page: String(usePage), limit: String(PAGE_SIZE) })
      // 'all' → omit the param; the route only accepts the 4 real status values
      if (useStatus !== 'all') params.set('status', useStatus)
      const res = await fetch(`/api/admin/payments?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setRows([]); setStats(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load payments (HTTP ${res.status})`
        apply(() => {
          if (background) setError(msg)
          else setError(msg)
          if (!background) { setRows([]); setStats(null) }
        })
        return
      }
      apply(() => {
        setRows(Array.isArray(json.data) ? json.data : [])
        setStats(json.stats ?? null)
        setTotalPages(json.pagination?.totalPages || 0)
        setTotal(json.pagination?.total || 0)
        setNeedsAuth(false)
      })
    } catch {
      const msg = 'Network error while loading payments. Check your connection and retry.'
      apply(() => { setError(msg); if (!background) { setRows([]); setStats(null) } })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [statusTab, page])

  useEffect(() => { loadPayments() }, [loadPayments])

  // Auto-refresh every 30s (cleared on unmount, paused while the dialog is open)
  useEffect(() => {
    const id = setInterval(() => { if (!dialogOpenRef.current) loadPayments({ background: true }) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadPayments])

  // Live refresh — the session admin's own token-gated room. Degraded
  // (no subscription) when there is no session user id: the list still
  // works through polling + the refresh button.
  const adminRoom = sessionUser?.userType === 'admin' && sessionUser.id ? `admin:${sessionUser.id}` : ''
  const onLiveEvent = useCallback((event: string) => {
    if (event === 'payment:submitted') {
      toast('New payment submission', { description: 'A buyer submitted a payment reference — refresh is running.' })
    }
    void loadPayments({ background: true })
  }, [loadPayments])
  const lastEventRef = useRef('')
  useRealtimeRoom(adminRoom ? [adminRoom] : [], {
    onEvent: (message) => {
      // De-duplicate the onAny tap (same event delivered twice to one room)
      const key = `${message.event}:${message.receivedAt.getTime()}`
      if (key === lastEventRef.current) return
      lastEventRef.current = key
      onLiveEvent(message.event)
    },
  })

  const switchTab = (key: string) => {
    setStatusTab(key)
    setPage(1)
    setExpandedId(null)
    loadPayments({ status: key, page: 1 })
  }

  const openDecision = (row: ApiPaymentRow, action: 'verify' | 'reject') => {
    setDialogTarget({ row, action })
    setDialogNote('')
    setDialogError('')
  }

  const submitDecision = async () => {
    if (!dialogTarget) return
    const { row, action } = dialogTarget
    setDeciding(true)
    setDialogError('')
    try {
      const note = dialogNote.trim()
      const res = await fetch(`/api/admin/payments/${encodeURIComponent(row.id)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(note ? { action, note } : { action }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setDialogError(json?.error || `Could not ${action} the payment (HTTP ${res.status})`)
        return
      }
      const d = json?.data
      if (action === 'verify') {
        toast.success(`Payment verified — order #${row.orderNumber} is now ${d?.orderPaymentStatus ?? 'updated'}`, {
          description: d ? `${formatPrice(d.amountPaid)} recorded against an order total of ${formatPrice(d.orderTotal)}.` : undefined,
        })
      } else {
        toast.success(`Payment rejected — submission for order #${row.orderNumber} marked failed`)
      }
      setDialogTarget(null)
      loadPayments({ background: true })
    } catch {
      setDialogError('Network error while submitting the decision. Check your connection and retry.')
    } finally {
      setDeciding(false)
    }
  }

  // ── Guard state ──────────────────────────────────────────────────────
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
            <p className="text-[11px] text-slate-400">Every buyer payment submission across the platform — verify after confirming money arrived. Every action is audit-logged.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadPayments({ background: true })} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats strip — real groupBy counts, independent of the current filter */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { key: 'pending', label: 'Pending', tone: 'text-amber-600', Icon: Clock },
          { key: 'success', label: 'Success', tone: 'text-emerald-600', Icon: CheckCircle2 },
          { key: 'failed', label: 'Failed', tone: 'text-red-500', Icon: XCircle },
          { key: 'refunded', label: 'Refunded', tone: 'text-slate-500', Icon: RotateCcw },
          { key: 'total', label: 'Total', tone: 'text-slate-700 dark:text-slate-200', Icon: Wallet },
        ].map(({ key, label, tone, Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(STATUS_TABS.some((t) => t.key === key) ? key : 'all')}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${tone}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <p className="text-xl font-black mt-1">{stats ? stats[key] : '--'}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${statusTab === t.key ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadPayments()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {statusTab === 'pending' ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-sm font-black">No payments awaiting verification</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Buyer submissions appear here the moment POST /api/orders/[id]/payment-submit records them. Nothing is marked paid until a seller, an admin, or the verified webhook confirms it.
              </p>
            </>
          ) : (
            <>
              <Wallet className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No {statusTab} payments</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">This tab reflects the real payments table — counts in the strip above are platform-wide.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-left">
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Order</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Buyer</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Supplier(s)</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Method</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">TRX ID</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Date</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
                    <td className="px-3 py-2.5 font-black whitespace-nowrap">#{p.orderNumber}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 max-w-[140px] truncate">{p.buyer.displayName || '--'}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 max-w-[140px] truncate">{p.suppliers.join(', ') || '--'}</td>
                    <td className="px-3 py-2.5 capitalize">{p.method}{p.brand ? <span className="text-slate-400"> · {p.brand}</span> : null}</td>
                    <td className="px-3 py-2.5 font-mono max-w-[150px] truncate">{p.transactionId || '--'}</td>
                    <td className="px-3 py-2.5 text-right font-black whitespace-nowrap">
                      {formatPrice(p.amount)}
                      <span className="block text-[9px] text-slate-400 font-normal">of {formatPrice(p.orderTotal)} · {p.orderPaymentStatus}</span>
                    </td>
                    <td className="px-3 py-2.5"><StatusChip status={p.status} /></td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{formatDate(p.submittedAt ?? p.paidAt)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {p.status === 'pending' ? (
                        <Button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="h-8 px-3 rounded-lg text-[11px] font-bold bg-primary hover:bg-primary/90 text-white gap-1">
                          {expandedId === p.id ? <><ChevronUp className="h-3 w-3" /> Close</> : <>Decide</>}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-400">decided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map((p) => (
              <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black">#{p.orderNumber}</p>
                    <p className="text-[11px] text-slate-400 truncate">{p.buyer.displayName || '--'} → {p.suppliers.join(', ') || '--'}</p>
                  </div>
                  <StatusChip status={p.status} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 capitalize">{p.method}{p.brand ? ` · ${p.brand}` : ''}</span>
                  <span className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 font-mono">{p.transactionId || '--'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-primary">{formatPrice(p.amount)} <span className="text-[10px] text-slate-400 font-normal">of {formatPrice(p.orderTotal)} · {p.orderPaymentStatus}</span></span>
                  <span className="text-[10px] text-slate-400">{formatDate(p.submittedAt ?? p.paidAt)}</span>
                </div>
                {p.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button onClick={() => openDecision(p, 'reject')} variant="outline" className="h-10 rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50">Reject</Button>
                    <Button onClick={() => openDecision(p, 'verify')} className="h-10 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Verify</Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop row expansion → decision buttons (confirm dialog opens from here) */}
          {expandedId && (() => {
            const p = rows.find((r) => r.id === expandedId)
            if (!p || p.status !== 'pending') return null
            return (
              <div className="hidden md:flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
                <p className="text-xs text-slate-500">
                  Decide the pending submission for <span className="font-bold text-slate-800 dark:text-slate-200">#{p.orderNumber}</span> — verify only after confirming {formatPrice(p.amount)} really arrived ({p.method}{p.brand ? ` · ${p.brand}` : ''}, ref {p.transactionId || '--'}).
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => openDecision(p, 'reject')} variant="outline" className="h-9 px-4 rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50">Reject</Button>
                  <Button onClick={() => openDecision(p, 'verify')} className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Verify</Button>
                </div>
              </div>
            )
          })()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">{total} payment{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadPayments({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadPayments({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verify / Reject confirm dialog */}
      <Dialog open={dialogTarget !== null} onOpenChange={(open) => { if (!deciding) { if (!open) setDialogTarget(null); setDialogError('') } }}>
        <DialogContent className="max-w-md rounded-3xl">
          {dialogTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black">
                  {dialogTarget.action === 'verify' ? 'Confirm money received' : 'Reject this payment submission'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {dialogTarget.action === 'verify'
                    ? `Order #${dialogTarget.row.orderNumber} · ${dialogTarget.row.method}${dialogTarget.row.brand ? ` (${dialogTarget.row.brand})` : ''} · ref ${dialogTarget.row.transactionId || '--'}. Verifying records ${formatPrice(dialogTarget.row.amount)} against an order total of ${formatPrice(dialogTarget.row.orderTotal)} — if the amount is below the total (±0.01), the order becomes PARTIAL, not paid. Only continue after confirming the money arrived in the company account.`
                    : `Order #${dialogTarget.row.orderNumber} · ref ${dialogTarget.row.transactionId || '--'}. Rejecting marks this submission FAILED and leaves the order ${dialogTarget.row.orderPaymentStatus}. The buyer can submit a corrected reference.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Verification note (optional)</label>
                  <Input
                    value={dialogNote}
                    onChange={(e) => setDialogNote(e.target.value)}
                    placeholder={dialogTarget.action === 'verify' ? 'e.g. matched against bank statement 12/05' : 'e.g. no money received for this reference'}
                    className="h-10 rounded-xl text-xs"
                    maxLength={500}
                  />
                </div>

                {dialogError && (
                  <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {dialogError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setDialogTarget(null); setDialogError('') }} disabled={deciding} className="h-10 px-4 rounded-xl text-xs font-bold">Cancel</Button>
                <Button
                  onClick={submitDecision}
                  disabled={deciding}
                  className={`h-10 px-5 rounded-xl text-xs font-bold text-white ${dialogTarget.action === 'verify' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {deciding ? 'Recording…' : dialogTarget.action === 'verify' ? 'Confirm & verify' : 'Reject submission'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminPaymentsPage
