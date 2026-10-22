'use client'

/**
 * Admin Orders — fulfillment view (Task 51-b).
 *
 * Consumes GET /api/admin/orders with the additive params:
 *   ?paymentStatus=all (see every order — the payments queue keeps its own
 *   'unpaid' default) + ?status=<REAL subOrders.status value> + ?page/?limit.
 *
 * The `orders` table has NO status column — fulfillment state lives on
 * subOrders (pending | confirmed | packed | shipped | delivered | cancelled |
 * returned, straight from prisma/schema.prisma). The status tabs below are
 * built from those real values and filter server-side via
 * where.subOrders = { some: { status } } — nothing is filtered client-side
 * so counts and pagination stay real.
 *
 * Read-only oversight EXCEPT one real admin lever (Task 59-b): Force cancel —
 * POST /api/admin/orders/[id]/cancel cancels every active shipment in any
 * state, voids pending payment references, marks verified money refunded and
 * restores stock. It exists because fraud/dispute intervention cannot be
 * blocked by the buyer-facing guards. Everything else stays seller-side
 * (PATCH /api/supplier/orders/[id]).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ShieldCheck, Search, RefreshCw, AlertTriangle, CheckCircle2, Package,
  ShoppingBag, Truck, Boxes, ChevronDown, ChevronUp, Ban, BadgeCheck,
} from 'lucide-react'

// ── Real API types (GET /api/admin/orders) ─────────────────────────────
interface ApiSubOrder {
  id: string
  status: string
  supplierId: string
  itemCount: number
}

interface ApiOrder {
  id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  status: string
  placedAt: string
  buyer: { id: string; email: string | null; name: string | null; userType: string } | null
  subOrderCount: number
  itemCount: number
  subOrders: ApiSubOrder[]
}

/** REAL subOrders.status values (prisma/schema.prisma) — no invented states. */
const ORDER_STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'returned', label: 'Returned' },
]

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

const paymentStatusChip: Record<string, string> = {
  unpaid: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  partial: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  refunded: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
}

const subOrderStatusChip: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  packed: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-900',
  shipped: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-900',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  cancelled: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  returned: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
}

function PaymentChip({ status }: { status: string }) {
  const cls = paymentStatusChip[status] ?? paymentStatusChip.refunded
  return <span className={`text-[10px] font-bold border rounded-lg px-2 py-1 uppercase tracking-wide ${cls}`}>{status}</span>
}

function SubOrderChip({ sub }: { sub: ApiSubOrder }) {
  const cls = subOrderStatusChip[sub.status] ?? subOrderStatusChip.pending
  return (
    <span className={`text-[10px] font-bold border rounded-lg px-2 py-1 ${cls}`}>
      {sub.status} · {sub.itemCount} item{sub.itemCount === 1 ? '' : 's'}
    </span>
  )
}

const PAGE_SIZE = 20

export function AdminOrdersPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [statusTab, setStatusTab] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Force cancel (Task 59-b) — the one admin lever on this page ────────
  const [forceTarget, setForceTarget] = useState<ApiOrder | null>(null)
  const [forceReason, setForceReason] = useState('')
  const [forceBusy, setForceBusy] = useState(false)

  // ── Record verified payment (Task 128-b) — the other real admin lever ──
  // POST /api/admin/orders/[id]/verify-payment: admin CONFIRMED the money
  // arrived (paper-receipt B2B flow) and records it — payments row 'success',
  // order flips PAID, audit-logged. Amount is ALWAYS the order total
  // (server-enforced ±0.01); the transactionId is globally unique.
  const [verifyTarget, setVerifyTarget] = useState<ApiOrder | null>(null)
  const [verifyTrxId, setVerifyTrxId] = useState('')
  const [verifyMethod, setVerifyMethod] = useState<'bank_transfer' | 'mobile_banking'>('bank_transfer')
  const [verifyNote, setVerifyNote] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const loadOrders = useCallback(async (opts?: { status?: string; q?: string; page?: number }) => {
    const useStatus = opts?.status ?? statusTab
    const useQ = opts?.q ?? q
    const usePage = opts?.page ?? page
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const params = new URLSearchParams({
        paymentStatus: 'all', // fulfillment view sees every order; the payments queue keeps its own 'unpaid' default
        status: useStatus,
        page: String(usePage),
        limit: String(PAGE_SIZE),
      })
      if (useQ) params.set('q', useQ)
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setNeedsAuth(true); setOrders([]); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load orders (HTTP ${res.status})`)
        setOrders([])
        return
      }
      setOrders(Array.isArray(json.data?.orders) ? json.data.orders : [])
      setTotalPages(json.data?.pagination?.totalPages || 0)
      setTotal(json.data?.pagination?.total || 0)
    } catch {
      setError('Network error while loading orders. Check your connection and retry.')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [statusTab, q, page])

  useEffect(() => { loadOrders() }, [loadOrders])

  const confirmForceCancel = useCallback(async () => {
    if (!forceTarget) return
    setForceBusy(true)
    try {
      const reason = forceReason.trim()
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(forceTarget.id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(reason ? { reason } : {}),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error || `Force cancel failed (HTTP ${res.status})`)
        return
      }
      const d = body?.data
      toast.success(`Order #${d?.orderNumber ?? forceTarget.orderNumber} force-cancelled`, {
        description: `${d?.subOrdersCancelled ?? 0} shipment(s) cancelled · ${d?.paymentsFailed ?? 0} pending reference(s) voided · ${d?.paymentsRefunded ?? 0} verified payment(s) marked refunded (৳${d?.refundedAmount ?? 0}) · stock restored`,
      })
      setForceTarget(null)
      setForceReason('')
      loadOrders()
    } catch {
      toast.error('Network error while force-cancelling the order')
    } finally {
      setForceBusy(false)
    }
  }, [forceTarget, forceReason, loadOrders])

  // Task 128-b: record a VERIFIED payment on an unpaid order — the paper-
  // receipt B2B leg of the payment doctrine. Fires only with a valid
  // transaction reference; the server enforces amount === order.totalAmount
  // and globally-unique transactionIds, and audit-logs the verifier's id.
  const confirmVerifyPayment = useCallback(async () => {
    if (!verifyTarget) return
    const trx = verifyTrxId.trim()
    if (!/^[A-Za-z0-9\-_]{6,64}$/.test(trx)) {
      setVerifyError('Transaction ID must be 6-64 characters (letters, numbers, dash or underscore).')
      return
    }
    setVerifyBusy(true)
    setVerifyError('')
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(verifyTarget.id)}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transactionId: trx,
          method: verifyMethod,
          amount: verifyTarget.totalAmount,
          ...(verifyNote.trim() ? { note: verifyNote.trim() } : {}),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setVerifyError(body?.error || `Verification failed (HTTP ${res.status})`)
        return
      }
      toast.success(`Order #${body?.data?.orderNumber ?? verifyTarget.orderNumber} marked PAID`, {
        description: `Transaction ${trx} recorded — audit-logged with your admin id.`,
      })
      setVerifyTarget(null)
      setVerifyTrxId('')
      setVerifyNote('')
      loadOrders()
    } catch {
      setVerifyError('Network error while recording the payment. Check your connection and retry.')
    } finally {
      setVerifyBusy(false)
    }
  }, [verifyTarget, verifyTrxId, verifyMethod, verifyNote, loadOrders])

  const switchStatus = (s: string) => {
    setStatusTab(s)
    setPage(1)
    setExpandedId(null)
    loadOrders({ status: s, page: 1 })
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">This fulfillment view is restricted to Zylod admins. Sign in with an admin account to audit orders across the platform.</p>
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
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Orders — Fulfillment View</h1>
            <p className="text-[11px] text-slate-400">Every order on the platform with its real per-shipment status. Fulfillment moves happen seller-side; this is the admin oversight view.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadOrders()} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Status tabs (REAL subOrders.status values) + search */}
      <div className="flex flex-wrap items-center gap-2">
        {ORDER_STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchStatus(t.key)}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${statusTab === t.key ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
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
          <h2 className="text-sm font-black">Could not load orders</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadOrders()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {q ? (
            <>
              <Package className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No orders match &quot;{q}&quot;</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">Search matches the order number and the buyer&apos;s email. Try a different term or clear the search.</p>
            </>
          ) : statusTab !== 'all' ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-sm font-black">No {statusTab} shipments</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">No order currently has a shipment in the &quot;{statusTab}&quot; state. Sellers move shipments through pending → confirmed → packed → shipped → delivered; cancelled and returned are terminal.</p>
            </>
          ) : (
            <>
              <Package className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No orders yet</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">Orders appear here the moment buyers check out. Nothing has been ordered platform-wide yet.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
          {orders.map((o) => {
            const isExpanded = expandedId === o.id
            const subOrders = Array.isArray(o.subOrders) ? o.subOrders : []
            return (
              <div key={o.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <ShoppingBag className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-black">#{o.orderNumber}</span>
                  </div>
                  <div className="min-w-[150px] text-xs text-slate-500 dark:text-slate-400">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{o.buyer?.name || '—'}</p>
                    <p className="truncate">{o.buyer?.email || 'no email on account'}</p>
                  </div>
                  <div className="text-right min-w-[110px] ml-auto">
                    <p className="text-sm font-black text-primary">{formatPrice(o.totalAmount)}</p>
                    <PaymentChip status={o.paymentStatus} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 min-w-[130px]">
                    <span className={chipClass}>{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</span>
                    <span className={chipClass}>{o.subOrderCount} shipment{o.subOrderCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 min-w-[90px]">
                    {new Date(o.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="block">placed</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}
                    className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
                  >
                    {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Hide shipments</> : <><ChevronDown className="h-3.5 w-3.5" /> Shipments</>}
                  </Button>
                </div>

                {/* Per-subOrder status summary */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Per-shipment status (real subOrders.status)</p>
                    {subOrders.length === 0 ? (
                      <p className="text-xs text-slate-500">This order has no shipments recorded — it may predate the split-order model.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {subOrders.map((s) => (
                          <span key={s.id} className="flex items-center gap-1.5">
                            <SubOrderChip sub={s} />
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <Boxes className="h-3 w-3" /> {o.subOrderCount} shipment{o.subOrderCount === 1 ? '' : 's'} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'} across all shipments
                      <Truck className="h-3 w-3 ml-2" /> status changes are made by the selling supplier and appear here after their next edit
                    </p>
                    {subOrders.some((s) => s.status !== 'cancelled') && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={() => { setForceReason(''); setForceTarget(o) }}
                          className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Ban className="h-3.5 w-3.5" /> Force cancel order
                        </Button>
                      </div>
                    )}
                    {(o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial') && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={() => { setVerifyTrxId(''); setVerifyMethod('bank_transfer'); setVerifyNote(''); setVerifyError(''); setVerifyTarget(o) }}
                          className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" /> Record verified payment
                        </Button>
                      </div>
                    )}
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
                <Button variant="outline" disabled={page <= 1} onClick={() => { const np = page - 1; setPage(np); loadOrders({ page: np }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const np = page + 1; setPage(np); loadOrders({ page: np }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Force-cancel confirm (Task 59-b) — verbatim doctrine before the lever fires */}
      <AlertDialog open={forceTarget !== null} onOpenChange={(open) => { if (!open) setForceTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force cancel order #{forceTarget?.orderNumber ?? ''}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs">
                <p>
                  Every active shipment is cancelled in its CURRENT state — pending, packed, shipped or delivered.
                  Goods already on the road must be physically recovered outside the system.
                </p>
                <p>
                  Pending payment references are voided. Verified money is marked refunded
                  (the real transfer happens outside this system) and the order shows refunded.
                  Stock is restored for every cancelled item.
                </p>
                <Input
                  value={forceReason}
                  onChange={(e) => setForceReason(e.target.value)}
                  placeholder="Reason (optional, audit-logged)"
                  maxLength={500}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={forceBusy} onClick={() => setForceTarget(null)} className="h-10 px-4 rounded-xl text-xs font-bold">Keep order</Button>
            <Button disabled={forceBusy} onClick={() => void confirmForceCancel()} className="h-10 px-4 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white">
              {forceBusy ? 'Cancelling…' : 'Force cancel'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task 128-b: record a VERIFIED payment — paper-receipt B2B leg of the
          payment doctrine. Only after the money has actually arrived. */}
      <Dialog open={verifyTarget !== null} onOpenChange={(open) => { if (!open && !verifyBusy) setVerifyTarget(null) }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600" /> Record verified payment — #{verifyTarget?.orderNumber ?? ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record this only after you have CONFIRMED the money arrived in the company account (bank transfer with a paper receipt, or a mobile-wallet transfer). The order is marked PAID immediately and the action is audit-logged with your admin id.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">Order total (recorded amount must match exactly)</span>
              <span className="text-lg font-black text-primary">{formatPrice(verifyTarget?.totalAmount ?? 0)}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Method *</label>
              <select
                value={verifyMethod}
                onChange={(e) => setVerifyMethod(e.target.value as 'bank_transfer' | 'mobile_banking')}
                className="h-10 w-full rounded-xl border border-input bg-white dark:bg-slate-900 px-3 text-xs font-bold"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_banking">Mobile banking</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Transaction / reference ID *</label>
              <Input
                value={verifyTrxId}
                onChange={(e) => setVerifyTrxId(e.target.value)}
                placeholder="e.g. bank reference or bKash TrxID (6-64)"
                className="h-10 rounded-xl text-xs"
                maxLength={64}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Note (optional)</label>
              <Input
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder="e.g. paper receipt #4821 verified at branch"
                className="h-10 rounded-xl text-xs"
                maxLength={300}
              />
            </div>

            {verifyError && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {verifyError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={verifyBusy} onClick={() => setVerifyTarget(null)} className="h-10 px-4 rounded-xl text-xs font-bold">
              Cancel
            </Button>
            <Button
              onClick={() => void confirmVerifyPayment()}
              disabled={verifyBusy || !verifyTrxId.trim()}
              className="h-10 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {verifyBusy ? 'Recording…' : 'Record & mark PAID'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminOrdersPage
