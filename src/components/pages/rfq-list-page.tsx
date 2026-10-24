'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { toast } from 'sonner'
import { roundQty } from '@/lib/product-contract'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ArrowLeft,
  HelpCircle,
  FileText,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  LogIn,
  Plus,
  ChevronDown,
  Truck,
  MessageSquareText,
  RadioTower,
  ShoppingBag,
  PackageCheck,
} from 'lucide-react'

/* ── Real API types (GET /api/rfq · GET /api/rfq/[id] · PATCH /api/rfq/[id]/quotes/[quoteId]) ── */

interface RfqItem {
  id: string
  productName: string
  specifications: string | null
  quantity: number
  unit: string
  targetPrice: number | null
}

/** List rows (GET /api/rfq?role=buyer). Quotes on rows are a take-5 preview —
 * the FULL quote list always comes from GET /api/rfq/[id] on expand.
 * Task 55-b: productId + conversion state arrive additively on the same rows —
 * convertedOrderId gates 'Convert to order' and convertedOrderNumber feeds
 * the 'Order placed' chip. */
interface RfqListItem {
  id: string
  title?: string
  status: string
  description?: string
  categorySlug?: string | null
  quantity?: number | null
  unit?: string
  targetPrice?: number | null
  deliveryCity?: string | null
  deadline?: string | null
  quoteCount?: number
  productId?: string | null
  convertedOrderId?: string | null
  convertedOrderNumber?: string | null
  createdAt: string
  items?: RfqItem[]
}

/** Detail quote (GET /api/rfq/[id]) — supplier is display-name-only by the
 * buyer privacy rule (supplierProfiles.companyName; never email/phone/address). */
interface RfqQuote {
  id: string
  rfqId?: string
  supplierId?: string
  pricePerUnit: number
  totalPrice: number
  deliveryDays: number | null
  message: string | null
  status: string
  createdAt: string
  supplier: { displayName: string | null }
}

interface RfqDetail extends RfqListItem {
  quotes: RfqQuote[]
  buyerName?: string | null
}

/** Real rfqRequests.status values (prisma/schema.prisma: open | quoted | awarded | closed | expired). */
const STATUS_META: Record<string, { color: string; bg: string; border: string; icon: typeof Clock }> = {
  open: { color: '#C8102E', bg: '#FFF1F2', border: '#FECDD3', icon: Clock },
  quoted: { color: '#1565C0', bg: '#E3F2FD', border: '#BBDEFB', icon: FileText },
  awarded: { color: '#7C3AED', bg: '#F3E8FD', border: '#DDD6FE', icon: CheckCircle2 },
  closed: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: CheckCircle2 },
  expired: { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', icon: XCircle },
}

/** Real rfqQuotes.status values (prisma/schema.prisma: pending | accepted | rejected). */
const QUOTE_STATUS_META: Record<string, { color: string; bg: string }> = {
  pending: { color: '#B45309', bg: '#FFFBEB' },
  accepted: { color: '#047857', bg: '#ECFDF5' },
  rejected: { color: '#6B7280', bg: '#F3F4F6' },
}

type AwardAction = 'accept' | 'reject'

function formatBDT(value: number): string {
  return `৳${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export function RfqListPage() {
  const { navigate, goBack } = useNavigationStore()
  const { isAuthenticated } = useAuthStore()

  const [rfqs, setRfqs] = useState<RfqListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  // Expandable detail — one RFQ open at a time; quotes always refetched on expand.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RfqDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Award rail: arm-to-confirm (first tap arms, second tap within 4s executes).
  const [armed, setArmed] = useState<{ quoteId: string; action: AwardAction } | null>(null)
  const [actingQuoteId, setActingQuoteId] = useState<string | null>(null)

  // Convert rail (Task 55-b): the confirm dialog carries the accepted quote
  // exactly as the server will consume it — qty × negotiated unit price.
  const [convertTarget, setConvertTarget] = useState<{
    rfqId: string
    quote: RfqQuote
    quantity: number
    unit: string
  } | null>(null)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertAvailable, setConvertAvailable] = useState<number | null>(null)
  const [converting, setConverting] = useState(false)

  // Latest loaders for the realtime onEvent callback (no resubscribe churn).
  const refreshRef = useRef<() => void>(() => {})

  /* ── List loader — cookie session, real res.ok, verbatim errors ── */
  const loadList = useCallback(async () => {
    if (!isAuthenticated) {
      setNeedsAuth(true)
      setIsLoading(false)
      return
    }
    try {
      const res = await fetch('/api/rfq?role=buyer&limit=30', { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setRfqs(json.data)
        setLoadError(null)
      } else if (res.status === 401) {
        setNeedsAuth(true)
      } else {
        setLoadError(
          typeof json?.error === 'string' && json.error
            ? json.error
            : `Could not load your quote requests (HTTP ${res.status}).`
        )
      }
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  /* ── Detail loader — GET /api/rfq/[id] (full quote list) ── */
  const loadDetail = useCallback(async (rfqId: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const res = await fetch(`/api/rfq/${rfqId}`, { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && json.data) {
        setDetail(json.data)
      } else if (res.status === 401) {
        setNeedsAuth(true)
        setDetailError('Authentication required')
      } else {
        setDetailError(
          typeof json?.error === 'string' && json.error
            ? json.error
            : `Could not load the quotes (HTTP ${res.status}).`
        )
      }
    } catch {
      setDetailError('Network error. Please try again.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const toggleExpand = (rfqId: string) => {
    if (expandedId === rfqId) {
      setExpandedId(null)
      setDetail(null)
      setDetailError(null)
      setArmed(null)
      return
    }
    setExpandedId(rfqId)
    setDetail(null)
    setDetailError(null)
    setArmed(null)
    void loadDetail(rfqId)
  }

  /* ── Award rail action — PATCH, confirm-on-second-tap, verbatim errors ── */
  const executeAction = async (quoteId: string, action: AwardAction) => {
    if (!expandedId) return
    setActingQuoteId(quoteId)
    setArmed(null)
    try {
      const res = await fetch(`/api/rfq/${expandedId}/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && json.data) {
        // Toast reflects ONLY the real server outcome (quote.status + rfqStatus).
        toast.success(
          `Quote ${json.data.quote.status} — RFQ is now "${json.data.rfqStatus}".`,
        )
        // Contract: after any action refetch BOTH the list and the open detail.
        await Promise.all([loadList(), loadDetail(expandedId)])
      } else if (res.status === 401) {
        setNeedsAuth(true)
        toast.error('Authentication required')
      } else {
        toast.error(
          typeof json?.error === 'string' && json.error
            ? json.error
            : `Could not ${action} the quote (HTTP ${res.status}).`
        )
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setActingQuoteId(null)
    }
  }

  // Arm timeout: a confirmation that is never completed resets itself.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 4_000)
    return () => clearTimeout(t)
  }, [armed])

  /* ── Convert rail (Task 55-b) ──
   * Open the confirm dialog with the accepted quote's real numbers. The
   * quantity mirrors the server's formula exactly (rfq.quantity ?? Σ items
   * ?? 1, 2-dp normalized) so the dialog can never promise different math
   * than the order that will be written. */
  const openConvertDialog = (rfqId: string, quote: RfqQuote, rfq: RfqListItem) => {
    const quantity = roundQty(
      rfq.quantity ?? (rfq.items && rfq.items.length > 0 ? rfq.items.reduce((s, it) => s + it.quantity, 0) : 1) ?? 1
    )
    setConvertError(null)
    setConvertAvailable(null)
    setConvertTarget({ rfqId, quote, quantity, unit: rfq.unit || 'units' })
  }

  const executeConvert = async () => {
    if (!convertTarget) return
    setConverting(true)
    setConvertError(null)
    setConvertAvailable(null)
    const { rfqId } = convertTarget
    try {
      const res = await fetch(`/api/rfq/${rfqId}/convert-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201 && json?.success && json.data) {
        // Real success only — the server's real order number and total.
        toast.success(`Order ${json.data.orderNumber} placed`, {
          description: `${json.data.quantity} ${convertTarget.unit} × ${formatBDT(json.data.unitPrice)} — total ${formatBDT(json.data.totalAmount)}.`,
        })
        setConvertTarget(null)
        // Refetch list (conversion state) + detail (honest view).
        await Promise.all([loadList(), loadDetail(rfqId)])
      } else if (res.status === 401) {
        setNeedsAuth(true)
        setConvertError('Authentication required')
      } else {
        // Verbatim server errors in-dialog (409 guards etc.).
        setConvertError(
          typeof json?.error === 'string' && json.error
            ? json.error
            : `Could not convert to an order (HTTP ${res.status}).`
        )
        if (typeof json?.available === 'number') setConvertAvailable(json.available)
      }
    } catch {
      setConvertError('Network error. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  const refreshAll = useCallback(() => {
    void loadList()
    if (expandedId) void loadDetail(expandedId)
  }, [loadList, loadDetail, expandedId])
  refreshRef.current = refreshAll

  /* ── Live: join rfq:<expandedId> via the shared hook ──
   * Token comes from GET /api/realtime/room-token?room=rfq:<id> (rfq rooms are
   * token-gated: buyer-owner / quoting suppliers / admin). If the token request
   * fails or the room is denied, the hook reports denied and this page degrades
   * honestly to refetch-on-action — a live connection is never faked. */
  const { connected, denied } = useRealtimeRoom(expandedId ? [`rfq:${expandedId}`] : [], {
    onEvent: (message) => {
      if (message.event === 'rfq:new-quote') {
        // A seller's new quote landed on the open RFQ — toast + refetch it.
        toast.message('New quote received', {
          description: 'A supplier responded to this request.',
        })
        refreshRef.current()
      } else if (message.event === 'rfq:quote-accepted' || message.event === 'rfq:quote-rejected') {
        // Another tab/device decided a quote — resync silently.
        refreshRef.current()
      } else if (message.event === 'rfq:converted') {
        // Task 55-b: this (or another) tab converted the RFQ to a real order —
        // resync so the 'Order placed' chip and gating reflect server truth.
        toast.success('Order placed', {
          description: 'This quote request was converted to a real order.',
        })
        refreshRef.current()
      } else if (message.event === 'rfq:status') {
        // Cohesion: an admin closed the RFQ (PATCH /api/admin/rfqs/[id] emits
        // rfq:status into this token-gated room). Resync so the status chip
        // and further quoting/acting gates reflect the closure immediately.
        toast.message('Quote request closed', {
          description: 'This request was closed by the platform — it no longer accepts quotes.',
        })
        refreshRef.current()
      }
    },
  })

  /* ── Sign-in gate ── */
  if (!isAuthenticated || needsAuth) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-[#E0E0E0] dark:border-gray-800 p-8 flex flex-col items-center gap-3 text-center shadow-sm max-w-sm w-full">
          <LogIn className="w-8 h-8 text-[#C8102E]" />
          <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white">Sign in to view your quote requests</p>
          <p className="text-xs text-[#6B7280] dark:text-gray-400 max-w-[260px]">
            Your RFQ history and supplier quotes are tied to your account.
          </p>
          <button
            onClick={() => navigate('login')}
            className="mt-1 px-6 min-h-11 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  /* ── Honest reason when the award rail is unavailable ──
   * Mirrors the API contract verbatim (PATCH guards). */
  const awardBlockReason = (rfqStatus: string, quoteStatus: string): string | null => {
    if (quoteStatus !== 'pending') return `Quote already ${quoteStatus}`
    if (rfqStatus !== 'open' && rfqStatus !== 'quoted') {
      return `Cannot accept quotes on an RFQ with status "${rfqStatus}"`
    }
    return null
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950 pb-[calc(64px+env(safe-area-inset-bottom)+24px)]">
      {/* ─── Top Nav Bar (mobile) ─── */}
      <header className="md:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-[#E0E0E0] dark:border-gray-800 h-14 flex items-center justify-between px-4">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-[#C8102E]" />
        </button>
        <span className="text-lg font-bold text-[#C8102E]">Zylod</span>
        <div className="flex items-center">
          <button
            onClick={() => navigate('help-center')}
            className="p-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5 text-[#6B7280] dark:text-gray-400" />
          </button>
          <button
            onClick={() => navigate('quote-request')}
            className="p-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors"
            aria-label="New quote request"
          >
            <Plus className="h-5 w-5 text-[#C8102E]" />
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4 md:max-w-4xl md:px-6 md:py-6">
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#1A1A1A] dark:text-white tracking-tight">My Quote Requests</h1>
            <p className="text-xs text-[#6B7280] dark:text-gray-400 mt-1">Track RFQs and supplier responses in one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('quote-request')}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg"
            >
              <Plus className="h-4 w-4" />
              New RFQ
            </button>
            <button
              onClick={() => navigate('help-center')}
              className="p-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5 text-[#6B7280] dark:text-gray-400" />
            </button>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black text-[#1A1A1A] dark:text-white tracking-tight">My Quote Requests</h1>
          <p className="text-xs text-[#6B7280] dark:text-gray-400 mt-1">Track RFQs and supplier responses in one place.</p>
        </div>

        {/* ─── Loading / Error States ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280] dark:text-gray-400">Loading requests...</p>
          </div>
        )}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-8">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563] dark:text-gray-300">{loadError}</p>
            <button
              onClick={() => { setIsLoading(true); setLoadError(null); void loadList() }}
              className="mt-1 px-6 min-h-11 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg"
            >
              Retry
            </button>
          </div>
        )}
        {!isLoading && !loadError && rfqs.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-[#E0E0E0] dark:border-gray-800 p-8 flex flex-col items-center gap-3 text-center shadow-sm">
            <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
            <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white">No quote requests yet</p>
            <p className="text-xs text-[#6B7280] dark:text-gray-400 max-w-[260px]">
              Start a new RFQ, or open any product and tap &ldquo;Request Quote&rdquo;.
            </p>
            <button
              onClick={() => navigate('quote-request')}
              className="mt-1 inline-flex items-center gap-1.5 px-6 min-h-11 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg"
            >
              <Plus className="h-4 w-4" />
              New RFQ
            </button>
          </div>
        )}

        {/* ─── RFQ Cards (expandable) ─── */}
        <div className="space-y-3">
          {rfqs.map((rfq, idx) => {
            const meta = STATUS_META[rfq.status] || STATUS_META.open
            const StatusIcon = meta.icon
            const isExpanded = expandedId === rfq.id
            const awarded = rfq.status === 'awarded'
            // Task 55-b: the accepted quote from the loaded detail (only when
            // THIS row is the expanded one) — the candidate for conversion.
            const acceptedQuote = isExpanded && detail ? detail.quotes.find((q) => q.status === 'accepted') ?? null : null
            return (
              <motion.div
                key={rfq.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm overflow-hidden ${
                  awarded ? 'border-[#DDD6FE] ring-1 ring-[#DDD6FE]' : 'border-[#E0E0E0] dark:border-gray-800'
                }`}
              >
                {/* Row header — 44px+ target, aria-expanded */}
                <button
                  onClick={() => toggleExpand(rfq.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left p-4 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-white leading-snug line-clamp-2 flex-1">
                      {rfq.title || 'Quote Request'}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        awarded ? 'ring-1' : ''
                      }`}
                      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {rfq.status}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#9CA3AF] dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>
                      {typeof rfq.quantity === 'number'
                        ? `${rfq.quantity.toLocaleString()} ${rfq.unit || 'units'}`
                        : 'Custom quantity'}
                      {typeof rfq.targetPrice === 'number' ? ` · target ${formatBDT(rfq.targetPrice)}` : ''}
                      {typeof rfq.quoteCount === 'number' ? ` · ${rfq.quoteCount} quote${rfq.quoteCount === 1 ? '' : 's'}` : ''}
                    </span>
                    <span>{formatDate(rfq.createdAt)}</span>
                  </div>

                  {/* Task 55-b: emphasis chip on converted RFQs — real order number. */}
                  {rfq.convertedOrderNumber && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        <PackageCheck className="h-3 w-3" />
                        Order placed · {rfq.convertedOrderNumber}
                      </span>
                    </div>
                  )}
                </button>

                {/* ─── Expanded detail ─── */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-4">
                        {/* Description */}
                        {rfq.description && (
                          <p className="text-xs text-[#4B5563] dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {rfq.description}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6B7280] dark:text-gray-400">
                          {rfq.deliveryCity && <span>Deliver to: {rfq.deliveryCity}</span>}
                          {rfq.deadline && <span>Deadline: {formatDate(rfq.deadline)}</span>}
                          {rfq.categorySlug && <span>Category: {rfq.categorySlug}</span>}
                        </div>

                        {/* Items */}
                        {rfq.items && rfq.items.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] dark:text-gray-500">Items</p>
                            {rfq.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between gap-3 text-xs bg-[#F8F9FA] dark:bg-gray-950 rounded-lg px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#1A1A1A] dark:text-white truncate">{item.productName}</p>
                                  {item.specifications && (
                                    <p className="text-[11px] text-[#6B7280] dark:text-gray-400 mt-0.5 whitespace-pre-line">{item.specifications}</p>
                                  )}
                                </div>
                                <div className="shrink-0 text-right text-[#4B5563] dark:text-gray-300">
                                  <p>{item.quantity.toLocaleString()} {item.unit}</p>
                                  {typeof item.targetPrice === 'number' && (
                                    <p className="text-[11px] text-[#6B7280] dark:text-gray-400">target {formatBDT(item.targetPrice)}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ─── Quote rail ─── */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] dark:text-gray-500">
                              Quotes{typeof detail?.quoteCount === 'number' ? ` (${detail.quoteCount})` : ''}
                            </p>
                            {/* Live indicator — only claims a live connection that actually exists */}
                            {isExpanded && (connected || denied) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B7280] dark:text-gray-400">
                                <RadioTower className={`h-3 w-3 ${denied ? 'text-gray-400 dark:text-gray-500' : 'text-emerald-600'}`} />
                                {denied ? 'Live unavailable' : connected ? 'Live' : ''}
                              </span>
                            )}
                          </div>

                          {detailLoading && (
                            <div className="flex items-center gap-2 py-6 justify-center">
                              <Loader2 className="w-4 h-4 text-[#C8102E] animate-spin" />
                              <p className="text-xs text-[#6B7280] dark:text-gray-400">Loading quotes...</p>
                            </div>
                          )}

                          {!detailLoading && detailError && (
                            <div className="flex items-center gap-2 text-xs text-[#B45309] bg-amber-50 rounded-lg px-3 py-2">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>{detailError}</span>
                            </div>
                          )}

                          {!detailLoading && !detailError && detail && detail.quotes.length === 0 && (
                            <div className="bg-[#F8F9FA] dark:bg-gray-950 rounded-lg px-3 py-4 text-center">
                              <p className="text-xs font-semibold text-[#1A1A1A] dark:text-white">No quotes yet — sellers see this RFQ in their inbox.</p>
                            </div>
                          )}

                          {!detailLoading && !detailError && detail && detail.quotes.length > 0 && (
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                              {detail.quotes.map((quote) => {
                                const qMeta = QUOTE_STATUS_META[quote.status] || QUOTE_STATUS_META.pending
                                const blockReason = awardBlockReason(detail.status, quote.status)
                                const isActing = actingQuoteId === quote.id
                                const isArmed = armed?.quoteId === quote.id
                                return (
                                  <div
                                    key={quote.id}
                                    className="border border-[#E0E0E0] dark:border-gray-800 rounded-xl p-3 space-y-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-bold text-[#1A1A1A] dark:text-white truncate">
                                        {quote.supplier?.displayName || 'Supplier'}
                                      </p>
                                      <span
                                        className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ color: qMeta.color, backgroundColor: qMeta.bg }}
                                      >
                                        {quote.status}
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#4B5563] dark:text-gray-300">
                                      <span className="font-semibold text-[#1A1A1A] dark:text-white">
                                        {formatBDT(quote.pricePerUnit)} <span className="font-normal text-[#6B7280] dark:text-gray-400">/ unit</span>
                                      </span>
                                      <span>
                                        {formatBDT(quote.totalPrice)} <span className="text-[#6B7280] dark:text-gray-400">total</span>
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <Truck className="h-3 w-3 text-[#9CA3AF] dark:text-gray-500" />
                                        {typeof quote.deliveryDays === 'number' ? `${quote.deliveryDays} day${quote.deliveryDays === 1 ? '' : 's'}` : 'Delivery time not given'}
                                      </span>
                                      <span>{formatDate(quote.createdAt)}</span>
                                    </div>

                                    {quote.message && (
                                      <div className="flex gap-1.5 text-[11px] text-[#4B5563] dark:text-gray-300 bg-[#F8F9FA] dark:bg-gray-950 rounded-lg px-2.5 py-1.5">
                                        <MessageSquareText className="h-3 w-3 shrink-0 mt-0.5 text-[#9CA3AF] dark:text-gray-500" />
                                        <span className="whitespace-pre-line">{quote.message}</span>
                                      </div>
                                    )}

                                    {/* Award rail — Accept/Reject ONLY while pending AND rfq open|quoted */}
                                    {!blockReason ? (
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          onClick={() =>
                                            isArmed && armed?.action === 'accept'
                                              ? void executeAction(quote.id, 'accept')
                                              : setArmed({ quoteId: quote.id, action: 'accept' })
                                          }
                                          disabled={isActing}
                                          className={`flex-1 min-h-11 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                            isArmed && armed?.action === 'accept'
                                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                          }`}
                                          aria-label={isArmed && armed?.action === 'accept' ? 'Confirm accept quote' : 'Accept quote'}
                                        >
                                          {isActing ? (
                                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                          ) : isArmed && armed?.action === 'accept' ? (
                                            'Confirm accept'
                                          ) : (
                                            'Accept'
                                          )}
                                        </button>
                                        <button
                                          onClick={() =>
                                            isArmed && armed?.action === 'reject'
                                              ? void executeAction(quote.id, 'reject')
                                              : setArmed({ quoteId: quote.id, action: 'reject' })
                                          }
                                          disabled={isActing}
                                          className={`flex-1 min-h-11 rounded-lg text-xs font-bold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                            isArmed && armed?.action === 'reject'
                                              ? 'bg-[#C8102E] text-white border-[#C8102E] hover:bg-[#A50D24]'
                                              : 'bg-white dark:bg-gray-900 text-[#C8102E] border-[#FECDD3] hover:bg-[#FFF1F2] dark:bg-rose-950/30'
                                          }`}
                                          aria-label={isArmed && armed?.action === 'reject' ? 'Confirm reject quote' : 'Reject quote'}
                                        >
                                          {isArmed && armed?.action === 'reject' ? 'Confirm reject' : 'Reject'}
                                        </button>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-[#6B7280] dark:text-gray-400 pt-0.5">{blockReason}</p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* ─── Convert rail (Task 55-b): accepted quote → real order ───
                         * Mirrors the server guards honestly: converted → banner;
                         * no linked product → truthful explanation instead of a
                         * button that could only ever 409. */}
                        {detail?.status === 'awarded' && (
                          rfq.convertedOrderNumber || rfq.convertedOrderId ? (
                            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                              <PackageCheck className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
                              <div className="text-xs">
                                <p className="font-bold text-emerald-800">
                                  Order placed{rfq.convertedOrderNumber ? ` · ${rfq.convertedOrderNumber}` : ''}
                                </p>
                                <p className="text-[11px] text-emerald-700 mt-0.5">
                                  The accepted quote became a real order — track it in your orders.
                                </p>
                              </div>
                            </div>
                          ) : acceptedQuote && rfq.productId ? (
                            <button
                              onClick={() => openConvertDialog(rfq.id, acceptedQuote, rfq)}
                              className="w-full inline-flex items-center justify-center gap-1.5 min-h-11 px-4 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg transition-colors"
                              aria-label="Convert accepted quote to order"
                            >
                              <ShoppingBag className="h-4 w-4" />
                              Convert to order
                            </button>
                          ) : acceptedQuote ? (
                            <p className="text-[11px] text-[#6B7280] dark:text-gray-400 bg-[#F8F9FA] dark:bg-gray-950 rounded-lg px-3 py-2">
                              This request is not linked to a marketplace product, so its accepted quote cannot be converted into an order.
                            </p>
                          ) : null
                        )}

                        {/* Row data fallback while detail loads keeps meta honest */}
                        {!detailLoading && !detailError && !detail && (
                          <p className="text-[11px] text-[#6B7280] dark:text-gray-400">Quotes will load here.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* ─── Convert confirm dialog (Task 55-b) — states EXACTLY what will
             happen: qty × negotiated unit price = total, delivery days. ─── */}
        <Dialog
          open={!!convertTarget}
          onOpenChange={(open) => {
            if (!open && !converting) setConvertTarget(null)
          }}
        >
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-black text-[#1A1A1A] dark:text-white">
                <ShoppingBag className="h-4 w-4 text-[#C8102E]" />
                Convert to order
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280] dark:text-gray-400">
                This places a real order from the accepted quote.
              </DialogDescription>
            </DialogHeader>

            {convertTarget && (
              <div className="space-y-2 text-xs">
                <div className="bg-[#F8F9FA] dark:bg-gray-950 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#6B7280] dark:text-gray-400">Quantity</span>
                    <span className="font-bold text-[#1A1A1A] dark:text-white">
                      {convertTarget.quantity.toLocaleString()} {convertTarget.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#6B7280] dark:text-gray-400">Negotiated price</span>
                    <span className="font-bold text-[#1A1A1A] dark:text-white">
                      {formatBDT(convertTarget.quote.pricePerUnit)} / {convertTarget.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-800 pt-1.5">
                    <span className="text-[#6B7280] dark:text-gray-400">Order total</span>
                    <span className="font-black text-[#C8102E]">
                      {formatBDT(roundQty(convertTarget.quantity * convertTarget.quote.pricePerUnit))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#6B7280] dark:text-gray-400">Delivery</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#1A1A1A] dark:text-white">
                      <Truck className="h-3 w-3 text-[#9CA3AF] dark:text-gray-500" />
                      {typeof convertTarget.quote.deliveryDays === 'number'
                        ? `${convertTarget.quote.deliveryDays} day${convertTarget.quote.deliveryDays === 1 ? '' : 's'}`
                        : 'time not given'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#6B7280] dark:text-gray-400">Supplier</span>
                    <span className="max-w-[60%] truncate text-right font-semibold text-[#1A1A1A] dark:text-white">
                      {convertTarget.quote.supplier?.displayName || 'Quoted supplier'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-[#6B7280] dark:text-gray-400">
                  The order uses the negotiated quote price, not the list price. Stock is reserved
                  immediately and this request is marked converted — this cannot be undone.
                </p>
                {convertError && (
                  <div className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] dark:bg-rose-950/30 px-3 py-2 space-y-0.5">
                    <p className="text-[11px] font-semibold text-[#C8102E]">{convertError}</p>
                    {convertAvailable != null && (
                      <p className="text-[11px] text-[#C8102E]">
                        Only {convertAvailable.toLocaleString()} {convertTarget.unit} available right now.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <button
                onClick={() => setConvertTarget(null)}
                disabled={converting}
                className="min-h-11 px-4 rounded-lg border border-[#E0E0E0] dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-bold text-[#4B5563] dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => void executeConvert()}
                disabled={converting}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-lg bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Place order'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default RfqListPage
