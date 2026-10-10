'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavigationStore } from '@/store/navigation-store'
import { toast } from 'sonner'
import {
  Scale, RefreshCw, AlertTriangle, CheckCircle2, Inbox, Send, LogIn,
} from 'lucide-react'

// ── Real API types (POST/GET /api/complaints) ──
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

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

// Real complaint status → chip color (honest palette language, same as admin queues)
const statusChipClass: Record<string, string> = {
  open: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  in_review: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border-blue-100 dark:border-blue-900',
  resolved: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  rejected: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900',
  withdrawn: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800',
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

export function DisputeCenterPage() {
  const { navigate } = useNavigationStore()

  // Your recent complaints (real list from GET /api/complaints)
  const [complaints, setComplaints] = useState<ApiComplaint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // File-a-complaint form (no optimistic writes — the server response is applied on 201)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [orderId, setOrderId] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // The REAL server-created complaint (real cuid id + real status) shown after success.
  const [filed, setFiled] = useState<ApiComplaint | null>(null)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)

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

  // Initial load + auto-refresh every 30s (a form submit is not a dialog — the
  // refresh only ever re-reads the server, never clobbers the form itself).
  useEffect(() => {
    loadComplaints()
    const id = setInterval(() => loadComplaints(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadComplaints])

  const submitComplaint = async () => {
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const trimmedOrderId = orderId.trim()

    // Client-side mirror of the server's Zod validation (the server re-checks).
    if (!category) {
      setFormError('Select the category that best fits your complaint.')
      return
    }
    if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
      setFormError('Title must be between 3 and 120 characters.')
      return
    }
    if (trimmedDescription.length < 10 || trimmedDescription.length > 5000) {
      setFormError('Description must be between 10 and 5000 characters.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category,
          title: trimmedTitle,
          description: trimmedDescription,
          ...(trimmedOrderId.length > 0 ? { orderId: trimmedOrderId } : {}),
        }),
      })
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        const json = await res.json().catch(() => null)
        const msg = json?.error || 'Sign in to file a complaint.'
        setFormError(msg)
        toast.error(msg)
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        // Real backend error, verbatim (400 validation with field issues, 404, 403, 429 …)
        let msg = json?.error || `Filing the complaint failed (HTTP ${res.status})`
        const fieldErrors = json?.issues ? Object.values(json.issues as Record<string, string[]>).flat() : []
        if (fieldErrors.length > 0) msg = `${msg}: ${fieldErrors.join('; ')}`
        setFormError(msg)
        toast.error(msg)
        return
      }
      // Real 201 — show the REAL complaint id + status the server created.
      const created = json.data as ApiComplaint
      setFiled(created)
      setCategory('')
      setTitle('')
      setDescription('')
      setOrderId('')
      toast.success(json.message || `Complaint filed (${created.id}). It is now open for review.`)
      loadComplaints(true)
    } catch {
      const msg = 'Network error while filing the complaint. Check your connection and retry.'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <Scale className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Sign in to file a complaint</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          The dispute center needs to know who you are so your complaints stay linked to your account and you can see the real resolution.
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
            <h1 className="text-lg md:text-xl font-black tracking-tight">Dispute Center</h1>
            <p className="text-[11px] text-slate-400">File a complaint and track it for real — the reference you get is the actual record id, and every status change comes from the Zylod review team.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadComplaints(true)}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
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

      {/* File-a-complaint form */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 space-y-3">
        <h2 className="text-sm font-black">File a complaint</h2>

        {filed && (
          // Real confirmation — the actual database id and status the server returned.
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold break-words">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Complaint filed. Your reference is <span className="font-mono">{filed.id}</span> — current status: {filed.status}. It is now waiting for review by the Zylod team.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-xl text-xs">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="complaint-title" className="text-xs font-bold">Title</Label>
            <Input
              id="complaint-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the problem (3–120 characters)"
              className="h-11 rounded-xl text-xs"
              maxLength={120}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="complaint-description" className="text-xs font-bold">Description</Label>
          <Textarea
            id="complaint-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain what happened — the review team reads exactly this (10–5000 characters)"
            className="min-h-[100px] rounded-xl text-xs"
            maxLength={5000}
          />
          <p className="text-[10px] text-slate-400">{description.trim().length}/5000 characters</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="complaint-order" className="text-xs font-bold">Order ID (optional)</Label>
          <Input
            id="complaint-order"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="The order this complaint is about"
            className="h-11 rounded-xl text-xs font-mono"
          />
          <p className="text-[10px] text-slate-400">Leave empty if not order-related. If given, the order must belong to your account.</p>
        </div>

        {formError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-3 py-2 text-[11px] text-red-600 dark:text-red-400 font-bold break-words">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {formError}
          </div>
        )}

        <Button
          onClick={submitComplaint}
          disabled={submitting}
          className="min-h-11 w-full sm:w-auto px-5 rounded-xl text-xs font-bold gap-1.5 text-white"
        >
          <Send className="h-3.5 w-3.5" /> {submitting ? 'Filing…' : 'File complaint'}
        </Button>
      </div>

      {/* Your recent complaints */}
      <div className="space-y-2">
        <h2 className="text-sm font-black">Your recent complaints</h2>
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
            <h3 className="text-sm font-black">Could not load your complaints</h3>
            <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
            <Button onClick={() => loadComplaints()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : complaints.length === 0 ? (
          // Honest empty state — this account truly has zero complaints
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="text-sm font-black">No complaints filed yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Your account has no complaints on record — this list only shows real complaints you have filed.
            </p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin pr-1 space-y-3">
            {complaints.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold border rounded-lg px-2 py-0.5 ${chipClass}`}>{categoryLabel(c.category)}</span>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200 break-words">{c.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Filed {formatTimestamp(c.createdAt)} · ref <span className="font-mono">{c.id}</span>
                      {c.orderId ? ` · order ${c.orderId}` : ' · not order-related'}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-black rounded-lg ${statusChipClass[c.status] || chipClass}`}>
                    {c.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 break-words line-clamp-2">{c.description}</p>
                {c.resolutionNote && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                    <span className="font-black">Resolution:</span> {c.resolutionNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DisputeCenterPage
