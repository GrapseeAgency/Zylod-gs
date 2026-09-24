'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Truck, Headphones,
  Package, AlertCircle, RefreshCw, LogIn, Box, RotateCcw, Clock, CheckCircle2, XCircle
} from 'lucide-react'

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
    note: 'This return has been refunded to your original payment method.',
  },
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
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            <Box className="h-9 w-9 text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900">No return selected</h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
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
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
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
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Return Details</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Order #{orderId.slice(-8).toUpperCase()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('help-center')}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <Headphones className="h-3.5 w-3.5" />
              Support
            </Button>
          </div>
        </div>

        {/* Auth / not found / error — honest states */}
        {(notFound || needsAuth || error) && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              {needsAuth ? <LogIn className="h-7 w-7 text-gray-400" /> : <AlertCircle className="h-7 w-7 text-gray-400" />}
            </div>
            <h2 className="text-sm font-black text-slate-900">
              {notFound ? 'Return not found' : needsAuth ? 'Sign in required' : 'Couldn\u2019t load this return'}
            </h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
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
                  className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl flex items-center justify-center gap-1.5"
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
            <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
              <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
              <div className="h-4 w-1/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            </div>
          </div>
        )}

        {/* No return requests for this order — honest empty */}
        {!loading && !error && !needsAuth && !notFound && returns && returns.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <RotateCcw className="h-9 w-9 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">No return found for this order</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              No return request has been submitted for this order yet. Paid, delivered orders can
              start one.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('return-request', { orderId })}
              className="mt-5 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 px-6 rounded-2xl"
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
              className: 'bg-slate-100 text-slate-700',
              icon: Clock,
              note: 'Status updates will appear here as the Zylod team reviews this request.',
            }
            const MetaIcon = meta.icon
            return (
              <div key={ret.id} className="space-y-4">
                {/* Status card — real backend status */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black text-slate-900">Return {ret.returnNumber}</h2>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-2.5 text-xs text-slate-700">
                    <MetaIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-[11px]">{meta.note}</span>
                  </div>

                  {ret.resolutionNote && (
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Review note</p>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{ret.resolutionNote}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      {ret.shippingMethod === 'dropoff' ? 'Drop-off' : 'Pickup'} (preferred)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Submitted {new Date(ret.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Items in Return — real submitted items */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <h2 className="text-xs font-bold text-slate-900">Items in Return</h2>

                  <div className="space-y-3 pt-1">
                    {ret.items.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[11px] font-bold text-slate-700 break-all">
                            Item #{item.orderItemId.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-[10px] font-black text-slate-500 shrink-0">Qty: {item.quantity}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          <span className="font-semibold text-slate-500">Reason: </span>{item.reason}
                        </p>
                        {item.comments && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.comments}</p>
                        )}
                      </div>
                    ))}

                    <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-800">Estimated refund</span>
                      <span className="text-base font-black text-slate-900">{formatPrice(ret.estimatedRefund)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Estimate based on the returned quantities. The final refunded amount is decided
                      when the return is reviewed and approved.
                    </p>
                  </div>
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
