'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { toast } from 'sonner'
import { EvidenceManager } from '@/components/pages/evidence-manager'
import {
  AlertTriangle, ChevronDown, ImageIcon, Inbox, LogIn, Package, RefreshCw, Scale, ScrollText, Undo2,
} from 'lucide-react'

// ── Real API types (GET /api/complaints · POST /api/complaints/[id]/withdraw) ──
interface ApiComplaint {
  id: string
  buyerId: string
  orderId: string | null
  subOrderId: string | null
  /** Raw category value (order_issue | product_quality | …) — real DB data. */
  category: string
  title: string
  description: string
  status: string
  resolutionNote: string | null
  resolvedById: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

const REFRESH_INTERVAL_MS = 30_000

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-background border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

// Real complaint status → chip color (honest palette language, same as admin queues)
const statusChipClass: Record<string, string> = {
  open: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  in_review: 'text-primary dark:text-primary/70 bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/30',
  resolved: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  rejected: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900',
  withdrawn: 'text-slate-600 dark:text-slate-400 dark:text-slate-300 bg-slate-50 dark:bg-background border-slate-100 dark:border-slate-800',
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'order_issue', label: 'Order issue' },
  { value: 'product_quality', label: 'Product quality' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'payment', label: 'Payment' },
  { value: 'seller_behavior', label: 'Seller behavior' },
  { value: 'other', label: 'Other' },
]

function categoryLabel(category: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category
}

export function BuyerComplaintsPage() {
  const { navigate } = useNavigationStore()

  const [complaints, setComplaints] = useState<ApiComplaint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Withdraw confirm dialog (no optimistic writes — server response applied on 200)
  const [withdrawing, setWithdrawing] = useState<ApiComplaint | null>(null)
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)

  // Evidence manager: expanded rows + real photo counts (reported on load)
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({})
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>({})

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    dialogOpenRef.current = withdrawing !== null
  }, [withdrawing])

  const loadComplaints = useCallback(async (background = false) => {
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
      const res = await fetch('/api/complaints?take=100', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setComplaints([]) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load your complaints (HTTP ${res.status})`
        apply(() => { if (background) setRefreshError(msg); else setError(msg) })
        return
      }
      apply(() => {
        setComplaints(Array.isArray(json.data) ? json.data : [])
        setLastUpdated(new Date())
        setNeedsAuth(false)
      })
    } catch {
      const msg = 'Network error while loading your complaints. Check your connection and retry.'
      apply(() => { if (background) setRefreshError(msg); else setError(msg) })
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  // Initial load + auto-refresh every 30s (cleared on unmount, paused while the withdraw dialog is open)
  useEffect(() => {
    loadComplaints()
    const id = setInterval(() => { if (!dialogOpenRef.current) loadComplaints(true) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadComplaints])

  const closeWithdraw = () => {
    setWithdrawing(null)
    setWithdrawError('')
  }

  const toggleEvidence = (complaintId: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [complaintId]: !prev[complaintId] }))
  }

  const submitWithdraw = async () => {
    if (!withdrawing) return
    setWithdrawSubmitting(true)
    setWithdrawError('')
    try {
      const res = await fetch(`/api/complaints/${withdrawing.id}/withdraw`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error, verbatim (409 with the real current status, 401, 403 …)
        const msg = json?.error || `Withdraw failed (HTTP ${res.status})`
        setWithdrawError(msg)
        toast.error(msg)
        return
      }
      // Real 2xx — apply the server-serialized row, toast, refresh counts.
      const updated = json.data as ApiComplaint
      setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast.success(json.message || 'Complaint withdrawn.')
      closeWithdraw()
      loadComplaints(true)
    } catch {
      const msg = 'Network error while withdrawing the complaint. Check your connection and retry.'
      setWithdrawError(msg)
      toast.error(msg)
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <Scale className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Sign in to view your complaints</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
          Your complaints are tied to your account — sign in to see their real status and the review team&rsquo;s decisions.
        </p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold gap-1.5">
          <LogIn className="h-3.5 w-3.5" /> Sign In
        </Button>
      </div>
    )
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
            <h1 className="text-lg md:text-xl font-black tracking-tight">My Complaints</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Every complaint here is a real record. You can withdraw a complaint while it is still open — after that it belongs to the review queue.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s</span>
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

      {/* States */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load your complaints</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadComplaints()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : complaints.length === 0 ? (
        // Honest empty state — this account truly has zero complaints
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-700 dark:text-slate-300 mx-auto" />
          <h2 className="text-sm font-black">No complaints filed yet</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-md mx-auto leading-relaxed">
            Your account has no complaints on record — this list only shows real complaints you have filed.
          </p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto scrollbar-thin pr-1 space-y-3">
          {complaints.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Top row: category chip + title + status badge */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold border rounded-lg px-2 py-0.5 ${chipClass}`}>{categoryLabel(c.category)}</span>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 break-words">{c.title}</p>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">
                    Filed {formatTimestamp(c.createdAt)} · ref <span className="font-mono">{c.id}</span>
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] font-black rounded-lg ${statusChipClass[c.status] || chipClass}`}>
                  {c.status.toUpperCase()}
                </Badge>
              </div>

              {/* Order context (only when the complaint is order-related) */}
              {c.orderId && (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <Package className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 dark:text-slate-300 break-all font-mono">{c.orderId}</p>
                </div>
              )}

              {/* Real complaint description */}
              <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500 dark:text-slate-300 break-words whitespace-pre-wrap">{c.description}</p>

              {/* Resolution (shown only when a real decision exists) */}
              {c.resolutionNote && (
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-slate-800 px-3 py-2">
                  <ScrollText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 dark:text-slate-300 break-words">
                    <span className="font-black">Resolution note:</span> {c.resolutionNote}
                  </p>
                </div>
              )}
              {c.resolvedAt && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 tabular-nums">
                  Decided {formatTimestamp(c.resolvedAt)}
                  {c.resolvedById ? ' · by the Zylod review team' : ''}
                </p>
              )}

              {/* Evidence — buyer-provided photos, compact expandable per row (upload/delete while open) */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleEvidence(c.id)}
                  aria-expanded={!!expandedEvidence[c.id]}
                  className="min-h-11 w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 px-3 text-xs font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:bg-background dark:hover:bg-card dark:hover:bg-background transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
                    Evidence{evidenceCounts[c.id] !== undefined ? ` (${evidenceCounts[c.id]})` : ''}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform ${expandedEvidence[c.id] ? 'rotate-180' : ''}`} />
                </button>
                {expandedEvidence[c.id] && (
                  <div className="mt-2">
                    <EvidenceManager
                      ownerType="complaint"
                      ownerId={c.id}
                      canEdit={c.status === 'open'}
                      lockedNote={
                        c.status === 'in_review'
                          ? 'Evidence is locked — review has started, so the photos you attached while the complaint was open are what the team is reviewing.'
                          : c.status === 'withdrawn'
                            ? 'Evidence is locked — the complaint was withdrawn; the photos attached while it was open are part of the record.'
                            : 'Evidence is locked — the complaint has been decided; the photos attached while it was open are part of the record.'
                      }
                      onCount={(n) => setEvidenceCounts((prev) => ({ ...prev, [c.id]: n }))}
                    />
                  </div>
                )}
              </div>

              {/* Withdraw — only while the complaint is genuinely open */}
              {c.status === 'open' && (
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={() => setWithdrawing(c)}
                    disabled={withdrawSubmitting}
                    variant="outline"
                    className="min-h-11 px-4 rounded-xl text-xs font-bold gap-1.5 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Withdraw
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Withdraw confirm dialog */}
      <Dialog open={withdrawing !== null} onOpenChange={(open) => { if (!open) closeWithdraw() }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          {withdrawing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-black flex items-center gap-2">
                  <Undo2 className="h-4 w-4 text-red-600" /> Withdraw this complaint?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  Withdrawing closes the complaint for real — it can no longer be reviewed or reopened. This action is audit-logged.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-1">
                <div className="rounded-xl bg-slate-50 dark:bg-background border border-slate-100 dark:border-slate-800 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 break-words">
                  <span className="font-black">{withdrawing.title}</span> · ref <span className="font-mono">{withdrawing.id}</span> · status {withdrawing.status}
                </div>

                {withdrawError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {withdrawError}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeWithdraw} disabled={withdrawSubmitting} className="min-h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 dark:border-slate-700">
                  Keep complaint
                </Button>
                <Button
                  onClick={submitWithdraw}
                  disabled={withdrawSubmitting}
                  className="min-h-11 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700"
                >
                  {withdrawSubmitting ? 'Withdrawing…' : 'Withdraw complaint'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BuyerComplaintsPage
