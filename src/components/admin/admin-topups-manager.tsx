'use client'

/**
 * Admin Top-ups Manager — the finance console for the WALLET half of the
 * payment doctrine (Task 118).
 *
 *   GET  /api/admin/topups           — ?status=<pending|credited|failed|
 *                                      cancelled|rejected>&page&limit, whole-
 *                                      table stats + real pending-amount sum
 *   POST /api/admin/topups/[id]/verify — { action: 'verify' | 'reject', note? }
 *                                      the ONLY route that credits a manual
 *                                      claim (wallet balance + ledger row in
 *                                      one transaction, audit before/after)
 *
 * walletTopups.status real values: pending | credited | failed | cancelled |
 * rejected (prisma/schema.prisma). Tabs/stats are built from exactly those.
 * Gateway rows (source 'gateway', they have a sessionId) are display-only —
 * the verify route refuses them with 409 because their callbacks own their
 * lifecycle; the UI states that honestly instead of hiding them.
 *
 * Live: joins the session admin's own token-gated room admin:<adminUserId>
 * and refetches on wallet:topup-submitted / wallet:topup-verified /
 * wallet:topup-rejected. Degrades gracefully to polling + the refresh button.
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
  Wallet, ChevronUp, Landmark, Smartphone,
} from 'lucide-react'

interface ApiTopupRow {
  id: string
  userId: string
  claimant: { displayName: string | null; email: string | null }
  provider: string
  method: string
  senderNumber: string | null
  note: string | null
  reference: string
  amount: number
  currency: string
  status: string
  sessionId: string | null
  gatewayTrxId: string | null
  submittedAt: string | null
  creditedAt: string | null
  createdAt: string
  verification: Record<string, unknown> | null
  source: 'gateway' | 'manual'
}

interface ApiStats {
  pending: number
  credited: number
  failed: number
  cancelled: number
  rejected: number
  total: number
  pendingAmount: number
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'credited', label: 'Credited' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

const REFRESH_INTERVAL_MS = 30_000
const PAGE_SIZE = 20

const statusChip: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  credited: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  failed: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-card dark:text-neutral-300 dark:border-neutral-800',
}

function StatusChip({ status }: { status: string }) {
  const cls = statusChip[status] ?? 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-background dark:border-neutral-800'
  return <span className={`text-[10px] font-black border rounded-lg px-2 py-1 uppercase tracking-wide ${cls}`}>{status}</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function providerIcon(provider: string) {
  return ['bkash', 'nagad', 'rocket', 'upay'].includes(provider) ? Smartphone : Landmark
}

export function AdminTopupsManager() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const sessionUser = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [rows, setRows] = useState<ApiTopupRow[]>([])
  const [stats, setStats] = useState<ApiStats | null>(null)
  const [statusTab, setStatusTab] = useState('pending')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Verify/reject dialog state (no optimistic moves — server response applied on 200)
  const [dialogTarget, setDialogTarget] = useState<{ row: ApiTopupRow; action: 'verify' | 'reject' } | null>(null)
  const [dialogNote, setDialogNote] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [deciding, setDeciding] = useState(false)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = dialogTarget !== null
  }, [dialogTarget])

  const loadTopups = useCallback(async (opts?: { status?: string; page?: number; background?: boolean }) => {
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
      const res = await fetch(`/api/admin/topups?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setRows([]); setStats(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load top-ups (HTTP ${res.status})`
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
      const msg = 'Network error while loading top-ups. Check your connection and retry.'
      apply(() => { setError(msg); if (!background) { setRows([]); setStats(null) } })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [statusTab, page])

  useEffect(() => { loadTopups() }, [loadTopups])

  useEffect(() => {
    const id = setInterval(() => { if (!dialogOpenRef.current) loadTopups({ background: true }) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadTopups])

  const adminRoom = sessionUser?.userType === 'admin' && sessionUser.id ? `admin:${sessionUser.id}` : ''
  const onLiveEvent = useCallback((event: string) => {
    if (event === 'wallet:topup-submitted') {
      toast('New wallet top-up claim', { description: 'A user submitted a funding claim — refresh is running.' })
    }
    void loadTopups({ background: true })
  }, [loadTopups])
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
    loadTopups({ status: key, page: 1 })
  }

  const openDecision = (row: ApiTopupRow, action: 'verify' | 'reject') => {
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
      const res = await fetch(`/api/admin/topups/${encodeURIComponent(row.id)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(note ? { action, note } : { action }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setDialogError(json?.error || `Could not ${action} the top-up (HTTP ${res.status})`)
        return
      }
      const d = json?.data
      if (action === 'verify') {
        toast.success(`Top-up verified — ৳${row.amount.toLocaleString()} credited`, {
          description: d && typeof d.newBalance === 'number'
            ? `Claimant's wallet balance is now ${formatPrice(d.newBalance)}. A deposit row was written.`
            : undefined,
        })
      } else {
        toast.success('Top-up claim rejected', {
          description: 'The claim was marked REJECTED. No money moved; the claimant has been notified.',
        })
      }
      setDialogTarget(null)
      loadTopups({ background: true })
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
        <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">This queue is restricted to Zylod finance admins. Sign in with an admin account to verify wallet top-up claims.</p>
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
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Wallet Top-up Verification</h1>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">Manual funding claims stay pending until you confirm the money arrived. Verifying credits the wallet and writes the ledger row; rejecting moves nothing.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadTopups({ background: true })} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-neutral-800 dark:border-neutral-700">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats strip — real groupBy counts + real pending sum */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { key: 'pending', label: 'Pending', tone: 'text-amber-600', Icon: Clock },
          { key: 'credited', label: 'Credited', tone: 'text-emerald-600', Icon: CheckCircle2 },
          { key: 'rejected', label: 'Rejected', tone: 'text-red-500', Icon: XCircle },
          { key: 'failed', label: 'Gateway failed', tone: 'text-red-400', Icon: XCircle },
          { key: 'total', label: 'Total', tone: 'text-slate-700 dark:text-neutral-200', Icon: Wallet },
        ].map(({ key, label, tone, Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(STATUS_TABS.some((t) => t.key === key) ? key : 'all')}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${tone}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <p className="text-xl font-black mt-1">{stats ? stats[key] : '--'}</p>
            {key === 'pending' && stats ? (
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 font-bold mt-0.5">{formatPrice(stats.pendingAmount)} claimed</p>
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
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${statusTab === t.key ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-card border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-neutral-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadTopups()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-slate-200 dark:border-neutral-800 text-center space-y-2">
          {statusTab === 'pending' ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-sm font-black">No top-up claims awaiting verification</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">
                Manual funding claims appear here the moment POST /api/wallet/topup records them. Gateway top-ups credit themselves through the verified callback — they never need you.
              </p>
            </>
          ) : (
            <>
              <Wallet className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No {statusTab} top-ups</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">This tab reflects the real walletTopups table — counts in the strip above are platform-wide.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-background text-left">
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">Claimant</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">Provider</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">Reference</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">Sender</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">Status</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">Date</th>
                  <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {rows.map((t) => {
                  const PIcon = providerIcon(t.provider)
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-card dark:bg-background/60 dark:hover:bg-background/40">
                      <td className="px-3 py-2.5">
                        <span className="font-black block max-w-[160px] truncate">{t.claimant.displayName || '--'}</span>
                        <span className="text-[9px] text-slate-400 dark:text-neutral-500 block truncate">{t.claimant.email || ''}</span>
                      </td>
                      <td className="px-3 py-2.5 capitalize">
                        <span className="inline-flex items-center gap-1.5"><PIcon className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500" />{t.provider}</span>
                        <span className="block text-[9px] text-slate-400 dark:text-neutral-500">{t.source === 'gateway' ? 'gateway session' : 'manual claim'}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono max-w-[150px] truncate">{t.reference}</td>
                      <td className="px-3 py-2.5 font-mono max-w-[120px] truncate">{t.senderNumber || '--'}</td>
                      <td className="px-3 py-2.5 text-right font-black whitespace-nowrap">{formatPrice(t.amount)}</td>
                      <td className="px-3 py-2.5"><StatusChip status={t.status} /></td>
                      <td className="px-3 py-2.5 text-slate-400 dark:text-neutral-500 whitespace-nowrap">{formatDate(t.submittedAt ?? t.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {t.status === 'pending' ? (
                          <Button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="h-8 px-3 rounded-lg text-[11px] font-bold bg-primary hover:bg-primary/90 text-white gap-1">
                            {expandedId === t.id ? <><ChevronUp className="h-3 w-3" /> Close</> : <>Decide</>}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-neutral-500">{t.status === 'credited' ? `credited ${formatDate(t.creditedAt)}` : 'decided'}</span>
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
            {rows.map((t) => {
              const PIcon = providerIcon(t.provider)
              return (
                <div key={t.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{t.claimant.displayName || '--'}</p>
                      <p className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">{t.claimant.email || ''}</p>
                    </div>
                    <StatusChip status={t.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 rounded-lg px-2 py-1 capitalize inline-flex items-center gap-1"><PIcon className="h-3 w-3" />{t.provider}</span>
                    <span className="bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 rounded-lg px-2 py-1 font-mono">{t.reference}</span>
                    {t.senderNumber ? <span className="bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 rounded-lg px-2 py-1 font-mono">from {t.senderNumber}</span> : null}
                  </div>
                  {t.note ? <p className="text-[10px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 italic">&ldquo;{t.note}&rdquo;</p> : null}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-primary">{formatPrice(t.amount)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatDate(t.submittedAt ?? t.createdAt)}</span>
                  </div>
                  {t.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button onClick={() => openDecision(t, 'reject')} variant="outline" className="h-10 rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50">Reject</Button>
                      <Button onClick={() => openDecision(t, 'verify')} className="h-10 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Verify</Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop row expansion → decision buttons */}
          {expandedId && (() => {
            const t = rows.find((r) => r.id === expandedId)
            if (!t || t.status !== 'pending') return null
            return (
              <div className="hidden md:flex items-center justify-between bg-slate-50 dark:bg-background border border-slate-200 dark:border-neutral-800 rounded-2xl px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
                  Decide the pending claim from <span className="font-bold text-slate-800 dark:text-neutral-200">{t.claimant.displayName || t.claimant.email || 'this user'}</span> — credit only after confirming {formatPrice(t.amount)} really arrived ({t.provider}, ref <span className="font-mono">{t.reference}</span>).
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => openDecision(t, 'reject')} variant="outline" className="h-9 px-4 rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50">Reject</Button>
                  <Button onClick={() => openDecision(t, 'verify')} className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Verify</Button>
                </div>
              </div>
            )
          })()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 dark:text-neutral-500">{total} top-up{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadTopups({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadTopups({ page: p }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verify / Reject confirm dialog */}
      <Dialog open={dialogTarget !== null} onOpenChange={(open) => { if (!deciding) { if (!open) setDialogTarget(null); setDialogError('') } }}>
        <DialogContent className="max-w-md rounded-3xl max-h-[85vh] overflow-y-auto">
          {dialogTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black">
                  {dialogTarget.action === 'verify' ? 'Confirm money received — credit the wallet' : 'Reject this top-up claim'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {dialogTarget.action === 'verify'
                    ? `${dialogTarget.row.claimant.displayName || dialogTarget.row.claimant.email || 'The claimant'} · ${dialogTarget.row.provider} · ref ${dialogTarget.row.reference}. Verifying credits ${formatPrice(dialogTarget.row.amount)} to their wallet and writes the deposit row — this is the only action that can. Only continue after confirming the money arrived in the company account.`
                    : `Ref ${dialogTarget.row.reference}. Rejecting marks this claim REJECTED — no money moves, the claimant is notified${dialogTarget.row.status === 'pending' ? '' : ''}, and the decision is audit-logged. They can submit a corrected reference.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">Decision note (optional)</label>
                  <Input
                    value={dialogNote}
                    onChange={(e) => setDialogNote(e.target.value)}
                    placeholder={dialogTarget.action === 'verify' ? 'e.g. matched against bKash merchant statement' : 'e.g. no money received for this reference'}
                    className="h-10 rounded-xl text-xs"
                    maxLength={300}
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
                  {deciding ? 'Recording…' : dialogTarget.action === 'verify' ? 'Confirm & credit' : 'Reject claim'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminTopupsManager
