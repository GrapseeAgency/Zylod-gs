'use client'

/**
 * SELLER VERIFICATION STATUS — Task 176-c. The previous page shipped a
 * HARDCODED 4-step audit timeline ("Application & Trade Data Submitted /
 * KYC Document Authentication / Trade License & Physical Address
 * Verification / Wholesale Factory Quality & Safety Clearance") with
 * fabricated "Completed" / "In Progress" / "Pending" states — none of it
 * came from any table. It also used `bg-neutral-950` (a hardcoded dark
 * theme that ignores the user's preference) and `text-sky-400` (blue, the
 * forbidden palette).
 *
 * This rewrite wires the page to the REAL /api/supplier/verification rail:
 * each required document type (trade_license, tin_certificate, nid_front,
 * bank_statement) is shown with its actual latest status (pending /
 * under_review / verified / rejected) from the sellerVerificationDocuments
 * table. The overall progress percent is the server's honest fraction of
 * verified required types. Honest 401 gate for non-supplier viewers.
 */
import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, CheckCircle2, Clock, ShieldCheck, AlertCircle,
  FileCheck2, Building2, UploadCloud, MessageSquare, Loader2, Lock, LogIn,
} from 'lucide-react'

interface VerificationDoc {
  id: string
  documentType: string
  fileName: string
  status: string // pending | under_review | verified | rejected
  rejectionReason?: string | null
  uploadedAt: string
  reviewedAt?: string | null
}

interface Progress {
  verifiedRequired: number
  totalRequired: number
  percent: number
  requiredTypes: string[]
}

type AuthState = 'loading' | 'anon' | 'forbidden' | 'supplier'

const DOC_LABELS: Record<string, { label: string; icon: typeof Building2; desc: string }> = {
  trade_license: {
    label: 'Trade License',
    icon: Building2,
    desc: 'Valid trade license issued by City Corporation or Union Parishad for the current fiscal year.',
  },
  tin_certificate: {
    label: 'e-TIN Certificate',
    icon: FileCheck2,
    desc: '12-digit Tax Identification Number certificate registered in Bangladesh.',
  },
  nid_front: {
    label: 'National ID (front)',
    icon: ShieldCheck,
    desc: 'Clear color scan of the front of the business owner or managing director\'s NID.',
  },
  bank_statement: {
    label: 'Bank Account Verification',
    icon: FileCheck2,
    desc: 'Bank statement or cheque leaf matching the registered business name for payouts.',
  },
}

export function SellerVerificationStatusPage() {
  const { navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [docs, setDocs] = useState<VerificationDoc[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    // Resolve viewer role first (honest 401/403 gate before the read).
    fetch('/api/profile', { headers })
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (!res.ok || !json?.data?.userType) {
          setAuthState('anon')
          setLoading(false)
          return
        }
        if (json.data.userType !== 'supplier' && json.data.userType !== 'admin') {
          setAuthState('forbidden')
          setLoading(false)
          return
        }
        setAuthState('supplier')
        // Now load the real verification documents + progress.
        return fetch('/api/supplier/verification', { headers })
      })
      .then(res => (res instanceof Response ? res.json().catch(() => null) : null))
      .then(json => {
        if (!mounted || !json) return
        if (!json.success) {
          setError(json.error || 'Failed to load verification status.')
          setLoading(false)
          return
        }
        setDocs(Array.isArray(json.data) ? json.data : [])
        setProgress(json.progress ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (mounted) {
          setError('Could not reach the verification service. Try again shortly.')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [token])

  // The latest row per document type (the API returns newest-first).
  const latestByType = new Map<string, VerificationDoc>()
  for (const d of docs) {
    if (!latestByType.has(d.documentType)) latestByType.set(d.documentType, d)
  }

  const requiredTypes = progress?.requiredTypes ?? Object.keys(DOC_LABELS)

  const renderEmpty = () => (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('seller-verification')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to verification
      </Button>
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-8 text-center space-y-3">
          {authState === 'anon' ? (
            <>
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                <LogIn className="h-6 w-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Supplier sign-in required</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Verification status is supplier-only. Sign in with a supplier account to see your real KYC progress.
              </p>
              <Button onClick={() => navigate('login')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                <LogIn className="h-4 w-4" /> Sign in
              </Button>
            </>
          ) : (
            <>
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                <Lock className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Supplier access required</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                You are signed in, but verification status is restricted to supplier accounts. Your current role
                does not have permission to view this page.
              </p>
              <Button variant="outline" onClick={() => navigate('seller-verification')} className="text-xs font-bold gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to verification
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (authState !== 'supplier') return renderEmpty()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-8">
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('seller-verification')}
            aria-label="Go back"
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary shrink-0" />
              Verification Timeline
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Live status of your KYC document review</p>
          </div>
        </div>
        <Button
          onClick={() => navigate('seller-create-ticket')}
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex text-xs"
        >
          <MessageSquare className="w-4 h-4 mr-1 text-primary" />
          Contact Support
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 md:px-6 md:py-6">
        {/* Status Card */}
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-base">
                  {progress && progress.verifiedRequired === progress.totalRequired
                    ? 'All required documents verified'
                    : 'Verification in progress'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {progress
                    ? `${progress.verifiedRequired} of ${progress.totalRequired} required documents verified (${progress.percent}%)`
                    : 'Loading progress...'}
                </p>
              </div>
            </div>
            {progress && (
              <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-5 flex items-start gap-3 text-xs">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="font-bold">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Timeline of required document types with real statuses */}
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 space-y-6">
            <h3 className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Required documents
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800">
              {requiredTypes.map((type, idx) => {
                const meta = DOC_LABELS[type] ?? { label: type, icon: FileCheck2, desc: '' }
                const doc = latestByType.get(type)
                const status = doc?.status ?? 'pending'
                const Icon = meta.icon
                return (
                  <div key={type} className="relative">
                    <div
                      className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        status === 'verified'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : status === 'under_review'
                          ? 'bg-slate-50 dark:bg-slate-950 border-amber-500 text-amber-500 animate-pulse'
                          : status === 'rejected'
                          ? 'bg-slate-50 dark:bg-slate-950 border-red-500 text-red-500'
                          : 'bg-slate-50 dark:bg-slate-950 border-gray-300 dark:border-gray-700 text-gray-400'
                      }`}
                    >
                      {status === 'verified' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          {meta.label}
                        </h4>
                        <Badge
                          className={`text-[10px] font-bold shrink-0 ${
                            status === 'verified'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : status === 'under_review'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : status === 'rejected'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {status === 'verified'
                            ? 'Verified'
                            : status === 'under_review'
                            ? 'Under review'
                            : status === 'rejected'
                            ? 'Rejected'
                            : 'Not uploaded'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{meta.desc}</p>
                      {doc && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1">
                          Last upload: {doc.fileName} • {new Date(doc.uploadedAt).toLocaleDateString()}
                          {doc.reviewedAt && ` • reviewed ${new Date(doc.reviewedAt).toLocaleDateString()}`}
                        </p>
                      )}
                      {status === 'rejected' && doc?.rejectionReason && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                          Reason: {doc.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action Callout */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/60 dark:bg-slate-900/60 border border-gray-200 dark:border-gray-800 p-4 rounded-xl">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Need to update an uploaded document or add a missing certificate?
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('seller-create-ticket')}
              className="sm:hidden text-xs flex-1"
            >
              <MessageSquare className="w-4 h-4 mr-1 text-primary" />
              Support
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('seller-verification-upload')}
              className="bg-primary hover:bg-primary/90 text-white text-xs shrink-0 flex-1 sm:flex-none"
            >
              <UploadCloud className="w-4 h-4 mr-1" />
              Upload More
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SellerVerificationStatusPage
