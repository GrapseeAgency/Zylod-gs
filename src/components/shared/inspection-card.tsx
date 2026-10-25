'use client'

/**
 * InspectionCard — the buyer-side face of the inspection rail (Task 91),
 * embedded in the order detail page. Shows THIS order's inspection history
 * (fetched from the buyer's real GET /api/inspections and filtered here by
 * orderId), lets the buyer request one (self QC or third party), and links
 * the REAL report URL only when an admin recorded one. An in-progress
 * inspection (pending|scheduled) disables re-requesting — the server's 409
 * is surfaced verbatim if a race slips through.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ClipboardCheck, Loader2, FileText, ExternalLink } from 'lucide-react'

interface InspectionRow {
  id: string
  orderId: string
  orderNumber: string | null
  inspectorType: string
  status: 'pending' | 'scheduled' | 'completed' | 'failed'
  reportUrl: string | null
  scheduledAt: string | null
  completedAt: string | null
  createdAt: string
}

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

export function InspectionCard({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [rows, setRows] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inspectorType, setInspectorType] = useState<'self' | 'third_party'>('third_party')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/inspections', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setSignedIn(false)
        setRows([])
        return
      }
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        const all: InspectionRow[] = Array.isArray(json.data?.inspections) ? json.data.inspections : []
        setRows(all.filter((r) => r.orderId === orderId))
        setSignedIn(true)
      }
    } catch {
      // network hiccup — keep prior rows
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const inProgress = rows.some((r) => r.status === 'pending' || r.status === 'scheduled')

  const submit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { orderId, inspectorType }
      if (note.trim()) body.note = note.trim()
      const res = await fetch('/api/inspections', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to request inspection (HTTP ${res.status})`)
        return
      }
      toast.success('Inspection requested', { description: 'The platform team has been notified.' })
      setDialogOpen(false)
      setNote('')
      void load()
    } catch {
      setError('Network error while requesting the inspection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs font-bold">
          <ClipboardCheck className="h-4 w-4 text-slate-600 dark:text-slate-400 dark:text-slate-500" />
          <span>Quality Inspection</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={inProgress || !signedIn}
          onClick={() => { setError(''); setDialogOpen(true) }}
        >
          {inProgress ? 'Inspection in progress' : 'Request inspection'}
        </Button>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1.5">
        Have the shipment checked before you accept the bulk order — {orderNumber ? `order #${orderNumber}` : 'this order'}.
        Only the platform team moves an inspection forward; you are notified at every step.
      </p>

      {loading ? (
        <div className="h-10 rounded-lg bg-muted animate-pulse mt-3" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">No inspections requested for this order yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-start gap-2 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</Badge>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 dark:text-slate-300">
                    {r.inspectorType === 'third_party' ? 'Third-party agency' : 'Self (your QC team)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                  Requested {fmt(r.createdAt)}
                  {r.scheduledAt ? ` · scheduled ${fmt(r.scheduledAt)}` : ''}
                  {r.completedAt ? ` · completed ${fmt(r.completedAt)}` : ''}
                </p>
                {r.status === 'failed' && (
                  <p className="text-[11px] text-red-700 mt-1">The inspection did not pass — see the notification for the finding.</p>
                )}
              </div>
              {r.reportUrl && (
                <a
                  href={r.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" /> Inspection report <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!submitting) setDialogOpen(v) }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Request inspection
            </DialogTitle>
            <DialogDescription>
              {orderNumber ? `Order #${orderNumber}` : 'This order'} will be inspected before you settle for the bulk quantity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={inspectorType === 'third_party' ? 'default' : 'outline'} size="sm"
                onClick={() => setInspectorType('third_party')}>
                Third-party agency
              </Button>
              <Button type="button" variant={inspectorType === 'self' ? 'default' : 'outline'} size="sm"
                onClick={() => setInspectorType('self')}>
                Self (my QC team)
              </Button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What should the inspector focus on? (optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Requesting…</> : 'Request inspection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
