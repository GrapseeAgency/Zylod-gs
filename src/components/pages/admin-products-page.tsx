'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ShieldCheck, Search, RefreshCw, AlertTriangle, XCircle, CheckCircle2,
  Clock, Check, Ban, ChevronDown, ChevronUp, Package, EyeOff
} from 'lucide-react'

// ── Real API types (GET /api/admin/products) ───────────────────────────
interface ApiProduct {
  id: string
  name: string
  slug: string
  basePrice: number
  unit: string
  moq: number
  stockQuantity: number
  supplierName: string
  categoryName: string
  reviewCount: number
  createdAt: string
}

type ProductsTab = 'pending' | 'approved'

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

export function AdminProductsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [tab, setTab] = useState<ProductsTab>('pending')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)

  const [armedId, setArmedId] = useState<string | null>(null)   // approve / unpublish confirm state
  const [rejectId, setRejectId] = useState<string | null>(null) // inline reject reason form
  const [reason, setReason] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState('')
  const [rowErrorId, setRowErrorId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const loadProducts = useCallback(async (opts?: { tab?: ProductsTab; q?: string; page?: number }) => {
    const useTab = opts?.tab ?? tab
    const useQ = opts?.q ?? q
    const usePage = opts?.page ?? page
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const params = new URLSearchParams({
        approved: useTab === 'pending' ? 'false' : 'true',
        page: String(usePage),
        limit: '20',
      })
      if (useQ) params.set('search', useQ)
      const res = await fetch(`/api/admin/products?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setNeedsAuth(true); setProducts([]); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load products (HTTP ${res.status})`)
        setProducts([])
        return
      }
      setProducts(Array.isArray(json.data) ? json.data : [])
      setTotalPages(json.pagination?.totalPages || 0)
      setTotal(json.pagination?.total || 0)
    } catch {
      setError('Network error while loading the moderation queue. Check your connection and retry.')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [tab, q, page])

  useEffect(() => { loadProducts() }, [loadProducts])

  const switchTab = (t: ProductsTab) => {
    setTab(t)
    setPage(1)
    setArmedId(null)
    setRejectId(null)
    setReason('')
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
    loadProducts({ tab: t, page: 1 })
  }

  const armAction = (p: ApiProduct) => {
    setArmedId(armedId === p.id ? null : p.id)
    setRejectId(null)
    setReason('')
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
  }

  const openReject = (p: ApiProduct) => {
    setRejectId(rejectId === p.id ? null : p.id)
    setReason('')
    setArmedId(null)
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
  }

  const patchProduct = async (p: ApiProduct, action: 'approve' | 'reject') => {
    setActingId(p.id)
    setRowError('')
    setRowErrorId(null)
    setSuccessMsg('')
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: p.id,
          action,
          reason: action === 'reject' && tab === 'pending' ? (reason.trim() || undefined) : undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Surface the real backend error verbatim (401 admin, 400 validation, 500 …).
        setRowError(json?.error || `Action failed (HTTP ${res.status})`)
        setRowErrorId(p.id)
        return
      }
      // Real 2xx — isApproved is genuinely updated server-side. Show success, then reload.
      const verb = action === 'approve' ? 'approved' : (tab === 'approved' ? 'unpublished' : 'rejected')
      setSuccessMsg(
        action === 'approve'
          ? `"${p.name}" approved — now live in the public catalog.`
          : `"${p.name}" ${verb} — ${tab === 'approved' ? 'removed from the public catalog.' : 'will not appear in the public catalog.'}`
      )
      setArmedId(null)
      setRejectId(null)
      setReason('')
      loadProducts()
    } catch {
      setRowError('Network error while submitting the action. Check your connection and retry.')
      setRowErrorId(p.id)
    } finally {
      setActingId(null)
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">This moderation queue is restricted to Zylod admins. Sign in with an admin account to approve or reject product listings.</p>
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
            <h1 className="text-lg md:text-xl font-black tracking-tight">Product Moderation</h1>
            <p className="text-[11px] text-slate-400">Approve or reject supplier product listings. Only approved products appear in the public catalog.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => loadProducts()} className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => switchTab('pending')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition ${tab === 'pending' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Pending approval
        </button>
        <button
          onClick={() => switchTab('approved')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition ${tab === 'approved' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Approved
        </button>
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadProducts({ q, page: 1 }) } }}
            placeholder="Search name or supplier…"
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
            <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load the moderation queue</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadProducts()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          {tab === 'pending' ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-sm font-black">No products waiting for review</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {q ? `No pending products match "${q}".` : "New supplier listings appear here as soon as they're submitted."}
              </p>
            </>
          ) : (
            <>
              <Package className="h-10 w-10 text-slate-300 mx-auto" />
              <h2 className="text-sm font-black">No approved products yet</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {q ? `No approved products match "${q}".` : 'Products you approve from the Pending tab appear here.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const isRejectOpen = rejectId === p.id
            return (
              <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Row */}
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[220px] flex-1">
                    {tab === 'pending'
                      ? <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      : <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.supplierName || '--'}</p>
                    </div>
                  </div>
                  <div className="text-right min-w-[110px] ml-auto">
                    <p className="text-sm font-black text-primary">{formatPrice(p.basePrice)}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400">per {p.unit || '--'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={chipClass}>MOQ {p.moq.toLocaleString()}</span>
                    <span className={chipClass}>{p.stockQuantity.toLocaleString()} in stock</span>
                    <span className={chipClass}>{p.categoryName || '--'}</span>
                    <span className={chipClass}>{p.reviewCount} review{p.reviewCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 min-w-[90px]">
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="block">submitted</span>
                  </div>
                  {tab === 'pending' && (
                    <div className="flex items-center gap-2">
                      {armedId === p.id ? (
                        <>
                          <Button variant="outline" onClick={() => setArmedId(null)} className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700">Cancel</Button>
                          <Button
                            onClick={() => patchProduct(p, 'approve')}
                            disabled={actingId === p.id}
                            className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> {actingId === p.id ? 'Approving…' : 'Confirm approve'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button onClick={() => armAction(p)} className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => openReject(p)}
                            className="h-9 px-4 rounded-xl text-xs font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 gap-1.5"
                          >
                            {isRejectOpen ? <><ChevronUp className="h-3.5 w-3.5" /> Close</> : <><ChevronDown className="h-3.5 w-3.5" /> Reject</>}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {tab === 'approved' && (
                    <div className="flex items-center gap-2">
                      {armedId === p.id ? (
                        <>
                          <Button variant="outline" onClick={() => setArmedId(null)} className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700">Cancel</Button>
                          <Button
                            onClick={() => patchProduct(p, 'reject')}
                            disabled={actingId === p.id}
                            className="h-9 px-4 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white gap-1.5"
                          >
                            <Ban className="h-3.5 w-3.5" /> {actingId === p.id ? 'Unpublishing…' : 'Confirm unpublish'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => armAction(p)}
                          className="h-9 px-4 rounded-xl text-xs font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 gap-1.5"
                        >
                          <EyeOff className="h-3.5 w-3.5" /> Unpublish
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Real action error (verbatim from the backend) */}
                {rowErrorId === p.id && rowError && (
                  <div className="mx-4 mb-3 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {rowError}
                  </div>
                )}

                {/* Inline reject form (pending tab) */}
                {tab === 'pending' && isRejectOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-3">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Rejecting sets this product to not approved — it will not appear in the public catalog. The optional reason is stored in the server audit log for this action.
                    </p>
                    <div className="space-y-1">
                      <label htmlFor={`reject-reason-${p.id}`} className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Reason (optional)</label>
                      <Input
                        id={`reject-reason-${p.id}`}
                        value={reason}
                        onChange={(e) => { setReason(e.target.value) }}
                        placeholder="e.g. images do not match the listed specifications"
                        className="h-10 rounded-xl text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setRejectId(null); setReason('') }} className="h-10 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700">Cancel</Button>
                      <Button
                        onClick={() => patchProduct(p, 'reject')}
                        disabled={actingId === p.id}
                        className="h-10 px-5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white gap-1.5"
                      >
                        <Ban className="h-4 w-4" /> {actingId === p.id ? 'Rejecting…' : 'Confirm reject'}
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
              <span className="text-[11px] text-slate-400">{total} product{total === 1 ? '' : 's'} · page {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => { const np = page - 1; setPage(np); loadProducts({ page: np }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Previous</Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { const np = page + 1; setPage(np); loadProducts({ page: np }) }} className="h-9 px-4 rounded-xl text-xs font-bold">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminProductsPage
