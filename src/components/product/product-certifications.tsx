'use client'

/**
 * THE CERTIFICATION TRUST SURFACE (Task 92) — one component, two modes,
 * fed ONLY by the real productCertifications rail:
 *
 *   Display mode (PDP "Certifications" tab + product-specifications page):
 *   fetches GET /api/products/[id]/certifications (public), renders every
 *   row with its server-computed status badge (Valid / Expiring soon /
 *   Expired), the issuing authority, certificate number, validity window
 *   and the document link when one exists. ZERO fabricated claims — when
 *   a product has no certifications the honest empty state says so.
 *
 *   Manage mode (seller-edit-product): the product's OWN supplier adds
 *   certifications through the real POST rail (name, issuer, number,
 *   issued/expiry dates, document URL) and removes rows through the real
 *   DELETE rail. Server errors surface verbatim (409 cap, 400 field
 *   issues). Listens on the PUBLIC product:<id> room — a change from any
 *   console refreshes the list live without a refresh.
 */

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import {
  Award, BadgeCheck, CalendarClock, ExternalLink, FileWarning,
  Loader2, Plus, ShieldCheck, Trash2,
} from 'lucide-react'

export interface CertificationRow {
  id: string
  certName: string
  certNumber: string | null
  issuedBy: string
  issuedAt: string
  expiresAt: string | null
  documentUrl: string | null
  status: 'active' | 'expiring_soon' | 'expired'
}

const STATUS_META: Record<CertificationRow['status'], { label: string; cls: string }> = {
  active: { label: 'Valid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring_soon: { label: 'Expiring soon', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10)
}

function StatusChip({ status }: { status: CertificationRow['status'] }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}>
      {status === 'expired' ? <FileWarning className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
      {meta.label}
    </span>
  )
}

function CertRow({ cert, onDelete, deleting }: {
  cert: CertificationRow
  onDelete?: (id: string) => void
  deleting?: boolean
}) {
  return (
    <div className="flex items-start gap-3 p-3.5">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
          cert.status === 'expired'
            ? 'bg-rose-50 border-rose-100 text-rose-500'
            : 'bg-emerald-50 border-emerald-100 text-emerald-600'
        }`}
      >
        {cert.status === 'expired' ? <FileWarning className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{cert.certName}</h4>
          <StatusChip status={cert.status} />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
          Issued {fmtDate(cert.issuedAt)} by {cert.issuedBy}
          {cert.expiresAt ? ` · valid until ${fmtDate(cert.expiresAt)}` : ' · no expiry on file'}
        </p>
        {cert.certNumber && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Cert № {cert.certNumber}</p>
        )}
        {cert.documentUrl && (
          <a
            href={cert.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline mt-1"
          >
            View document <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={deleting}
              className="h-8 w-8 p-0 text-slate-400 dark:text-slate-500 hover:text-rose-600 shrink-0"
              aria-label={`Remove certification ${cert.certName}`}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this certification?</AlertDialogTitle>
              <AlertDialogDescription>
                “{cert.certName}” will disappear from the product page immediately and the
                removal is recorded in the audit log. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(cert.id)}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

const EMPTY_FORM = { certName: '', certNumber: '', issuedBy: '', issuedAt: '', expiresAt: '', documentUrl: '' }

export function ProductCertifications({ productId, manage = false }: {
  productId: string
  manage?: boolean
}) {
  const [certs, setCerts] = useState<CertificationRow[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!productId) return
    try {
      const res = await fetch(`/api/products/${productId}/certifications`)
      const json = await res.json().catch(() => null)
      if (res.ok && json) {
        setCerts(Array.isArray(json.data) ? json.data : [])
        setLoadError('')
      } else {
        setLoadError(json?.error || 'Failed to load certifications')
      }
    } catch {
      setLoadError('Failed to load certifications')
    }
  }, [productId])

  useEffect(() => { load() }, [load])

  // PUBLIC product room — additions/removals from any console refresh live.
  useRealtimeRoom(productId ? [`product:${productId}`] : [], {
    onEvent: (m) => { if (m.event === 'product:certifications') load() },
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const payload: Record<string, unknown> = {
      certName: form.certName.trim(),
      issuedBy: form.issuedBy.trim(),
      issuedAt: form.issuedAt,
    }
    if (form.certNumber.trim()) payload.certNumber = form.certNumber.trim()
    if (form.expiresAt) payload.expiresAt = form.expiresAt
    if (form.documentUrl.trim()) payload.documentUrl = form.documentUrl.trim()
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${productId}/certifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success('Certification added — the product page now shows it')
        setForm(EMPTY_FORM)
        load()
      } else if (res.status === 400 && json?.issues) {
        const first = Object.values(json.issues as Record<string, string[]>)[0]?.[0]
        setFormError(first || json.error || 'Invalid certification payload')
      } else {
        setFormError(json?.error || `Failed to add certification (${res.status})`)
      }
    } catch {
      setFormError('Network error — certification not saved')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/supplier/certifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast.success('Certification removed')
        setCerts((prev) => (prev ? prev.filter((c) => c.id !== id) : prev))
      } else {
        toast.error(json?.error || `Failed to remove (${res.status})`)
      }
    } catch {
      toast.error('Network error — certification not removed')
    } finally {
      setDeletingId(null)
    }
  }

  if (certs === null && !loadError) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-slate-400 dark:text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading certifications…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-4 text-xs text-rose-600">{loadError}</div>
    )
  }

  const list = certs ?? []

  return (
    <div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {list.length === 0 ? (
          <div className="p-4 flex items-start gap-3">
            <Award className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {manage
                ? 'No certifications on file for this product yet. Add real, verifiable certificates only — false claims are strictly penalized.'
                : 'No certifications on file for this product.'}
            </p>
          </div>
        ) : (
          list.map((cert) => (
            <CertRow key={cert.id} cert={cert} onDelete={manage ? remove : undefined} deleting={deletingId === cert.id} />
          ))
        )}
      </div>

      {manage && (
        <form onSubmit={submit} className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">Add certification</span>
          </div>
          {formError && (
            <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cert-name" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500">Certificate name *</Label>
              <Input
                id="cert-name"
                value={form.certName}
                onChange={(e) => setForm((f) => ({ ...f, certName: e.target.value }))}
                placeholder="e.g. ISO 9001:2015"
                required
                minLength={2}
                maxLength={120}
                className="h-9 text-xs bg-white dark:bg-gray-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-issuer" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500">Issued by *</Label>
              <Input
                id="cert-issuer"
                value={form.issuedBy}
                onChange={(e) => setForm((f) => ({ ...f, issuedBy: e.target.value }))}
                placeholder="e.g. BSTA / SGS / TÜV"
                required
                minLength={2}
                maxLength={120}
                className="h-9 text-xs bg-white dark:bg-gray-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-number" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500">Certificate № (optional)</Label>
              <Input
                id="cert-number"
                value={form.certNumber}
                onChange={(e) => setForm((f) => ({ ...f, certNumber: e.target.value }))}
                placeholder="e.g. QMS-2024-00912"
                maxLength={80}
                className="h-9 text-xs bg-white dark:bg-gray-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cert-issued" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500">
                  <CalendarClock className="inline h-3 w-3 mr-1" />Issued on *
                </Label>
                <Input
                  id="cert-issued"
                  type="date"
                  value={form.issuedAt}
                  onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))}
                  required
                  className="h-9 text-xs bg-white dark:bg-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-expires" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500">Expires (optional)</Label>
                <Input
                  id="cert-expires"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="h-9 text-xs bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cert-doc" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500">Document URL (optional)</Label>
              <Input
                id="cert-doc"
                type="url"
                value={form.documentUrl}
                onChange={(e) => setForm((f) => ({ ...f, documentUrl: e.target.value }))}
                placeholder="https://…  (link to the verifiable certificate file)"
                className="h-9 text-xs bg-white dark:bg-gray-900"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={saving || !form.certName.trim() || !form.issuedBy.trim() || !form.issuedAt}
            className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Add certification
          </Button>
        </form>
      )}
    </div>
  )
}
