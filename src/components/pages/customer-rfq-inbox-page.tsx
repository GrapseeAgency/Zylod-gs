'use client'

/**
 * Customer RFQ Inbox — the SELLER's view of buyer quote requests (Task 51-d).
 *
 * This page was a static stub with an invented "5000x Cotton T-Shirts" card
 * and zero fetches. It is now wired to the real seller RFQ inbox APIs:
 *   - GET /api/supplier/rfqs      (list: ?status=<open|quoted|awarded|closed|expired|all>,
 *                                  ?q= title search, ?page/?limit, admin ?all=true)
 *   - GET /api/supplier/rfqs/[id] (full detail, fetched on expand)
 *
 * Linkage truth (prisma/schema.prisma): rfqRequests has NO supplierId column —
 * RFQs are marketplace-open, so every seller sees the same open requests.
 * Buyer identity is LIMITED to buyerProfiles.fullName (privacy rule from
 * Task 50) — no email/phone crosses this boundary.
 *
 * HONEST LIMITATION: nothing in the codebase writes rfqQuotes rows (verified
 * by grep), so sellers cannot respond with a quote yet. This inbox is
 * read-only and says so — no fake respond button.
 *
 * Status tabs are built ONLY from the real rfqRequests.status values
 * (open | quoted | awarded | closed | expired) and filter server-side.
 * All fetches use credentials:'include'; auth-first 401 → sign-in gate,
 * 403 (no supplier profile) → access gate with the verbatim server message.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  FileText, Search, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  Inbox, X, CalendarClock, Layers, Quote, Lock, LogIn,
} from 'lucide-react'

/* ─── Real API types (GET /api/supplier/rfqs) ──────────────────────────── */

interface ApiRfqItem {
  id: string
  productName: string
  specifications: string | null
  quantity: number
  unit: string
  targetPrice: number | null
}

interface ApiRfq {
  id: string
  title: string
  description: string
  categorySlug: string | null
  quantity: number | null
  unit: string
  targetPrice: number | null
  deliveryCity: string | null
  deadline: string | null
  status: string
  itemCount: number
  quoteCount: number
  buyer: { displayName: string | null }
  items: ApiRfqItem[]
  createdAt: string
  updatedAt: string
}

/** REAL rfqRequests.status values (prisma/schema.prisma) — no invented states. */
const RFQ_STATUS_TABS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'awarded', label: 'Awarded' },
  { key: 'closed', label: 'Closed' },
  { key: 'expired', label: 'Expired' },
  { key: 'all', label: 'All' },
]

const statusChipClass: Record<string, string> = {
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  quoted: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  awarded: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-900',
  closed: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
  expired: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
}

function StatusChip({ status }: { status: string }) {
  const cls = statusChipClass[status] ?? statusChipClass.closed
  return (
    <span className={`shrink-0 text-[10px] font-bold border rounded-lg px-2 py-1 uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  )
}

function ageOf(iso: string | Date): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function fmtDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PAGE_SIZE = 20

export function CustomerRfqInboxPage() {
  const { navigate } = useNavigationStore()
  const { user } = useAuthStore()
  const { formatPrice } = useCurrencyStore()
  const isAdmin = user?.userType === 'admin'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [accessDenied, setAccessDenied] = useState('')
  const [rfqs, setRfqs] = useState<ApiRfq[]>([])
  const [statusTab, setStatusTab] = useState('open')
  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Mirrors expandedId for async checks (state would be stale inside the fetch closure)
  const expandedIdRef = useRef<string | null>(null)

  // Detail fetch state per expanded id (real GET /api/supplier/rfqs/[id])
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<{ id: string; message: string } | null>(null)
  const [detail, setDetail] = useState<ApiRfq | null>(null)
  const seqRef = useRef(0)

  const loadRfqs = useCallback(async (opts?: { status?: string; q?: string; page?: number }) => {
    const useStatus = opts?.status ?? statusTab
    const useQ = opts?.q ?? appliedQ
    const usePage = opts?.page ?? page
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    setAccessDenied('')
    try {
      const params = new URLSearchParams({
        page: String(usePage),
        limit: String(PAGE_SIZE),
      })
      if (useStatus === 'all') {
        // Admins get everything via ?all=true; suppliers use the real status=all filter.
        if (isAdmin) params.set('all', 'true')
        else params.set('status', 'all')
      } else {
        params.set('status', useStatus)
      }
      if (useQ) params.set('q', useQ)
      const res = await fetch(`/api/supplier/rfqs?${params.toString()}`, { credentials: 'include' })
      if (seq !== seqRef.current) return // a newer request superseded this one
      if (res.status === 401) { setNeedsAuth(true); setRfqs([]); return }
      const json = await res.json().catch(() => null)
      if (res.status === 403) {
        setAccessDenied(json?.error || `Access denied (HTTP 403)`)
        setRfqs([])
        return
      }
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load quote requests (HTTP ${res.status})`)
        setRfqs([])
        return
      }
      setRfqs(Array.isArray(json.data) ? json.data : [])
      setTotalPages(json.pagination?.totalPages || 0)
      setTotal(json.pagination?.total || 0)
    } catch {
      if (seq === seqRef.current) {
        setError('Network error while loading quote requests. Check your connection and retry.')
        setRfqs([])
      }
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [statusTab, appliedQ, page, isAdmin])

  useEffect(() => { loadRfqs() }, [loadRfqs])

  const switchTab = (key: string) => {
    setStatusTab(key)
    setPage(1)
    setExpandedId(null)
    expandedIdRef.current = null
    setDetail(null)
    setDetailError(null)
    loadRfqs({ status: key, page: 1 })
  }

  const submitSearch = () => {
    setPage(1)
    setAppliedQ(q.trim())
    setExpandedId(null)
    expandedIdRef.current = null
    setDetail(null)
    setDetailError(null)
    loadRfqs({ q: q.trim(), page: 1 })
  }

  const clearSearch = () => {
    setQ('')
    setAppliedQ('')
    setPage(1)
    setExpandedId(null)
    expandedIdRef.current = null
    setDetail(null)
    setDetailError(null)
    loadRfqs({ q: '', page: 1 })
  }

  const toggleExpand = async (rfq: ApiRfq) => {
    if (expandedIdRef.current === rfq.id) {
      expandedIdRef.current = null
      setExpandedId(null)
      setDetail(null)
      setDetailError(null)
      return
    }
    expandedIdRef.current = rfq.id
    setExpandedId(rfq.id)
    setDetailError(null)
    setDetailLoadingId(rfq.id)
    try {
      const res = await fetch(`/api/supplier/rfqs/${rfq.id}`, { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (expandedIdRef.current !== rfq.id) return // user collapsed/switched away mid-flight
      if (!res.ok || !json?.success) {
        setDetailError({ id: rfq.id, message: json?.error || `Failed to load details (HTTP ${res.status})` })
        setDetail(null)
      } else {
        setDetail(json.data as ApiRfq)
      }
    } catch {
      setDetailError({ id: rfq.id, message: 'Network error while loading details.' })
      setDetail(null)
    } finally {
      setDetailLoadingId(null)
    }
  }

  const fmtQty = (qty: number | null, unit: string) =>
    typeof qty === 'number' ? `${qty.toLocaleString()} ${unit}` : null

  const totalUnitsFromItems = (items: ApiRfqItem[]): number =>
    items.reduce((sum, it) => sum + (Number.isFinite(it.quantity) ? it.quantity : 0), 0)

  /* ─── Guard states ─────────────────────────────────────────────────── */
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <LogIn className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Seller sign-in required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">Sign in with a seller account to see buyers&apos; quote requests. Admin accounts can review all requests too.</p>
        <Button onClick={() => navigate('login')} className="min-h-11 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <Lock className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Seller access required</h1>
        <p className="text-xs text-red-600 dark:text-red-400 max-w-md mx-auto break-words">{accessDenied}</p>
        <Button onClick={() => navigate('login')} variant="outline" className="min-h-11 px-5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700">Switch Account</Button>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Quote Requests — RFQ Inbox</h1>
            <p className="text-[11px] text-slate-400">Buyer sourcing requests are marketplace-open: every seller sees the same open requests. Read-only — quote responses are not supported by the platform yet.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadRfqs()} className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Status tabs (REAL rfqRequests.status values) + title search */}
      <div className="flex flex-wrap items-center gap-2">
        {RFQ_STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`min-h-11 px-4 rounded-xl text-xs font-bold transition ${statusTab === t.key ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
            placeholder="Search by title…"
            className="h-11 pl-9 pr-8 rounded-xl text-xs"
            aria-label="Search quote requests by title"
          />
          {q && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading quote requests">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load quote requests</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadRfqs()} variant="outline" className="min-h-11 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : rfqs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {appliedQ ? (
            <>
              <Search className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No requests match &quot;{appliedQ}&quot;</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">Search matches the request title. Try a different term or clear the search.</p>
            </>
          ) : statusTab !== 'all' ? (
            <>
              <Inbox className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">{statusTab === 'open' ? 'No open quote requests right now' : `No ${statusTab} requests`}</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {statusTab === 'open'
                  ? 'When buyers post new sourcing requests they appear here for every seller — nothing is open at this moment. Check the other tabs for requests already quoted or closed.'
                  : `No request currently sits in the "${statusTab}" state. Move between the tabs to see the real distribution.`}
              </p>
            </>
          ) : (
            <>
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No quote requests yet</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">Buyers have not posted any RFQs platform-wide yet. Requests appear here the moment they are submitted via Request a Quote.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
          {rfqs.map((rfq) => {
            const isExpanded = expandedId === rfq.id
            const shown = isExpanded && detail && detail.id === rfq.id ? detail : rfq
            const qtyLabel = fmtQty(shown.quantity, shown.unit)
            const items = Array.isArray(shown.items) ? shown.items : []
            const deadline = shown.deadline ? new Date(shown.deadline) : null
            const overdue = deadline != null && deadline.getTime() < Date.now() && shown.status === 'open'
            return (
              <div key={rfq.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-black leading-snug line-clamp-2 flex-1">{shown.title}</span>
                      <StatusChip status={shown.status} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {shown.buyer?.displayName || 'Buyer name unavailable'}
                      <span className="mx-1.5">·</span>
                      {ageOf(shown.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 min-w-[150px]">
                    <span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                      {shown.itemCount} item{shown.itemCount === 1 ? '' : 's'}
                    </span>
                    <span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                      {qtyLabel || `${totalUnitsFromItems(items).toLocaleString()} ${shown.unit} in items`}
                    </span>
                    {typeof shown.targetPrice === 'number' && (
                      <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg px-2 py-1 text-amber-700 dark:text-amber-400">
                        target {formatPrice(shown.targetPrice)}
                      </span>
                    )}
                    {deadline && (
                      <span className={`text-[10px] font-bold border rounded-lg px-2 py-1 inline-flex items-center gap-1 ${overdue ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <CalendarClock className="h-3 w-3" />
                        {overdue ? 'overdue' : 'due'} {fmtDate(deadline)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => toggleExpand(rfq)}
                    className="min-h-11 px-4 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Hide</> : <><ChevronDown className="h-3.5 w-3.5" /> Details</>}
                  </Button>
                </div>

                {/* Expanded detail — real GET /api/supplier/rfqs/[id] */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-3">
                    {detailLoadingId === rfq.id ? (
                      <div className="space-y-2" role="status" aria-label="Loading details">
                        <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                      </div>
                    ) : detailError && detailError.id === rfq.id ? (
                      <div className="text-xs text-red-600 dark:text-red-400 space-y-2">
                        <p className="break-words">{detailError.message}</p>
                        <Button variant="outline" onClick={() => toggleExpand(rfq)} className="min-h-11 px-4 rounded-xl text-xs font-bold gap-2">
                          <RefreshCw className="h-3.5 w-3.5" /> Retry
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Buyer: <span className="font-bold text-slate-700 dark:text-slate-300">{shown.buyer?.displayName || 'Buyer name unavailable'}</span></span>
                          {shown.deliveryCity && <span>Delivery city: <span className="font-bold text-slate-700 dark:text-slate-300">{shown.deliveryCity}</span></span>}
                          {shown.categorySlug && <span>Category: <span className="font-bold text-slate-700 dark:text-slate-300">{shown.categorySlug}</span></span>}
                          <span>Quotes so far: <span className="font-bold text-slate-700 dark:text-slate-300">{shown.quoteCount}</span></span>
                        </div>
                        {shown.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line break-words">{shown.description}</p>
                        )}

                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                            <Layers className="h-3 w-3" /> Requested items ({items.length})
                          </p>
                          {items.length === 0 ? (
                            <p className="text-xs text-slate-500">No line items on this request — the buyer described the need in the summary only.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {items.map((it) => (
                                <div key={it.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex-1 min-w-[140px]">{it.productName}</span>
                                  {it.specifications && <span className="text-[10px] text-slate-500 dark:text-slate-400 flex-1 min-w-[140px] break-words">{it.specifications}</span>}
                                  <span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400">
                                    {it.quantity.toLocaleString()} {it.unit}
                                  </span>
                                  {typeof it.targetPrice === 'number' && (
                                    <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg px-2 py-1 text-amber-700 dark:text-amber-400">
                                      target {formatPrice(it.targetPrice)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* HONEST LIMITATION — no rfqQuotes writer exists platform-wide. */}
                        <p className="text-[10px] text-slate-400 flex items-start gap-1.5 pt-1">
                          <Quote className="h-3 w-3 mt-0.5 shrink-0" />
                          Responding with a quote is not possible yet — the platform has no quote-response API. This inbox is read-only; when quote responses ship, they will appear here.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">{total} request{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const np = page - 1; setPage(np); loadRfqs({ page: np }) }} className="min-h-11 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const np = page + 1; setPage(np); loadRfqs({ page: np }) }} className="min-h-11 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomerRfqInboxPage
