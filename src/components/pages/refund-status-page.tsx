'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, HelpCircle, Check, RotateCw, Landmark, Info, Clock,
  LogIn, Search, AlertCircle, Loader2, Package, Receipt,
} from 'lucide-react'

/**
 * REAL refund status — replaces the fabricated "Industrial Steel Shelving
 * Unit (x2)" + invented Oct-2023 timeline theater.
 *
 * Source of truth: GET /api/returns/[id] (the Task 47/49/60 rail — buyer or
 * admin only). The page renders:
 *   - the REAL return request (returnNumber, status, estimatedRefund,
 *     resolutionNote, resolvedAt, createdAt)
 *   - the real refunds[] ledger rows (money that actually moved)
 *   - the real receipts[] (seller confirmations of the returned goods)
 *   - an honest 4-step timeline DERIVED from those real fields — never a
 *     fabricated "Bank Processing" step.
 *
 * pageParams.refundId (the return request id) is required.
 */

interface ApiRefund {
  id: string
  amount: number
  method: string
  reference: string | null
  status: string
  processedAt: string
  note: string | null
}
interface ApiReceipt {
  supplierId: string
  itemsRestored: number
  restoredValue: number
  note: string | null
  receivedAt: string
}
interface ApiReturn {
  id: string
  returnNumber: string
  orderId: string
  orderNumber: string | null
  status: string
  shippingMethod: string
  estimatedRefund: number
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
  items: { id: string; reason: string; quantity: number; comments: string | null }[]
  refunds: ApiRefund[]
  receipts: ApiReceipt[]
  supplierCount: number
}

type Phase = 'loading' | 'anon' | 'notfound' | 'error' | 'ready'

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending review', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', className: 'bg-emerald-600 text-white' },
}

export function RefundStatusPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const returnId = pageParams.refundId || pageParams.returnId || pageParams.id || ''

  const [phase, setPhase] = useState<Phase>('loading')
  const [data, setData] = useState<ApiReturn | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const load = React.useCallback(async () => {
    if (!returnId) { setPhase('notfound'); return }
    setPhase('loading')
    try {
      const res = await fetch(`/api/returns/${encodeURIComponent(returnId)}`, { credentials: 'include' })
      if (res.status === 401) { setPhase('anon'); return }
      const json = await res.json().catch(() => null)
      if (res.status === 404) { setPhase('notfound'); return }
      if (res.status === 403) { setPhase('notfound'); return } // no existence leak
      if (!res.ok) { setPhase('error'); setErrorMsg(json?.error || `HTTP ${res.status}`); return }
      setData(json?.data ?? null)
      setPhase('ready')
    } catch {
      setPhase('error'); setErrorMsg('Network error — check your connection and retry.')
    }
  }, [returnId])

  useEffect(() => { load() }, [load])

  // ── gates ──
  if (!returnId) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center">
              <Search className="h-6 w-6 text-slate-500 dark:text-neutral-400 dark:text-neutral-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">No refund selected</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">
              Open a return request from your order history to see its live refund status.
            </p>
            <Button onClick={() => navigate('orders-history')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <Package className="h-4 w-4" /> Go to orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (phase === 'anon') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <LogIn className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">Sign in required</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">Refund status is visible only to the buyer who raised the request.</p>
            <Button onClick={() => navigate('login')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (phase === 'notfound') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center">
              <Search className="h-6 w-6 text-slate-500 dark:text-neutral-400 dark:text-neutral-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">Return request not found</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">It may have been removed, or the link may belong to another account.</p>
            <Button onClick={() => navigate('orders-history')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <Package className="h-4 w-4" /> Go to orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">Couldn't load the refund</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 break-words">{errorMsg}</p>
            <Button onClick={load} variant="outline" className="text-xs font-bold gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (phase === 'loading' || !data) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <PageLoader className="min-h-0" />
      </div>
    )
  }

  // ── Honest timeline derived from REAL fields ──
  const refundedRow = data.refunds.find(f => f.status === 'success') || data.refunds[0] || null
  const steps: { title: string; subtitle: string; time: string; state: 'done' | 'active' | 'pending'; tag?: string }[] = [
    {
      title: 'Return requested',
      subtitle: `Request ${data.returnNumber} submitted${data.items.length ? ` — ${data.items.length} item${data.items.length === 1 ? '' : 's'}` : ''}.`,
      time: fmt(data.createdAt),
      state: 'done',
    },
  ]
  if (data.status === 'rejected') {
    steps.push({
      title: 'Request rejected',
      subtitle: data.resolutionNote || 'The supplier or admin rejected this return request.',
      time: fmt(data.resolvedAt),
      state: 'active',
    })
  } else if (data.status === 'approved') {
    steps.push({
      title: 'Return approved',
      subtitle: data.resolutionNote || 'Approved — ship the goods back per the return instructions.',
      time: fmt(data.resolvedAt),
      state: data.refunds.length > 0 ? 'done' : 'active',
    })
    steps.push({
      title: 'Refund processing',
      subtitle: data.estimatedRefund > 0
        ? `Estimated refund ${formatPrice(data.estimatedRefund)}. Processing times vary by bank.`
        : 'Refund is being processed.',
      time: '—',
      state: data.refunds.length > 0 ? 'active' : 'pending',
    })
  } else if (data.status === 'refunded') {
    steps.push({
      title: 'Return approved',
      subtitle: data.resolutionNote || 'Approved and processed.',
      time: fmt(data.resolvedAt),
      state: 'done',
    })
    steps.push({
      title: 'Funds released',
      subtitle: refundedRow
        ? `Refunded via ${refundedRow.method}${refundedRow.reference ? ` · ref ${refundedRow.reference}` : ''}.`
        : 'Refund recorded.',
      time: fmt(refundedRow?.processedAt ?? data.resolvedAt),
      state: 'done',
      tag: refundedRow ? `Credit · ${refundedRow.method}` : undefined,
    })
  } else {
    steps.push({
      title: 'Awaiting review',
      subtitle: `Pending status: ${STATUS_BADGE[data.status]?.label ?? data.status}.`,
      time: fmt(data.createdAt),
      state: 'active',
    })
  }

  const badge = STATUS_BADGE[data.status] ?? { label: data.status, className: 'bg-slate-100 dark:bg-card text-slate-700 dark:text-neutral-300' }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 text-slate-900 dark:text-neutral-100">
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back" aria-label="Back">
              <ArrowLeft className="h-5 w-5 text-primary" />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-neutral-100">Refund Status</h1>
          </div>
          <button className="p-1 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 hover:text-slate-700 dark:text-neutral-300" title="Help" onClick={() => navigate('dispute-center')}>
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Refund Status</h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>

        {/* Card 1: header + amount */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-mono block">
              Return: {data.returnNumber}
            </span>
            <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5">
              Original order:{' '}
              <button
                onClick={() => navigate('order-detail', { orderId: data.orderId })}
                className="font-semibold text-primary hover:underline"
              >
                {data.orderNumber ?? data.orderId}
              </button>
            </p>
            <span className="md:hidden inline-flex mt-2"><Badge className={badge.className}>{badge.label}</Badge></span>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-background/80 rounded-2xl border border-slate-100 dark:border-neutral-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400 block">
              {data.status === 'refunded' ? 'Total refunded' : 'Estimated refund'}
            </span>
            <span className="text-2xl font-black text-primary mt-1 block">
              {formatPrice(
                data.status === 'refunded' && refundedRow
                  ? refundedRow.amount
                  : data.estimatedRefund,
              )}
            </span>
            {data.supplierCount > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-1">
                {data.supplierCount} supplier{data.supplierCount === 1 ? '' : 's'} involved in this return
              </p>
            )}
          </div>
        </div>

        {/* Card 2: honest timeline */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-5">
          <h2 className="text-xs font-black text-slate-900 dark:text-neutral-100">Status Timeline</h2>
          <div className="space-y-6 pl-2 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:bg-card">
            {steps.map((step, i) => (
              <div key={i} className="relative flex items-start gap-4">
                <div
                  className={
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 z-10 ' +
                    (step.state === 'done'
                      ? 'bg-slate-200 text-slate-700 dark:text-neutral-300'
                      : step.state === 'active'
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'bg-slate-100 dark:bg-card text-slate-300')
                  }
                >
                  {step.state === 'done'
                    ? <Check className="h-3.5 w-3.5" />
                    : step.state === 'active'
                      ? <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      : <Clock className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 pt-0.5 space-y-1 flex-1">
                  <h3 className={'text-xs ' + (step.state === 'active' ? 'font-black text-primary' : 'font-bold text-slate-800 dark:text-neutral-200')}>
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed">{step.subtitle}</p>
                  {step.tag && (
                    <div className="mt-2 p-2.5 bg-slate-50 dark:bg-background rounded-xl border border-slate-100 dark:border-neutral-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-neutral-300">
                      <Landmark className="h-3.5 w-3.5 text-slate-500 dark:text-neutral-400 dark:text-neutral-500 shrink-0" />
                      <span className="truncate">{step.tag}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-medium pt-0.5">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: real refunds ledger */}
        {data.refunds.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3">
            <h2 className="text-xs font-black text-slate-900 dark:text-neutral-100 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Refund ledger
            </h2>
            {data.refunds.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-3 py-2 border-t border-slate-100 dark:border-neutral-800 first:border-0 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 dark:text-neutral-200">{formatPrice(f.amount)} · {f.method}</p>
                  {f.reference && <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-mono truncate">ref {f.reference}</p>}
                  <p className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400">{fmt(f.processedAt)}</p>
                </div>
                <span
                  className={
                    'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ' +
                    (f.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-card text-slate-600 dark:text-neutral-400')
                  }
                >
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Card 4: real items */}
        {data.items.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3">
            <h2 className="text-xs font-black text-slate-900 dark:text-neutral-100">Returned items</h2>
            {data.items.map(it => (
              <div key={it.id} className="py-2 border-t border-slate-100 dark:border-neutral-800 first:border-0 text-xs">
                <p className="font-semibold text-slate-800 dark:text-neutral-200">Qty {it.quantity} — {it.reason}</p>
                {it.comments && <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5 break-words">{it.comments}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Assistance */}
        <div className="bg-slate-100 dark:bg-card/60 rounded-3xl p-4 border border-slate-200 dark:border-neutral-800/80 flex gap-3 items-start">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-neutral-100">Need assistance with this refund?</h3>
            <p className="text-slate-500 dark:text-neutral-400 dark:text-neutral-500 text-[11px] leading-relaxed">
              If the funds have not appeared in your account after 5 business days of the refund being
              recorded, please contact your bank or open a dispute.
            </p>
            <Button onClick={() => navigate('dispute-center')} variant="outline" size="sm" className="h-8 text-[11px] font-bold">
              Open dispute center
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default RefundStatusPage
import { PageLoader } from '@/components/ui/page-loader'
