'use client'

/**
 * Admin RFQ — oversight view over the real RFQ chain (Task 52-d).
 *
 * Consumes the two admin contracts:
 *   GET  /api/admin/rfqs        — ?status=<open|quoted|awarded|closed|expired>&page&limit
 *                                 (+ whole-table stats: the 5 real statuses + total)
 *   GET  /api/admin/rfqs/[id]   — full detail (items + quotes with supplier names)
 *   PATCH /api/admin/rfqs/[id]  — the ONLY admin write: close an open|quoted RFQ
 *                                 (awarded/closed/expired are final → real 409)
 *
 * rfqRequests.status real values: open | quoted | awarded | closed | expired
 * (prisma/schema.prisma). The tabs/stats below are built from exactly those —
 * nothing is filtered client-side so counts and pagination stay real.
 *
 * The list rows deliberately carry no supplier identities (privacy-minimal
 * list contract); expanding a row fetches the detail endpoint, which shows
 * every real item and quote with the supplier's companyName. No fabricated
 * numbers anywhere — empty states are honest, errors are verbatim.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { toast } from 'sonner'
import {
  ClipboardList, RefreshCw, AlertTriangle, CheckCircle2, Inbox, ChevronDown, ChevronUp,
  Package, User, Truck, XCircle, CalendarClock, FileText,
} from 'lucide-react'

// ── Real API types (GET /api/admin/rfqs · GET/PATCH /api/admin/rfqs/[id]) ──
interface ApiRfqRow {
  id: string
  title: string
  status: string
  quantity: number | null
  unit: string
  targetPrice: number | null
  deliveryCity: string | null
  deadline: string | null
  createdAt: string
  buyer: { displayName: string | null }
  itemCount: number
  quoteCount: number
  bestQuote: { min: number | null; max: number | null }
}

interface ApiRfqStats {
  open: number
  quoted: number
  awarded: number
  closed: number
  expired: number
  total: number
}

interface ApiRfqItem {
  id: string
  productName: string
  specifications: string | null
  quantity: number
  unit: string
  targetPrice: number | null
}

interface ApiRfqQuote {
  id: string
  pricePerUnit: number
  totalPrice: number
  deliveryDays: number | null
  message: string | null
  status: string
  createdAt: string
  supplier: { displayName: string }
}

interface ApiRfqDetail {
  id: string
  buyerId: string
  title: string
  description: string
  categorySlug: string | null
  quantity: number | null
  unit: string
  targetPrice: number | null
  deliveryCity: string | null
  deadline: string | null
  status: string
  createdAt: string
  updatedAt: string
  buyer: { displayName: string | null }
  items: ApiRfqItem[]
  quotes: ApiRfqQuote[]
}

/** REAL rfqRequests.status values (prisma/schema.prisma) — no invented states. */
const RFQ_STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'awarded', label: 'Awarded' },
  { key: 'closed', label: 'Closed' },
  { key: 'expired', label: 'Expired' },
]

const REFRESH_INTERVAL_MS = 30_000
const PAGE_SIZE = 20

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

// RFQ status → chip tone (real statuses only)
const rfqStatusChip: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  quoted: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  awarded: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  closed: 'bg-slate-100 text-slate-600 dark:text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
  expired: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
}

// Quote status → chip tone (pending | accepted | rejected — real rfqQuotes.status)
const quoteStatusChip: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
}

function RfqStatusChip({ status }: { status: string }) {
  const cls = rfqStatusChip[status] ?? chipClass
  return <span className={`text-[10px] font-black border rounded-lg px-2 py-1 uppercase tracking-wide ${cls}`}>{status}</span>
}

function QuoteStatusChip({ status }: { status: string }) {
  const cls = quoteStatusChip[status] ?? chipClass
  return <span className={`text-[10px] font-black border rounded-lg px-2 py-1 uppercase tracking-wide ${cls}`}>{status}</span>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AdminRfqPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [rows, setRows] = useState<ApiRfqRow[]>([])
  const [stats, setStats] = useState<ApiRfqStats | null>(null)
  const [statusTab, setStatusTab] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Detail fetch state for the expanded row (cached per id in a ref)
  const [detail, setDetail] = useState<ApiRfqDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const detailCacheRef = useRef<Map<string, ApiRfqDetail>>(new Map())

  // Close dialog state (no optimistic moves — server response applied on 200)
  const [closeTarget, setCloseTarget] = useState<ApiRfqRow | null>(null)
  const [closeError, setCloseError] = useState('')
  const [closing, setClosing] = useState(false)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = closeTarget !== null
  }, [closeTarget])

  const loadRfqs = useCallback(async (opts?: { status?: string; page?: number; background?: boolean }) => {
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
      setRefreshError('')
    }
    try {
      const params = new URLSearchParams({ page: String(usePage), limit: String(PAGE_SIZE) })
      // 'all' → omit the param; the route only accepts the 5 real status values
      if (useStatus !== 'all') params.set('status', useStatus)
      const res = await fetch(`/api/admin/rfqs?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setRows([]); setStats(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load RFQs (HTTP ${res.status})`
        apply(() => {
          if (background) setRefreshError(msg)
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
      const msg = 'Network error while loading RFQs. Check your connection and retry.'
      apply(() => { if (background) setRefreshError(msg); else { setError(msg); setRows([]); setStats(null) } })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [statusTab, page])

  useEffect(() => { loadRfqs() }, [loadRfqs])

  // Auto-refresh every 30s (cleared on unmount, paused while the close dialog is open)
  useEffect(() => {
    const id = setInterval(() => { if (!dialogOpenRef.current) loadRfqs({ background: true }) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadRfqs])

  const switchStatus = (s: string) => {
    setStatusTab(s)
    setPage(1)
    setExpandedId(null)
    setDetail(null)
    setDetailError('')
    loadRfqs({ status: s, page: 1 })
  }

  const loadDetail = useCallback(async (rfqId: string) => {
    const cached = detailCacheRef.current.get(rfqId)
    if (cached) {
      setDetail(cached)
      setDetailError('')
      return
    }
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    try {
      const res = await fetch(`/api/admin/rfqs/${rfqId}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setNeedsAuth(true); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setDetailError(json?.error || `Failed to load RFQ detail (HTTP ${res.status})`)
        return
      }
      const data = json.data as ApiRfqDetail
      detailCacheRef.current.set(rfqId, data)
      setDetail(data)
    } catch {
      setDetailError('Network error while loading the RFQ detail. Check your connection and retry.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      setDetailError('')
      return
    }
    setExpandedId(id)
    loadDetail(id)
  }

  const openCloseDialog = (rfq: ApiRfqRow) => {
    setCloseTarget(rfq)
    setCloseError('')
  }

  const closeDialog = () => {
    setCloseTarget(null)
    setCloseError('')
  }

  const submitClose = async () => {
    if (!closeTarget) return
    setClosing(true)
    setCloseError('')
    try {
      const res = await fetch(`/api/admin/rfqs/${closeTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'closed' }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error, verbatim (409 status conflict, 400 validation, 401 …)
        const msg = json?.error || `Action failed (HTTP ${res.status})`
        setCloseError(msg)
        toast.error(msg)
        return
      }
      // Real 2xx — drop the stale cached detail (status changed), toast, refetch.
      detailCacheRef.current.delete(closeTarget.id)
      toast.success('RFQ closed. Watchers in its room were notified in real time.')
      closeDialog()
      loadRfqs({ background: true })
      if (expandedId === closeTarget.id) loadDetail(closeTarget.id)
    } catch {
      const msg = 'Network error while closing the RFQ. Check your connection and retry.'
      setCloseError(msg)
      toast.error(msg)
    } finally {
      setClosing(false)
    }
  }

  const statCount = (key: string): number | null => {
    if (!stats) return null
    if (key === 'all') return stats.total
    return stats[key] ?? 0
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">RFQ oversight is restricted to Zylod admins. Sign in with an admin account to audit quote requests across the platform.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950 border border-violet-100 dark:border-violet-900 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Quote Requests — RFQ Oversight</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Every RFQ on the platform with its real quotes. Closing is the only admin write — it is audit-logged and broadcast to the RFQ&apos;s room.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {refreshing && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">auto-refreshes every 30s</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadRfqs({ background: true })}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 dark:border-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats strip — whole-table groupBy counts, clickable as filter chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {RFQ_STATUS_TABS.map((t) => {
          const n = statCount(t.key)
          const active = statusTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => switchStatus(t.key)}
              className={`rounded-2xl border px-4 py-3 text-left transition min-h-11 ${active ? 'border-primary bg-primary/5 shadow-md' : 'bg-white dark:bg-gray-900 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
            >
              <p className={`text-lg font-black tabular-nums ${active ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>{n == null ? '—' : n.toLocaleString('en-BD')}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t.label}</p>
            </button>
          )
        })}
      </div>

      {/* Status tabs (REAL rfqRequests.status values) with live counts */}
      <div className="flex flex-wrap items-center gap-2">
        {RFQ_STATUS_TABS.map((t) => {
          const n = statCount(t.key)
          return (
            <button
              key={t.key}
              onClick={() => switchStatus(t.key)}
              className={`min-h-11 px-4 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${statusTab === t.key ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-gray-900 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
            >
              {t.label}
              <span className={`tabular-nums ${statusTab === t.key ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>{n == null ? '' : n.toLocaleString('en-BD')}</span>
            </button>
          )
        })}
      </div>

      {/* Verbatim refresh error (last good data — even an honest empty list — stays on screen) */}
      {refreshError && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-2xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{refreshError}</span>
          <button onClick={() => loadRfqs({ background: true })} className="ml-auto underline underline-offset-2 shrink-0">Retry</button>
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load RFQs</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadRfqs()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        // Honest empty state — the DB truly has zero (or zero matching) RFQs
        <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {statusTab !== 'all' ? (
            <>
              <CheckCircle2 className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
              <h2 className="text-sm font-black">No {statusTab} RFQs</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                No request for quotes currently has status &ldquo;{statusTab}&rdquo;. Switch to All to see every RFQ in the database.
              </p>
            </>
          ) : (
            <>
              <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <h2 className="text-sm font-black">No RFQs yet</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                The rfqRequests table currently holds zero rows — real counts, not a placeholder. When a buyer requests a quote it will appear here for oversight.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
          {rows.map((r) => {
            const isExpanded = expandedId === r.id
            const canClose = r.status === 'open' || r.status === 'quoted'
            const best = r.bestQuote
            return (
              <div key={r.id} className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[200px] max-w-[320px]">
                    <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{r.title}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" /> {r.buyer.displayName ?? 'buyer name unavailable'}
                      </p>
                    </div>
                  </div>
                  <RfqStatusChip status={r.status} />
                  <div className="flex flex-wrap items-center gap-1.5 min-w-[120px]">
                    <span className={chipClass}>{r.itemCount} item{r.itemCount === 1 ? '' : 's'}</span>
                    <span className={chipClass}>{r.quoteCount} quote{r.quoteCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="min-w-[130px]">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">Target</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{r.targetPrice != null ? formatPrice(r.targetPrice) : '—'} <span className="text-slate-400 dark:text-slate-500 font-normal">/ {r.unit}</span></p>
                  </div>
                  <div className="min-w-[130px]">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">Best quote total</p>
                    {best.min != null && best.max != null ? (
                      <p className="text-xs font-bold text-primary">
                        {best.min === best.max ? formatPrice(best.min) : `${formatPrice(best.min)} – ${formatPrice(best.max)}`}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">no quotes yet</p>
                    )}
                  </div>
                  <div className="min-w-[90px] text-[10px] text-slate-400 dark:text-slate-500">
                    {r.deadline ? (
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3 shrink-0" /> due {formatDate(r.deadline)}</span>
                    ) : (
                      <span>no deadline</span>
                    )}
                    <span className="block">posted {formatDate(r.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {canClose && (
                      <Button
                        variant="outline"
                        onClick={() => openCloseDialog(r)}
                        disabled={closing}
                        className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Close
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => toggleExpand(r.id)}
                      className="min-h-11 px-4 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 dark:border-slate-700"
                    >
                      {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Hide detail</> : <><ChevronDown className="h-3.5 w-3.5" /> Detail</>}
                    </Button>
                  </div>
                </div>

                {/* Expanded detail — real items + quotes from GET /api/admin/rfqs/[id] */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-3">
                    {detailLoading ? (
                      <div className="space-y-2">
                        <div className="h-12 bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
                        <div className="h-12 bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
                      </div>
                    ) : detailError ? (
                      <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2 text-xs text-red-600 dark:text-red-400 font-bold">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="break-words flex-1">{detailError}</span>
                        <button onClick={() => loadDetail(r.id)} className="underline underline-offset-2 shrink-0">Retry</button>
                      </div>
                    ) : detail ? (
                      <>
                        <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 break-words whitespace-pre-wrap">{detail.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={chipClass}>{detail.quantity != null ? `${detail.quantity.toLocaleString('en-BD')} ${detail.unit}` : 'quantity not set'}</span>
                          <span className={chipClass}>{detail.deliveryCity ?? 'no delivery city'}</span>
                          {detail.categorySlug && <span className={chipClass}>category: {detail.categorySlug}</span>}
                          <span className={chipClass}>buyer: {detail.buyer.displayName ?? 'name unavailable'}</span>
                        </div>

                        {/* Items — real rfqItems */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Requested items ({detail.items.length})</p>
                          {detail.items.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">This RFQ has no line items — the buyer described the request in the text above.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {detail.items.map((it) => (
                                <div key={it.id} className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-900 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2">
                                  <Package className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{it.productName}</p>
                                  <span className={chipClass}>{it.quantity.toLocaleString('en-BD')} {it.unit}</span>
                                  {it.targetPrice != null && <span className={chipClass}>target {formatPrice(it.targetPrice)}</span>}
                                  {it.specifications && <p className="text-[10px] text-slate-400 dark:text-slate-500 w-full break-words whitespace-pre-wrap">spec: {it.specifications}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Quotes — real rfqQuotes with supplier displayName */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Supplier quotes ({detail.quotes.length})</p>
                          {detail.quotes.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No supplier has quoted this RFQ yet.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {detail.quotes.map((q) => (
                                <div key={q.id} className="bg-white dark:bg-gray-900 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Truck className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{q.supplier.displayName}</p>
                                    <QuoteStatusChip status={q.status} />
                                    <span className="ml-auto text-xs font-black text-primary">{formatPrice(q.totalPrice)} <span className="font-normal text-slate-400 dark:text-slate-500">total · {formatPrice(q.pricePerUnit)}/unit</span></span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={chipClass}>{q.deliveryDays != null ? `${q.deliveryDays} day${q.deliveryDays === 1 ? '' : 's'} delivery` : 'delivery days not stated'}</span>
                                    <span className={chipClass}>quoted {formatDate(q.createdAt)}</span>
                                  </div>
                                  {q.message && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 break-words whitespace-pre-wrap">&ldquo;{q.message}&rdquo;</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{total} RFQ{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const np = page - 1; setPage(np); loadRfqs({ page: np }) }} className="min-h-11 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const np = page + 1; setPage(np); loadRfqs({ page: np }) }} className="min-h-11 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Close confirmation dialog — the only admin write on an RFQ */}
      <Dialog open={closeTarget !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          {closeTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" /> Close this RFQ?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Closing stops the quote round: no further quotes can land and the buyer cannot award it. The decision is audit-logged and broadcast live to everyone watching this RFQ. Awarded, closed, and expired RFQs cannot be closed.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 break-words">
                  <span className="font-black">{closeTarget.title}</span> · {closeTarget.quoteCount} quote{closeTarget.quoteCount === 1 ? '' : 's'} so far · buyer {closeTarget.buyer.displayName ?? 'name unavailable'}
                </div>

                {closeError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {closeError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={closing} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 dark:border-slate-700">
                  Cancel
                </Button>
                <Button
                  onClick={submitClose}
                  disabled={closing}
                  className="min-h-11 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700"
                >
                  {closing ? 'Closing…' : 'Confirm close'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminRfqPage
