'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ShieldCheck, Search, RefreshCw, AlertTriangle, XCircle, CheckCircle2,
  Clock, Check, Ban, ChevronDown, ChevronUp, Building2, FileWarning, Eye, FileText
} from 'lucide-react'

// ── Real API types (GET /api/admin/suppliers) ──────────────────────────
// Empty-string KYC fields mean the supplier genuinely did not provide the value.
interface ApiDocument {
  id: string
  documentType: string
  fileName: string
  fileUrl: string | null
  fileSize: string | null
  status: string
  rejectionReason: string | null
  uploadedAt: string
  reviewedAt: string | null
}

interface ApiSupplier {
  id: string
  userId: string
  companyName: string
  email: string
  phone: string
  accountStatus: string
  isEmailVerified: boolean
  isPhoneVerified: boolean
  nidNumber: string
  tradeLicenseNumber: string
  tinNumber: string
  bankAccountName: string
  bankAccountNumber: string
  bankName: string
  branch: string
  verificationStatus: string
  rejectionReason: string | null
  verifiedAt: string | null
  ratingAvg: number
  ratingCount: number
  productCount: number
  registeredAt: string
  kycSubmittedAt: string
  updatedAt: string
  documents?: ApiDocument[]
}

type SupplierTab = 'pending' | 'under_review' | 'approved' | 'rejected'

const TAB_LABELS: Record<SupplierTab, string> = {
  pending: 'Pending review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
}

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 rounded-lg px-2 py-1 text-slate-500 dark:text-neutral-400'

const KYC_FIELDS: { key: keyof ApiSupplier; label: string }[] = [
  { key: 'nidNumber', label: 'NID number' },
  { key: 'tradeLicenseNumber', label: 'Trade license no.' },
  { key: 'tinNumber', label: 'TIN' },
  { key: 'bankAccountName', label: 'Bank account name' },
  { key: 'bankAccountNumber', label: 'Bank account no.' },
  { key: 'bankName', label: 'Bank name' },
  { key: 'branch', label: 'Branch' },
]

function kycProvidedCount(s: ApiSupplier): number {
  return KYC_FIELDS.filter(f => typeof s[f.key] === 'string' && (s[f.key] as string).trim().length > 0).length
}

// Real documentType values written by POST /api/supplier/verification
const DOC_TYPE_LABELS: Record<string, string> = {
  nid_front: 'NID (front)',
  nid_back: 'NID (back)',
  trade_license: 'Trade license',
  tin_certificate: 'TIN certificate',
  bank_statement: 'Bank statement',
  utility_bill: 'Utility bill',
}

const DOC_STATUS_STYLES: Record<string, string> = {
  pending: 'text-amber-600 bg-amber-50 border-amber-200',
  under_review: 'text-sky-600 bg-sky-50 border-sky-200',
  verified: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  rejected: 'text-red-600 bg-red-50 border-red-200',
}

function isImageUrl(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase()
  return /\.(jpe?g|png|webp|gif)$/.test(clean)
}

function fmtBytes(size: string | null): string {
  if (!size) return ''
  const n = Number(size)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/**
 * Real verification-document media strip (Task 52-c): admins approve/reject
 * KYC with eyes on the docs the supplier actually uploaded — thumbnails for
 * images, file chips for anything else, honest absence when there is nothing.
 */
function VerificationDocuments({ documents }: { documents: ApiDocument[] | undefined }) {
  const docs = Array.isArray(documents) ? documents : []
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Verification documents</p>
      {docs.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 bg-white dark:bg-gray-900 border border-slate-100 dark:border-neutral-800 rounded-xl px-3 py-2">
          No documents uploaded yet — this supplier has not submitted any verification files. Approving now means approving without document evidence.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {docs.map((doc) => {
            const label = DOC_TYPE_LABELS[doc.documentType] || doc.documentType
            const statusStyle = DOC_STATUS_STYLES[doc.status] || 'text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800'
            const size = fmtBytes(doc.fileSize)
            return (
              <div key={doc.id} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-2 w-[128px] space-y-1.5">
                {doc.fileUrl ? (
                  isImageUrl(doc.fileUrl) ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" title={`Open ${label} full size`}>
                      <img
                        src={doc.fileUrl}
                        alt={`${label} document uploaded by the supplier`}
                        loading="lazy"
                        className="h-16 w-full object-cover rounded-lg border border-slate-100 dark:border-neutral-800"
                      />
                    </a>
                  ) : (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-16 w-full rounded-lg border border-slate-100 dark:border-neutral-800 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 hover:bg-slate-50 dark:bg-background dark:hover:bg-card"
                    >
                      <FileText className="h-5 w-5" />
                      <span className="text-[9px] font-bold">Open file</span>
                    </a>
                  )
                ) : (
                  <div className="h-16 w-full rounded-lg border border-dashed border-slate-200 dark:border-neutral-800 dark:border-neutral-700 flex flex-col items-center justify-center gap-1 text-slate-300">
                    <FileWarning className="h-5 w-5" />
                    <span className="text-[9px] font-bold">No file</span>
                  </div>
                )}
                <p className="text-[10px] font-black text-slate-700 dark:text-neutral-300 truncate">{label}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[9px] font-bold border rounded-md px-1.5 py-0.5 ${statusStyle}`}>{doc.status}</span>
                  {size && <span className="text-[9px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{size}</span>}
                </div>
                {doc.status === 'rejected' && doc.rejectionReason && (
                  <p className="text-[9px] text-red-500 leading-snug">{doc.rejectionReason}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AdminSuppliersPage() {
  const { navigate } = useNavigationStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([])
  const [tab, setTab] = useState<SupplierTab>('pending')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)

  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [armedId, setArmedId] = useState<string | null>(null)   // approve / re-review confirm state
  const [rejectId, setRejectId] = useState<string | null>(null) // inline reject reason form
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState('')
  const [rowErrorId, setRowErrorId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const loadSuppliers = useCallback(async (opts?: { tab?: SupplierTab; q?: string; page?: number }) => {
    const useTab = opts?.tab ?? tab
    const useQ = opts?.q ?? q
    const usePage = opts?.page ?? page
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const params = new URLSearchParams({
        status: useTab,
        page: String(usePage),
        limit: '20',
      })
      if (useQ) params.set('search', useQ)
      const res = await fetch(`/api/admin/suppliers?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setNeedsAuth(true); setSuppliers([]); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load suppliers (HTTP ${res.status})`)
        setSuppliers([])
        return
      }
      setSuppliers(Array.isArray(json.data) ? json.data : [])
      setTotalPages(json.pagination?.totalPages || 0)
      setTotal(json.pagination?.total || 0)
    } catch {
      setError('Network error while loading the verification queue. Check your connection and retry.')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [tab, q, page])

  useEffect(() => { loadSuppliers() }, [loadSuppliers])

  const clearTransient = () => {
    setArmedId(null)
    setRejectId(null)
    setReason('')
    setReasonError('')
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
  }

  const switchTab = (t: SupplierTab) => {
    setTab(t)
    setPage(1)
    setDetailsId(null)
    clearTransient()
    loadSuppliers({ tab: t, page: 1 })
  }

  const armAction = (s: ApiSupplier) => {
    setArmedId(armedId === s.id ? null : s.id)
    setRejectId(null)
    setReason('')
    setReasonError('')
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
  }

  const openReject = (s: ApiSupplier) => {
    setRejectId(rejectId === s.id ? null : s.id)
    setReason('')
    setReasonError('')
    setArmedId(null)
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
  }

  const patchSupplier = async (s: ApiSupplier, action: 'approve' | 'reject' | 'review') => {
    if (action === 'reject' && reason.trim().length === 0) {
      setReasonError('A rejection reason is required before rejecting a supplier.')
      return
    }
    setActingId(s.id)
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          supplierId: s.id,
          action,
          reason: action === 'reject' ? reason.trim() : undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Surface the real backend error verbatim (401 admin, 400 validation, 404, 500 …).
        setRowError(json?.error || `Action failed (HTTP ${res.status})`)
        setRowErrorId(s.id)
        return
      }
      // Real 2xx — verificationStatus is genuinely updated server-side. Show success, then reload.
      const name = s.companyName || s.email || 'This supplier'
      const verb = action === 'approve'
        ? 'approved — they can now sell on the marketplace.'
        : action === 'reject'
          ? 'rejected — their account cannot list products until re-approved.'
          : 'moved back to Under review.'
      setSuccessMsg(`"${name}" ${verb}`)
      clearTransient()
      loadSuppliers()
    } catch {
      setRowError('Network error while submitting the action. Check your connection and retry.')
      setRowErrorId(s.id)
    } finally {
      setActingId(null)
    }
  }

  const fmtDate = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '--'

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded-lg px-2 py-0.5">APPROVED</span>
      case 'rejected': return <span className="text-[10px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-2 py-0.5">REJECTED</span>
      case 'under_review': return <span className="text-[10px] font-black text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-900 rounded-lg px-2 py-0.5">UNDER REVIEW</span>
      default: return <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg px-2 py-0.5">PENDING</span>
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">The supplier KYC verification queue is restricted to Zylod admins. Sign in with an admin account to review supplier applications.</p>
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
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Supplier Verification</h1>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Review supplier KYC submissions. Only approved suppliers can list products on the marketplace.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadSuppliers()} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-neutral-800 dark:border-neutral-700">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TAB_LABELS) as SupplierTab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${tab === t ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-neutral-800 dark:border-neutral-700 text-slate-600 dark:text-neutral-400 dark:text-neutral-300'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 dark:text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadSuppliers({ q, page: 1 }) } }}
            placeholder="Search company, email or phone…"
            className="h-9 pl-9 rounded-xl text-xs"
          />
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-2xl px-4 py-3 text-xs font-bold">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-neutral-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the verification queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadSuppliers()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-slate-200 dark:border-neutral-800 text-center space-y-2">
          {tab === 'pending' ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-sm font-black">No suppliers waiting for review</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">
                {q ? `No pending suppliers match "${q}".` : "New supplier applications appear here the moment they register with KYC details."}
              </p>
            </>
          ) : tab === 'under_review' ? (
            <>
              <Clock className="h-10 w-10 text-sky-500 mx-auto" />
              <h2 className="text-sm font-black">Nothing is under review right now</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">
                {q ? `No suppliers under review match "${q}".` : 'Use “Start review” on a pending application to move it here while you verify its documents.'}
              </p>
            </>
          ) : tab === 'approved' ? (
            <>
              <Building2 className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No approved suppliers yet</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">
                {q ? `No approved suppliers match "${q}".` : 'Suppliers you approve from the Pending or Under review tabs appear here.'}
              </p>
            </>
          ) : (
            <>
              <FileWarning className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No rejected suppliers</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">
                {q ? `No rejected suppliers match "${q}".` : 'Rejected applications (with your recorded reason) appear here.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => {
            const isDetailsOpen = detailsId === s.id
            const provided = kycProvidedCount(s)
            const isRejectOpen = rejectId === s.id
            const displayName = s.companyName || '(company name not provided)'
            return (
              <div key={s.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[220px] flex-1">
                    {tab === 'pending'
                      ? <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      : tab === 'under_review'
                        ? <Eye className="h-4 w-4 text-sky-500 shrink-0" />
                        : tab === 'approved'
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          : <FileWarning className="h-4 w-4 text-red-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-neutral-200 truncate">{displayName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 truncate">{s.email || s.phone || '--'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={chipClass}>KYC {provided}/{KYC_FIELDS.length} provided</span>
                    <span className={chipClass}>{s.productCount} product{s.productCount === 1 ? '' : 's'}</span>
                    <span className={chipClass}>★ {s.ratingAvg.toFixed(1)} ({s.ratingCount})</span>
                    {s.accountStatus !== 'active' && <span className="text-[10px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-2 py-1">{s.accountStatus.toUpperCase()}</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 min-w-[90px]">
                    {fmtDate(s.registeredAt)}
                    <span className="block">registered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setDetailsId(isDetailsOpen ? null : s.id); setArmedId(null); setRejectId(null); setRowError(''); setRowErrorId(null) }}
                      className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 dark:border-neutral-800 dark:border-neutral-700 gap-1.5"
                    >
                      {isDetailsOpen ? <><ChevronUp className="h-3.5 w-3.5" /> Hide KYC</> : <><ChevronDown className="h-3.5 w-3.5" /> View KYC</>}
                    </Button>
                    {/* Approve — available in every tab, always arm→confirm */}
                    {armedId === s.id ? (
                      <>
                        <Button variant="outline" onClick={() => setArmedId(null)} className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 dark:border-neutral-800 dark:border-neutral-700">Cancel</Button>
                        <Button
                          onClick={() => patchSupplier(s, 'approve')}
                          disabled={actingId === s.id}
                          className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> {actingId === s.id ? 'Approving…' : 'Confirm approve'}
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => armAction(s)} className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                    {/* Reject — arm via inline form; not shown on rejected tab (already rejected) */}
                    {tab !== 'rejected' && (
                      <Button
                        variant="outline"
                        onClick={() => openReject(s)}
                        className="h-9 px-4 rounded-xl text-xs font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 gap-1.5"
                      >
                        {isRejectOpen ? <><ChevronUp className="h-3.5 w-3.5" /> Close</> : <><Ban className="h-3.5 w-3.5" /> Reject</>}
                      </Button>
                    )}
                    {/* Start / re-open review */}
                    {(tab === 'pending' || tab === 'rejected') && (
                      <Button
                        variant="outline"
                        onClick={() => patchSupplier(s, 'review')}
                        disabled={actingId === s.id}
                        className="h-9 px-4 rounded-xl text-xs font-bold border-sky-200 dark:border-sky-900 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950 gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" /> {tab === 'pending' ? 'Start review' : 'Re-review'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Real action error (verbatim from the backend) */}
                {rowErrorId === s.id && rowError && (
                  <div className="mx-4 mb-3 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {rowError}
                  </div>
                )}

                {/* KYC detail panel — real submitted data only; empty means the supplier never provided it */}
                {isDetailsOpen && (
                  <div className="border-t border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-background/40 p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">KYC submission</p>
                      {statusBadge(s.verificationStatus)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {KYC_FIELDS.map((f) => {
                        const val = (s[f.key] as string) || ''
                        return (
                          <div key={String(f.key)} className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-neutral-800 rounded-xl px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{f.label}</p>
                            <p className={`text-xs font-bold truncate ${val ? 'text-slate-800 dark:text-neutral-200' : 'text-slate-400 dark:text-neutral-500 italic font-normal'}`}>
                              {val || 'Not provided'}
                            </p>
                          </div>
                        )
                      })}
                      <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-neutral-800 rounded-xl px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">Contact</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-neutral-200 truncate">{s.email || 'No email'}</p>
                        <p className="text-[10px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 truncate">{s.phone || 'No phone'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
                      <span>Email verified: <b className={s.isEmailVerified ? 'text-emerald-600' : 'text-slate-500 dark:text-neutral-400'}>{s.isEmailVerified ? 'yes' : 'no'}</b></span>
                      <span>Phone verified: <b className={s.isPhoneVerified ? 'text-emerald-600' : 'text-slate-500 dark:text-neutral-400'}>{s.isPhoneVerified ? 'yes' : 'no'}</b></span>
                      <span>KYC submitted: <b>{fmtDate(s.kycSubmittedAt)}</b></span>
                      {s.verifiedAt && <span>Last decision: <b>{fmtDate(s.verifiedAt)}</b></span>}
                    </div>
                    {/* Real uploaded verification documents (Task 52-c media strip) */}
                    <VerificationDocuments documents={s.documents} />
                    {/* Real rejection reason recorded by an admin */}
                    {s.verificationStatus === 'rejected' && (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-wider text-red-500">Rejection reason</p>
                        <p className="text-xs font-bold text-red-700 dark:text-red-400">{s.rejectionReason || '--'}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Approving verifies this supplier&apos;s identity based on the KYC data and uploaded documents above. Fields marked &quot;Not provided&quot; were never submitted, and a missing documents strip means no verification files exist — approving without them is a blind approval. Every decision is audit-logged with your admin account.
                    </p>
                  </div>
                )}

                {/* Inline reject form */}
                {isRejectOpen && (
                  <div className="border-t border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-background/40 p-4 space-y-3">
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed">
                      Rejecting sets this supplier to Rejected — they cannot list products until re-approved. The reason is REQUIRED and stored in the server audit log and on the supplier record.
                    </p>
                    <div className="space-y-1">
                      <label htmlFor={`reject-reason-${s.id}`} className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400 block">Reason (required)</label>
                      <Input
                        id={`reject-reason-${s.id}`}
                        value={reason}
                        onChange={(e) => { setReason(e.target.value); setReasonError('') }}
                        placeholder="e.g. trade license number could not be verified with the issuing authority"
                        className="h-10 rounded-xl text-xs"
                      />
                      {reasonError && (
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400">{reasonError}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setRejectId(null); setReason(''); setReasonError('') }} className="h-10 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-neutral-800 dark:border-neutral-700">Cancel</Button>
                      <Button
                        onClick={() => patchSupplier(s, 'reject')}
                        disabled={actingId === s.id}
                        className="h-10 px-5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white gap-1.5"
                      >
                        <Ban className="h-4 w-4" /> {actingId === s.id ? 'Rejecting…' : 'Confirm reject'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{total} supplier{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const np = page - 1; setPage(np); loadSuppliers({ page: np }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const np = page + 1; setPage(np); loadSuppliers({ page: np }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminSuppliersPage
