'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { toast } from 'sonner'
import { EvidenceThumbs } from '@/components/pages/evidence-thumbs'
import {
  Scale, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Inbox, ScrollText,
  User, Package, PlayCircle,
} from 'lucide-react'

// ── Real API types (GET /api/admin/complaints · PATCH /api/admin/complaints/[id]) ──
/** Buyer-provided evidence photo metadata (bytes are served by /api/attachments/[id]). */
interface ApiComplaintEvidence {
  id: string
  mimeType: string
  sizeBytes: number
  note: string | null
  url: string
}

interface ApiAdminComplaint {
  id: string
  buyerId: string
  orderId: string | null
  subOrderId: string | null
  /** Raw category value (order_issue | product_quality | …) — real DB data. */
  category: string
  /** Server-provided display label for the raw category. */
  categoryLabel: string
  title: string
  description: string
  status: string
  resolutionNote: string | null
  resolvedById: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  /** From buyerProfiles.fullName (users has no name column) — null when absent. */
  buyerName: string | null
  /** Buyer-provided evidence photos — review-only, admins never upload. */
  evidence: ApiComplaintEvidence[]
}

interface ApiComplaintCounts {
  open: number
  in_review: number
  resolved: number
  rejected: number
  withdrawn: number
  total: number
}

type ComplaintTab = 'all' | 'open' | 'in_review' | 'resolved' | 'rejected' | 'withdrawn'

const TAB_LABELS: Record<ComplaintTab, string> = {
  all: 'All',
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const REFRESH_INTERVAL_MS = 30_000

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

// Complaint status → shadcn Badge tone (real statuses only)
const statusBadgeClass: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  in_review: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  withdrawn: 'bg-slate-50 text-slate-600 dark:text-slate-400 border-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800',
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function AdminComplaintsPage() {
  const { navigate } = useNavigationStore()

  const [complaints, setComplaints] = useState<ApiAdminComplaint[]>([])
  const [counts, setCounts] = useState<ApiComplaintCounts | null>(null)
  const [dataNotes, setDataNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tab, setTab] = useState<ComplaintTab>('all')

  // Review dialog state (no optimistic moves — server response applied on 200)
  const [dialog, setDialog] = useState<{ complaint: ApiAdminComplaint; action: 'resolve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Start-review single-flight
  const [startingId, setStartingId] = useState<string | null>(null)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = dialog !== null
  }, [dialog])

  const loadComplaints = useCallback(async (background = false) => {
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
      const res = await fetch(`/api/admin/complaints?status=${tab}&take=100`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setComplaints([]); setCounts(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load complaints (HTTP ${res.status})`
        apply(() => { if (background) setRefreshError(msg); else setError(msg) })
        return
      }
      apply(() => {
        setComplaints(Array.isArray(json.data?.complaints) ? json.data.complaints : [])
        setCounts(json.data?.counts ?? null)
        setDataNotes(Array.isArray(json.data?.dataNotes) ? json.data.dataNotes : [])
        setLastUpdated(new Date())
        setNeedsAuth(false)
      })
    } catch {
      const msg = 'Network error while loading complaints. Check your connection and retry.'
      apply(() => { if (background) setRefreshError(msg); else setError(msg) })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [tab])

  // Initial load + auto-refresh every 30s (cleared on unmount, paused while the review dialog is open)
  useEffect(() => {
    loadComplaints()
    const id = setInterval(() => { if (!dialogOpenRef.current) loadComplaints(true) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadComplaints])

  // Task 86 — live tap on the session admin's own token-gated admin:<id> room:
  // the moment any buyer files a complaint the queue refreshes itself (no
  // polling luck). Degraded honestly to polling when there is no session id.
  const sessionUser = useAuthStore((s) => s.user)
  const adminRoom = sessionUser?.userType === 'admin' && sessionUser.id ? `admin:${sessionUser.id}` : ''
  const lastEventRef = useRef('')
  useRealtimeRoom(adminRoom ? [adminRoom] : [], {
    onEvent: (message) => {
      const key = `${message.event}:${message.receivedAt.getTime()}`
      if (key === lastEventRef.current) return
      lastEventRef.current = key
      if (message.event === 'complaint:new') {
        toast('New complaint filed', { description: 'A buyer filed a complaint — the queue is refreshing.' })
        void loadComplaints(true)
      }
    },
  })

  const openDialog = (complaint: ApiAdminComplaint, action: 'resolve' | 'reject') => {
    setDialog({ complaint, action })
    setNote('')
    setDialogError('')
  }

  const closeDialog = () => {
    setDialog(null)
    setNote('')
    setDialogError('')
  }

  const startReview = async (complaint: ApiAdminComplaint) => {
    setStartingId(complaint.id)
    try {
      const res = await fetch(`/api/admin/complaints/${complaint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'start_review' }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error, verbatim (409 conflict, 401, …)
        const msg = json?.error || `Action failed (HTTP ${res.status})`
        toast.error(msg)
        return
      }
      // Real 2xx — apply the server-serialized row, then refresh counts.
      const updated = json.data as ApiAdminComplaint
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...updated, buyerName: c.buyerName, categoryLabel: c.categoryLabel } : c))
      )
      toast.success(json.message || 'Complaint moved into review.')
      loadComplaints(true)
    } catch {
      const msg = 'Network error while starting the review. Check your connection and retry.'
      toast.error(msg)
    } finally {
      setStartingId(null)
    }
  }

  const submitDecision = async () => {
    if (!dialog) return
    const { complaint, action } = dialog
    const trimmedNote = note.trim()

    // Client-side mirror of the server's real guard (the server re-checks it).
    if (trimmedNote.length < 3) {
      setDialogError('A resolution note of at least 3 characters is required — the buyer will see it on their complaint.')
      return
    }

    setSubmitting(true)
    setDialogError('')
    try {
      const res = await fetch(`/api/admin/complaints/${complaint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, resolutionNote: trimmedNote }),
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
      const updated = json.data as ApiAdminComplaint
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...updated, buyerName: c.buyerName, categoryLabel: c.categoryLabel } : c))
      )
      toast.success(json.message || `Complaint ${action === 'resolve' ? 'resolved' : 'rejected'}.`)
      closeDialog()
      loadComplaints(true)
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
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">The complaints review queue is restricted to Zylod admins. Sign in with an admin account to review buyer complaints.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  const tabCount = (t: ComplaintTab): number | null => {
    if (!counts) return null
    if (t === 'all') return counts.total
    return counts[t]
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 flex items-center justify-center">
            <Scale className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Complaints</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Every decision is audit-logged. Resolve or reject only with a real note — the buyer sees it verbatim.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadComplaints(true)}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 dark:border-slate-700"
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
          <button onClick={() => loadComplaints(true)} className="ml-auto underline underline-offset-2 shrink-0">Retry</button>
        </div>
      )}

      {/* Status tabs with real counts */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TAB_LABELS) as ComplaintTab[]).map((t) => {
          const n = tabCount(t)
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-11 px-4 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${tab === t ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-gray-900 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
            >
              {TAB_LABELS[t]}
              <span className={`tabular-nums ${tab === t ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>{n == null ? '' : n.toLocaleString('en-BD')}</span>
            </button>
          )
        })}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the complaints queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadComplaints()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : complaints.length === 0 ? (
        // Honest empty state — the DB truly has zero (or zero matching) complaints
        <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {tab === 'all' ? (
            <>
              <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <h2 className="text-sm font-black">No complaints yet</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                The complaints table currently holds zero rows — real counts, not a placeholder. When a buyer files a complaint it will appear here for review.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className={`h-10 w-10 mx-auto ${tab === 'resolved' || tab === 'rejected' || tab === 'withdrawn' ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-700'}`} />
              <h2 className="text-sm font-black">No {TAB_LABELS[tab].toLowerCase()} complaints</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                No complaint currently has status &ldquo;{tab}&rdquo;. Switch to All to see every complaint in the database.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto scrollbar-thin pr-1 space-y-3">
          {complaints.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Top row: category chip + title + status badge */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold border rounded-lg px-2 py-0.5 ${chipClass}`}>{c.categoryLabel}</span>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 break-words">{c.title}</p>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Filed {formatTimestamp(c.createdAt)} · ref <span className="font-mono">{c.id}</span>
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] font-black rounded-lg ${statusBadgeClass[c.status] || chipClass}`}>
                  {c.status.toUpperCase()}
                </Badge>
              </div>

              {/* Buyer + order context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">Buyer</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{c.buyerName ?? '—'}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">id {c.buyerId}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <Package className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">Order</p>
                    {c.orderId ? (
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate font-mono">{c.orderId}</p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Not order-related</p>
                    )}
                    {c.subOrderId && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">sub {c.subOrderId}</p>}
                  </div>
                </div>
              </div>

              {/* Real complaint description */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Description</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 break-words whitespace-pre-wrap">{c.description}</p>
              </div>

              {/* Buyer evidence photos — review only, never fabricated (empty rows stay honestly empty) */}
              <EvidenceThumbs photos={Array.isArray(c.evidence) ? c.evidence : []} />

              {/* Resolution (shown only when a real decision exists) */}
              {c.resolutionNote && (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <ScrollText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-300 break-words">
                    <span className="font-black">Resolution note:</span> {c.resolutionNote}
                  </p>
                </div>
              )}
              {c.resolvedAt && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                  Decided {formatTimestamp(c.resolvedAt)}
                  {c.resolvedById ? ` · by admin ${c.resolvedById}` : ''}
                </p>
              )}

              {/* Actions — only for genuinely actionable rows */}
              {c.status === 'open' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => startReview(c)}
                    disabled={startingId !== null || submitting}
                    className="flex-1 min-h-11 rounded-xl text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> {startingId === c.id ? 'Starting…' : 'Start review'}
                  </Button>
                </div>
              )}
              {c.status === 'in_review' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => openDialog(c, 'resolve')}
                    disabled={startingId !== null || submitting}
                    className="flex-1 min-h-11 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                  </Button>
                  <Button
                    onClick={() => openDialog(c, 'reject')}
                    disabled={startingId !== null || submitting}
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
      {!loading && dataNotes.length > 0 && complaints.length > 0 && (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-1">
          {dataNotes.map((noteLine, i) => (
            <p key={i} className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">· {noteLine}</p>
          ))}
        </div>
      )}

      {/* Resolve / Reject decision dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  {dialog.action === 'resolve' ? (
                    <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Resolve complaint</>
                  ) : (
                    <><XCircle className="h-4 w-4 text-red-600" /> Reject complaint</>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {dialog.action === 'resolve'
                    ? 'Resolving records a real decision (audit-logged). A note of at least 3 characters is required — the buyer will see it on their complaint.'
                    : 'Rejecting records a real decision (audit-logged). A note of at least 3 characters is required — the buyer will see it on their complaint.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 break-words">
                  <span className="font-black">{dialog.complaint.title}</span> · {dialog.complaint.categoryLabel} · buyer {dialog.complaint.buyerName ?? dialog.complaint.buyerId}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="resolution-note" className="text-xs font-bold">Resolution note (required, min 3 characters)</Label>
                  <Textarea
                    id="resolution-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={dialog.action === 'resolve' ? 'Explain how the complaint was resolved…' : 'Explain the real reason this complaint is rejected…'}
                    className="min-h-[80px] rounded-xl text-xs"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{note.trim().length}/3 characters minimum</p>
                </div>

                {dialogError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {dialogError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={submitting} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 dark:border-slate-700">
                  Cancel
                </Button>
                <Button
                  onClick={submitDecision}
                  disabled={submitting || note.trim().length < 3}
                  className={`min-h-11 rounded-xl text-xs font-bold text-white ${dialog.action === 'resolve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {submitting ? 'Saving…' : dialog.action === 'resolve' ? 'Confirm resolve' : 'Confirm reject'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminComplaintsPage
