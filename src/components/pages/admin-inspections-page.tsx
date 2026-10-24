'use client'

/**
 * AdminInspectionsPage — the admin console of the inspection rail (Task 91).
 * Every buyer request lands here (durable notifications + a live
 * 'inspection:new' tap on the session admin's room, 30s poll as the honest
 * degradation). The admin moves each request through the real state machine:
 *   schedule  — book a slot (datetime required)
 *   complete  — attach the REQUIRED report URL (a completed inspection
 *               without its report is a lie, so the API enforces it)
 *   fail      — record the REQUIRED finding note, delivered to the buyer
 *               verbatim
 * Status filter tabs + real groupBy stats. Auth failure renders the honest
 * "Admin access required" gate.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { toast } from 'sonner'
import { ArrowRight, ClipboardCheck, ExternalLink, RefreshCw } from 'lucide-react'

interface AdminInspectionRow {
  id: string
  orderId: string
  orderNumber: string | null
  orderTotal: number | null
  buyerName: string | null
  inspectorType: string
  status: 'pending' | 'scheduled' | 'completed' | 'failed'
  reportUrl: string | null
  scheduledAt: string | null
  completedAt: string | null
  createdAt: string
}

type Stats = { total: number; pending?: number; scheduled?: number; completed?: number; failed?: number }

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  scheduled: 'bg-primary/5 text-primary border-primary/30',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'all' | 'pending' | 'scheduled' | 'completed' | 'failed'
const TABS: Tab[] = ['all', 'pending', 'scheduled', 'completed', 'failed']

export function AdminInspectionsPage() {
  const navigate = useNavigationStore((s) => s.navigate)
  const [tab, setTab] = useState<Tab>('all')
  const [rows, setRows] = useState<AdminInspectionRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [dialog, setDialog] = useState<{ row: AdminInspectionRow; action: 'schedule' | 'complete' | 'fail' } | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [reportUrl, setReportUrl] = useState('')
  const [note, setNote] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)
  const dialogOpenRef = useRef(false)
  useEffect(() => { dialogOpenRef.current = dialog !== null }, [dialog])

  const load = useCallback(async (which: Tab, background = false) => {
    if (background && inflightRef.current) return
    inflightRef.current = true
    const seq = ++seqRef.current
    const apply = (fn: () => void) => { if (seq === seqRef.current) fn() }
    if (background) apply(() => setRefreshing(true))
    else { setLoading(true); setError('') }
    try {
      const qs = which === 'all' ? '' : `?status=${which}`
      const res = await fetch(`/api/admin/inspections${qs}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsAuth(true); setRows([]); setStats(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        apply(() => setError(json?.error || `Failed to load inspections (HTTP ${res.status})`))
        return
      }
      apply(() => {
        setRows(Array.isArray(json.data?.inspections) ? json.data.inspections : [])
        setStats(json.data?.stats ?? null)
        setNeedsAuth(false)
        setLastUpdated(new Date())
      })
    } catch {
      apply(() => setError('Network error while loading inspections'))
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    load(tab)
    const id = setInterval(() => { if (!document.hidden && !dialogOpenRef.current) load(tab, true) }, 30_000)
    return () => clearInterval(id)
  }, [load, tab])

  // Live tap on the session admin's token-gated room (Task 91): a new buyer
  // request refreshes the queue instantly — polling is only the degradation.
  const sessionUser = useAuthStore((s) => s.user)
  const adminRoom = sessionUser?.userType === 'admin' && sessionUser.id ? `admin:${sessionUser.id}` : ''
  const lastEventRef = useRef('')
  useRealtimeRoom(adminRoom ? [adminRoom] : [], {
    onEvent: (message) => {
      const key = `${message.event}:${message.receivedAt.getTime()}`
      if (key === lastEventRef.current) return
      lastEventRef.current = key
      if (message.event === 'inspection:new') {
        toast('New inspection requested', { description: 'A buyer asked for an inspection — the queue is refreshing.' })
        void load(tab, true)
      }
    },
  })

  const openDialog = (row: AdminInspectionRow, action: 'schedule' | 'complete' | 'fail') => {
    setDialog({ row, action })
    setScheduledAt('')
    setReportUrl('')
    setNote('')
    setDialogError('')
  }

  const submit = async () => {
    if (!dialog) return
    setDialogError('')
    const body: Record<string, unknown> = { action: dialog.action }
    if (dialog.action === 'schedule') {
      if (!scheduledAt) { setDialogError('Pick a date and time for the inspection.'); return }
      const d = new Date(scheduledAt)
      if (isNaN(d.getTime())) { setDialogError('That date could not be parsed.'); return }
      body.scheduledAt = d.toISOString()
    }
    if (dialog.action === 'complete') {
      if (!reportUrl.trim()) { setDialogError('A completed inspection requires its report URL.'); return }
      body.reportUrl = reportUrl.trim()
    }
    if (dialog.action === 'fail') {
      if (!note.trim()) { setDialogError('A failed inspection requires the finding, verbatim.'); return }
      body.note = note.trim()
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inspections/${dialog.row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const details = json?.details ? Object.values(json.details).flat().join(' ') : ''
        setDialogError((json?.error || `Failed (HTTP ${res.status})`) + (details ? ` — ${details}` : ''))
        return
      }
      toast.success(dialog.action === 'schedule' ? 'Inspection scheduled — the buyer has been notified'
        : dialog.action === 'complete' ? 'Inspection completed — report attached'
        : 'Marked failed — the buyer has been notified with your finding')
      setDialog(null)
      void load(tab, true)
    } catch {
      setDialogError('Network error while updating the inspection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('admin-dashboard')} className="text-muted-foreground hover:text-primary">
            <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inspections</h1>
            <p className="text-muted-foreground text-sm">Buyers asking for quality checks before accepting bulk orders</p>
          </div>
        </div>
        <Badge className="bg-primary hover:bg-[#C62828] dark:hover:bg-primary/90 text-white">Admin Panel</Badge>
      </div>

      {needsAuth ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-semibold text-amber-900">Admin access required</p>
          <p className="text-sm text-amber-800 mt-1">Sign in with an admin account to run inspections.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Total</span><span className="font-semibold tabular-nums">{stats?.total ?? '…'}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Pending</span><span className="font-semibold tabular-nums text-amber-700">{stats?.pending ?? 0}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Scheduled</span><span className="font-semibold tabular-nums text-primary">{stats?.scheduled ?? 0}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Completed</span><span className="font-semibold tabular-nums text-green-700">{stats?.completed ?? 0}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Failed</span><span className="font-semibold tabular-nums text-red-700">{stats?.failed ?? 0}</span></span>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => load(tab)} disabled={refreshing} className="text-muted-foreground">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" className="h-8 text-xs capitalize" onClick={() => setTab(t)}>
                {t}
              </Button>
            ))}
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="flex justify-center mb-2"><ClipboardCheck className="h-8 w-8 text-muted-foreground/40" /></div>
              <p className="font-medium">No inspections here</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                When a buyer requests an inspection on their order, it lands here live — schedule it, complete it with the report, or fail it with the finding.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {rows.map((r) => (
                <div key={r.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">#{r.orderNumber || r.orderId}</p>
                      <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{r.inspectorType === 'third_party' ? 'third-party' : 'self'}</span>
                      {r.orderTotal != null && <span className="text-[10px] text-muted-foreground">৳{r.orderTotal.toLocaleString()}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.buyerName || 'A buyer'} · requested {fmt(r.createdAt)}
                      {r.scheduledAt ? ` · slot ${fmt(r.scheduledAt)}` : ''}
                      {r.completedAt ? ` · done ${fmt(r.completedAt)}` : ''}
                    </p>
                    {r.reportUrl && (
                      <a href={r.reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1">
                        report <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === 'pending' && (
                      <Button size="sm" className="h-8 text-xs" disabled={busyId === r.id} onClick={() => openDialog(r, 'schedule')}>Schedule</Button>
                    )}
                    {r.status === 'scheduled' && (
                      <>
                        <Button size="sm" className="h-8 text-xs" disabled={busyId === r.id} onClick={() => openDialog(r, 'complete')}>Complete</Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" disabled={busyId === r.id} onClick={() => openDialog(r, 'fail')}>Fail</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-right">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s · live taps on admin room` : ''}
          </p>
        </>
      )}

      <Dialog open={dialog !== null} onOpenChange={(v) => { if (!v && !submitting) setDialog(null) }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{dialog?.action} inspection</DialogTitle>
            <DialogDescription>
              {dialog?.action === 'schedule' && 'Book the inspection slot — the buyer is notified with the exact time.'}
              {dialog?.action === 'complete' && 'Attach the REAL report URL — a completed inspection without its report is refused.'}
              {dialog?.action === 'fail' && 'Record the finding — it reaches the buyer verbatim.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {dialog?.action === 'schedule' && (
              <div className="grid gap-1.5">
                <Label htmlFor="insp-at">Inspection slot *</Label>
                <Input id="insp-at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
            )}
            {dialog?.action === 'complete' && (
              <div className="grid gap-1.5">
                <Label htmlFor="insp-report">Report URL *</Label>
                <Input id="insp-report" value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder="https://reports.example.com/INS-219.pdf" />
              </div>
            )}
            {dialog?.action === 'fail' && (
              <div className="grid gap-1.5">
                <Label htmlFor="insp-note">Finding *</Label>
                <textarea id="insp-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="What did the inspection find?" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            )}
            {dialogError && <p className="text-sm text-red-600" role="alert">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={submitting}>Back</Button>
            <Button onClick={() => void submit()} disabled={submitting} className="capitalize">
              {submitting ? 'Working…' : `${dialog?.action || ''} inspection`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
