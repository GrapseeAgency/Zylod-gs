'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { EvidenceManager } from '@/components/pages/evidence-manager'
import {
  ArrowLeft, Truck, Headphones,
  Package, AlertCircle, RefreshCw, LogIn, Box, RotateCcw, Clock, CheckCircle2, XCircle, Banknote, PackageCheck,
} from 'lucide-react'

interface RefundRecord {
  id: string
  amount: number
  /** bank_transfer | mobile_banking | cash */
  method: string
  /** Real-world transaction id / UTR / TxnID from the actual transfer. */
  reference: string
  status: string
  processedAt: string
  note: string | null
}

interface ReturnItem {
  id: string
  orderItemId: string
  reason: string
  quantity: number
  comments: string | null
}

interface ReturnRequest {
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
  items: ReturnItem[]
  refunds: RefundRecord[]
  /** Seller receipts of the returned GOODS (Task 60-a) + the supplier denominator. */
  receipts: Array<{ supplierId: string; itemsRestored: number; restoredValue: number; note: string | null; receivedAt: string }>
  supplierCount: number
}

const STATUS_META: Record<string, { label: string; className: string; icon: typeof Clock; note: string }> = {
  pending: {
    label: 'Pending review',
    className: 'bg-amber-100 text-amber-800',
    icon: Clock,
    note: 'Your return request is waiting for review by the Zylod team. Nothing has been charged back or scheduled yet — you will see the decision here.',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle2,
    note: 'The return was approved. Follow the pickup/return instructions given in the resolution note.',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-100 text-rose-800',
    icon: XCircle,
    note: 'The return request was rejected. The reason from the review team is shown below.',
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle2,
    note: 'A refund has been recorded for this return — the actual transfer details are shown below. Zylod documents refunds that were sent manually (bank transfer / mobile banking / cash); it does not move money itself.',
  },
}

// Real refund method value → honest label
function refundMethodLabel(method: string): string {
  if (method === 'bank_transfer') return 'Bank transfer'
  if (method === 'mobile_banking') return 'Mobile banking'
  if (method === 'cash') return 'Cash'
  return method // any other real value, verbatim
}

export function ReturnDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''
  const returnId = pageParams.returnId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [returns, setReturns] = useState<ReturnRequest[] | null>(null)

  const fetchReturns = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setNotFound(false)
    setNeedsAuth(false)
    try {
      const res = await fetch(`/api/returns?orderId=${encodeURIComponent(orderId)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 404) setNotFound(true)
        else if (res.status === 401) setNeedsAuth(true)
        else setError(data?.error || `Failed to load returns (${res.status})`)
        setReturns(null)
        return
      }
      const list: ReturnRequest[] = data?.data || []
      const filtered = returnId ? list.filter(r => r.id === returnId || r.returnNumber === returnId) : list
      setReturns(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading the return')
      setReturns(null)
    } finally {
      setLoading(false)
    }
  }, [orderId, returnId])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  /* ─── No order reference — honest state ─── */
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
            <Box className="h-9 w-9 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-slate-100">No return selected</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Return details are shown per order. Submit a return request from one of your orders
            first.
          </p>
          <Button
            onClick={() => navigate('orders')}
            className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md"
          >
            View My Orders
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        {/* Title */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">Return Details</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Order #{orderId.slice(-8).toUpperCase()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('help-center')}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 flex items-center gap-1.5"
            >
              <Headphones className="h-3.5 w-3.5" />
              Support
            </Button>
          </div>
        </div>

        {/* Auth / not found / error — honest states */}
        {(notFound || needsAuth || error) && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-4">
              {needsAuth ? <LogIn className="h-7 w-7 text-gray-400 dark:text-gray-500 dark:text-gray-400" /> : <AlertCircle className="h-7 w-7 text-gray-400 dark:text-gray-500 dark:text-gray-400" />}
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {notFound ? 'Return not found' : needsAuth ? 'Sign in required' : 'Couldn\u2019t load this return'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {notFound
                ? 'We couldn\u2019t find this return request. It may belong to a different account.'
                : needsAuth
                  ? 'Sign in with the buyer account that placed this order to view its return.'
                  : error}
            </p>
            <div className="mt-5 flex flex-col gap-2 max-w-xs mx-auto">
              {needsAuth ? (
                <Button
                  onClick={() => navigate('login')}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl shadow-md"
                >
                  Sign In
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={fetchReturns}
                  className="bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold text-xs h-11 rounded-2xl flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-16 w-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-2xl animate-pulse" />
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="h-4 w-1/4 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-16 w-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-2xl animate-pulse" />
            </div>
          </div>
        )}

        {/* No return requests for this order — honest empty */}
        {!loading && !error && !needsAuth && !notFound && returns && returns.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-4">
              <RotateCcw className="h-9 w-9 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">No return found for this order</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              No return request has been submitted for this order yet. Paid, delivered orders can
              start one.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('return-request', { orderId })}
              className="mt-5 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold text-xs h-11 px-6 rounded-2xl"
            >
              Start a Return Request
            </Button>
          </div>
        )}

        {/* Real return requests */}
        {!loading && !error && !needsAuth && !notFound && returns && returns.length > 0 && (
          returns.map((ret) => {
            const meta = STATUS_META[ret.status] ?? {
              label: ret.status,
              className: 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300',
              icon: Clock,
              note: 'Status updates will appear here as the Zylod team reviews this request.',
            }
            const MetaIcon = meta.icon
            return (
              <div key={ret.id} className="space-y-4">
                {/* Status card — real backend status */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black text-slate-900 dark:text-slate-100">Return {ret.returnNumber}</h2>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <MetaIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-[11px]">{meta.note}</span>
                  </div>

                  {ret.resolutionNote && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 mb-1">Review note</p>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">{ret.resolutionNote}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      {ret.shippingMethod === 'dropoff' ? 'Drop-off' : 'Pickup'} (preferred)
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      Submitted {new Date(ret.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Refund issued — real ledger rows only, hidden honestly when none exist */}
                {ret.refunds.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-emerald-200 shadow-2xs space-y-3">
                    <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Refund issued
                    </h2>
                    {ret.refunds.map((f) => (
                      <div key={f.id} className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-base font-black text-emerald-700 tabular-nums">{formatPrice(f.amount)}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 tabular-nums">{new Date(f.processedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500">
                          <span className="font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Method: </span>{refundMethodLabel(f.method)}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 break-all">
                          <span className="font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Reference: </span>
                          <span className="font-mono">{f.reference}</span>
                        </p>
                        {f.note && <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 break-words">{f.note}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Goods received — the physical loop closing, real receipts only (Task 60-a) */}
                {ret.receipts.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-emerald-200 shadow-2xs space-y-3">
                    <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <PackageCheck className="h-3.5 w-3.5 text-emerald-600" /> Goods received by seller
                    </h2>
                    {ret.receipts.map((rc, idx) => (
                      <div key={`${rc.supplierId}-${idx}`} className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1">
                        <p className="text-[11px] font-bold text-emerald-800">
                          {rc.itemsRestored} item line(s) received back · {formatPrice(rc.restoredValue)} stock restored
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          Confirmed {new Date(rc.receivedAt).toLocaleString()}{rc.note ? ` — ${rc.note}` : ''}
                        </p>
                      </div>
                    ))}
                    {ret.supplierCount > ret.receipts.length && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                        Waiting on {ret.supplierCount - ret.receipts.length} more seller(s) to confirm their items arrived.
                      </p>
                    )}
                  </div>
                )}

                {/* Items in Return — real submitted items */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                  <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Items in Return</h2>

                  <div className="space-y-3 pt-1">
                    {ret.items.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-950/70 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 break-all">
                            Item #{item.orderItemId.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 dark:text-slate-500 shrink-0">Qty: {item.quantity}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 mt-1">
                          <span className="font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Reason: </span>{item.reason}
                        </p>
                        {item.comments && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">{item.comments}</p>
                        )}
                      </div>
                    ))}

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Estimated refund</span>
                      <span className="text-base font-black text-slate-900 dark:text-slate-100">{formatPrice(ret.estimatedRefund)}</span>
                    </div>
                    {ret.refunds.length > 0 && (
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-emerald-700">Refunded so far</span>
                        <span className="text-sm font-black text-emerald-700 tabular-nums">
                          {formatPrice(ret.refunds.reduce((sum, f) => sum + f.amount, 0))}
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
                      Estimate based on the returned quantities. The final refunded amount is decided
                      when the return is reviewed and approved.
                    </p>
                  </div>
                </div>
                {/* Evidence photos — buyer-provided review evidence (upload/delete only while pending) */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <EvidenceManager
                    ownerType="return"
                    ownerId={ret.id}
                    canEdit={ret.status === 'pending'}
                    lockedNote={
                      ret.status === 'approved' || ret.status === 'refunded'
                        ? 'Evidence is locked — the return request was approved, so the photos you submitted before the review decision are what the team saw.'
                        : ret.status === 'rejected'
                          ? 'Evidence is locked — the return request was rejected, so the photos you submitted before the review decision are what the team saw.'
                          : 'Evidence is locked — photos can no longer be added or removed.'
                    }
                  />
                </div>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}

export default ReturnDetailPage
