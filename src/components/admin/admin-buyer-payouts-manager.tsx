'use client'

/**
 * Admin Buyer Payouts Manager — the decision console for the BUYER
 * withdrawal rail (Task 119), the buyer-side twin of the seller payouts
 * console:
 *
 *   GET   /api/admin/buyer-payouts      — ?status=<pending|processing|
 *                                         completed|failed>&page&limit,
 *                                         whole-table stats + real
 *                                         pendingAmount sum
 *   PATCH /api/admin/buyer-payouts/[id] — { action: 'complete' | 'reject',
 *                                         reference?, note? } — COMPLETE
 *                                         debits the wallet inside the
 *                                         decision tx with the transfer
 *                                         reference REQUIRED; REJECT frees
 *                                         the hold, nothing moves. Terminal.
 *
 * buyerPayouts.status real values: pending | processing | completed | failed
 * (prisma/schema.prisma). Tabs/stats are built from exactly those.
 *
 * Live: joins the session admin's own token-gated room admin:<adminUserId>
 * and refetches on wallet:withdrawal-requested / payout:changed. Degrades
 * gracefully to polling + the refresh button.
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
  RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle,
  Wallet, ChevronUp, Landmark, Smartphone, ArrowUpRight,
} from 'lucide-react'

interface ApiPayoutRow {
  id: string
  userId: string
  claimant: { displayName: string | null; email: string | null }
  amount: number
  method: string
  status: string
  destination: string | null
  reference: string | null
  fee: number
  processedAt: string | null
  createdAt: string
}

interface ApiStats {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
  pendingAmount: number
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

const REFRESH_INTERVAL_MS = 30_000
const PAGE_SIZE = 20

const statusChip: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  processing: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
}

function StatusChip({ status }: { status: string }) {
  const cls = statusChip[status] ?? 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-950 dark:border-slate-800'
  return <span className={`text-[10px] font-black border rounded-lg px-2 py-1 uppercase tracking-wide ${cls}`}>{status}</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function methodIcon(method: string) {
  return ['bkash', 'nagad', 'rocket', 'upay'].includes(method) ? Smartphone : Landmark
}

export function AdminBuyerPayoutsManager() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const sessionUser = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [rows, setRows] = useState<ApiPayoutRow[]>([])
  const [stats, setStats] = useState<ApiStats | null>(null)
  const [statusTab, setStatusTab] = useState('pending')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Decision dialog state (no optimistic moves — server response applied on 200)
  const [dialogTarget, setDialogTarget] = useState<{ row: ApiPayoutRow; action: 'complete' | 'reject' } | null>(null)
  const [dialogReference, setDialogReference] = useState('')
  const [dialogNote, setDialogNote] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [deciding, setDeciding] = useState(false)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = dialogTarget !== null
  }, [dialogTarget])

  const loadPayouts = useCallback(async (opts?: { status?: string; page?: number; background?: boolean }) => {
    const useStatus = opts?.status ?? statusTab
    const usePage = opts?.page ?? page
    const background = opts?.background ?? false
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
      if (useStatus !== 'all') params.set('status', useStatus)
      const res = await fetch(`/api/admin/buyer-payouts?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setRows([]); setStats(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load withdrawals (HTTP ${res.status})`
        apply(() => {
          setError(msg)
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
      const msg = 'Network error while loading withdrawals. Check your connection and retry.'
      apply(() => { setError(msg); if (!background) { setRows([]); setStats(null) } })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [statusTab, page])

  useEffect(() => { loadPayouts() }, [loadPayouts])

  useEffect(() => {
    const id = setInterval(() => { if (!dialogOpenRef.current) loadPayouts({ background: true }) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadPayouts])

  const adminRoom = sessionUser?.userType === 'admin' && sessionUser.id ? `admin:${sessionUser.id}` : ''
  const onLiveEvent = useCallback((event: string) => {
    if (event === 'wallet:withdrawal-requested') {
      toast('New buyer withdrawal request', { description: 'A buyer requested money out — refresh is running.' })
    }
    void loadPayouts({ background: true })
  }, [loadPayouts])
  const lastEventRef = useRef('')
  useRealtimeRoom(adminRoom ? [adminRoom] : [], {
    onEvent: (message) => {
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
    loadPayouts({ status: key, page: 1 })
  }

  const openDecision = (row: ApiPayoutRow, action: 'complete' | 'reject') => {
    setDialogTarget({ row, action })
    setDialogReference('')
    setDialogNote('')
    setDialogError('')
  }

  const submitDecision = async () => {
    if (!dialogTarget) return
    const { row, action } = dialogTarget
    setDeciding(true)
    setDialogError('')
    try {
      const reference = dialogReference.trim()
      const note = dialogNote.trim()
      if (action === 'complete' && reference.length < 3) {
        setDialogError('Transfer reference is required to complete a payout (TRXID / bank ref)')
        return
      }
      const res = await fetch(`/api/admin/buyer-payouts/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          ...(reference ? { reference } : {}),
          ...(note ? { note } : {}),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setDialogError(json?.error || `Could not ${action} the withdrawal (HTTP ${res.status})`)
        return
      }
      if (action === 'complete') {
        toast.success(`Withdrawal settled — ৳${row.amount.toLocaleString()} debited`, {
          description: `Transfer ref ${reference} is on record. The buyer has been notified.`,
        })
      } else {
        toast.success('Withdrawal request rejected', {
          description: 'The hold was freed and no money moved; the buyer has been notified.',
        })
      }
      setDialogTarget(null)
      loadPayouts({ background: true })
    } catch {
      setDialogError('Network error while submitting the decision. Check your connection and retry.')
    } finally {
      setDeciding(false)
    }
  }

  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">This queue is restricted to Zylod finance admins. Sign in with an admin account to decide buyer withdrawals.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <ArrowUpRight className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Buyer Withdrawals</h1>
            <p className="text-[11px] text-slate-400">Buyers&rsquo; money-out requests from their sourcing fund. Completing debits the wallet with a transfer reference on record; rejecting frees the hold — nothing moves. Decisions are terminal.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadPayouts({ background: true })} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats strip — real groupBy counts + real pending sum */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { key: 'pending', label: 'Pending', tone: 'text-amber-600', Icon: Clock },
          { key: 'completed', label: 'Completed', tone: 'text-emerald-600', Icon: CheckCircle2 },
          { key: 'failed', label: 'Rejected', tone: 'text-red-500', Icon: XCircle },
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
            {key === 'pending' && stats ? (
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatPrice(stats.pendingAmount)} on hold</p>
            ) : null}
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
          <Button onClick={() => loadPayouts()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {statusTab === 'pending' ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-sm font-black">No buyer withdrawals awaiting a decision</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Buyer money-out requests appear here the moment POST /api/buyer/withdrawals records them. The requested amount is HELD, not debited, until you decide.
              </p>
            </>
          ) : (
            <>
              <Wallet className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No {statusTab} withdrawals</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">This tab reflects the real buyerPayouts table — counts in the strip above are platform-wide.</p>
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
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Buyer</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Method</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Destination</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Requested</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((p) => {
                  const PIcon = methodIcon(p.method)
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
                      <td className="px-3 py-2.5">
                        <span className="font-black block max-w-[160px] truncate">{p.claimant.displayName || '--'}</span>
                        <span className="text-[9px] text-slate-400 block truncate">{p.claimant.email || ''}</span>
                      </td>
                      <td className="px-3 py-2.5 capitalize">
                        <span className="inline-flex items-center gap-1.5"><PIcon className="h-3.5 w-3.5 text-slate-400" />{p.method}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono max-w-[220px] truncate text-slate-500">{p.destination || '--'}</td>
                      <td className="px-3 py-2.5 text-right font-black whitespace-nowrap">
                        {formatPrice(p.amount)}
                        {p.reference ? <span className="block text-[9px] text-slate-400 font-normal">ref {p.reference}</span> : null}
                      </td>
                      <td className="px-3 py-2.5"><StatusChip status={p.status} /></td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {p.status === 'pending' || p.status === 'processing' ? (
                          <Button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="h-8 px-3 rounded-lg text-[11px] font-bold bg-primary hover:bg-primary/90 text-white gap-1">
                            {expandedId === p.id ? <><ChevronUp className="h-3 w-3" /> Close</> : <>Decide</>}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400">decided {formatDate(p.processedAt)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map((p) => {
              const PIcon = methodIcon(p.method)
              return (
                <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{p.claimant.displayName || '--'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{p.claimant.email || ''}</p>
                    </div>
                    <StatusChip status={p.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 capitalize inline-flex items-center gap-1"><PIcon className="h-3 w-3" />{p.method}</span>
                    {p.reference ? <span className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 font-mono">ref {p.reference}</span> : null}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono break-all">{p.destination || '--'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-primary">{formatPrice(p.amount)}</span>
                    <span className="text-[10px] text-slate-400">{formatDate(p.createdAt)}</span>
                  </div>
                  {(p.status === 'pending' || p.status === 'processing') && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button onClick={() => openDecision(p, 'reject')} variant="outline" className="h-10 rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50">Reject</Button>
                      <Button onClick={() => openDecision(p, 'complete')} className="h-10 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Settle</Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop row expansion → decision buttons */}
          {expandedId && (() => {
            const p = rows.find((r) => r.id === expandedId)
            if (!p || (p.status !== 'pending' && p.status !== 'processing')) return null
            return (
              <div className="hidden md:flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
                <p className="text-xs text-slate-500">
                  Decide the withdrawal for <span className="font-bold text-slate-800 dark:text-slate-200">{p.claimant.displayName || p.claimant.email || 'this buyer'}</span> — settle only after the transfer really left the account ({p.method}, <span className="font-mono">{p.destination || 'destination on file'}</span>).
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => openDecision(p, 'reject')} variant="outline" className="h-9 px-4 rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50">Reject</Button>
                  <Button onClick={() => openDecision(p, 'complete')} className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Settle</Button>
                </div>
              </div>
            )
          })()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">{total} withdrawal{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadPayouts({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadPayouts({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Complete / Reject confirm dialog */}
      <Dialog open={dialogTarget !== null} onOpenChange={(open) => { if (!deciding) { if (!open) setDialogTarget(null); setDialogError('') } }}>
        <DialogContent className="max-w-md rounded-3xl">
          {dialogTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black">
                  {dialogTarget.action === 'complete' ? 'Settle the withdrawal — debit the wallet' : 'Reject this withdrawal request'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {dialogTarget.action === 'complete'
                    ? `${dialogTarget.row.claimant.displayName || dialogTarget.row.claimant.email || 'The buyer'} · ${dialogTarget.row.method} · ${dialogTarget.row.destination || 'destination on file'}. Settling debits ${formatPrice(dialogTarget.row.amount)} from their wallet and records your transfer reference — this is the only action that moves the money. Only continue after the transfer really left the company account.`
                    : `Ref on file: ${dialogTarget.row.destination || '--'}. Rejecting marks this request FAILED — no money moves, the hold is freed, and the buyer is notified. They can request again with corrected details.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {dialogTarget.action === 'complete' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Transfer reference (TRXID / bank ref) *</label>
                    <Input
                      value={dialogReference}
                      onChange={(e) => setDialogReference(e.target.value)}
                      placeholder="e.g. TRX1189X2 or BEFTN ref"
                      className="h-10 rounded-xl text-xs font-mono"
                      maxLength={64}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Decision note (optional)</label>
                  <Input
                    value={dialogNote}
                    onChange={(e) => setDialogNote(e.target.value)}
                    placeholder={dialogTarget.action === 'complete' ? 'e.g. settled via BEFTN batch 0412' : 'e.g. destination account could not be verified'}
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
                  disabled={deciding || (dialogTarget.action === 'complete' && dialogReference.trim().length < 3)}
                  className={`h-10 px-5 rounded-xl text-xs font-bold text-white ${dialogTarget.action === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {deciding ? 'Recording…' : dialogTarget.action === 'complete' ? 'Confirm & settle' : 'Reject request'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminBuyerPayoutsManager
