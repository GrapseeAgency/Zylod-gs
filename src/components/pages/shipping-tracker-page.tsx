'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Truck, Package, CheckCircle2, Clock, MapPin, LogIn,
  Search, AlertCircle, Loader2, MessageSquare, ArrowRight,
} from 'lucide-react'

/**
 * REAL shipment tracking — replaces the fabricated "Courier #8492" map.
 *
 * Data source: GET /api/orders/[id]/track (credentials: 'include').
 *   - The driver app pushes real milestones (dispatched, in-transit,
 *     delivered) into orderTracking; continuous GPS pings are NOT shown
 *     here (they exist only in the live delivery websocket room).
 *   - No fabricated map, no invented courier id, no fake ETA.
 *
 * pageParams.orderId is required; without it the page shows an honest
 * "open an order" prompt instead of invented content.
 */

interface ApiTrackingEvent {
  id: string
  status: string
  location: string | null
  note: string | null
  trackedAt: string
}
interface ApiSubOrder {
  id: string
  status: string
  trackingNumber: string | null
  estimatedDelivery: string | null
  latest: ApiTrackingEvent | null
  timeline: ApiTrackingEvent[]
}
interface ApiData {
  orderId: string
  orderNumber: string
  subOrders: ApiSubOrder[]
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'In Transit',
  delivered: 'Delivered',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ShippingTrackerPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || pageParams.id || ''

  const [data, setData] = useState<ApiData | null>(null)
  const [status, setStatus] = useState<'loading' | 'anon' | 'notfound' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const load = React.useCallback(async () => {
    if (!orderId) { setStatus('notfound'); return }
    setStatus('loading')
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/track`, { credentials: 'include' })
      if (res.status === 401) { setStatus('anon'); return }
      const json = await res.json().catch(() => null)
      if (res.status === 404) { setStatus('notfound'); return }
      if (!res.ok) { setStatus('error'); setErrorMsg(json?.error || `HTTP ${res.status}`); return }
      setData(json?.data ?? null)
      setStatus('ready')
    } catch {
      setStatus('error'); setErrorMsg('Network error — check your connection and retry.')
    }
  }, [orderId])

  useEffect(() => { load() }, [load])

  // ── Honest no-order gate ──
  if (!orderId) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <Search className="h-6 w-6 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">No shipment selected</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Open an order from your order history and choose <span className="font-semibold">Track shipment</span> to
              see its real delivery milestones here.
            </p>
            <Button onClick={() => navigate('orders-history')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <Package className="h-4 w-4" /> Go to orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 401 gate ──
  if (status === 'anon') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <LogIn className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sign in to track</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Shipment milestones are visible only to the order's buyer, its suppliers, or an admin.
            </p>
            <Button onClick={() => navigate('login')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 404 / not-found ──
  if (status === 'notfound') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <Package className="h-6 w-6 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Order not found</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              We couldn't find this order. It may have been removed, or the link may be stale.
            </p>
            <Button onClick={() => navigate('orders-history')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <Package className="h-4 w-4" /> Go to orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── error ──
  if (status === 'error') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Couldn't load tracking</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 break-words">{errorMsg}</p>
            <Button onClick={load} variant="outline" className="text-xs font-bold gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── loading ──
  if (status === 'loading' || !data) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <PageLoader className="min-h-0" />
      </div>
    )
  }

  const anyShipped = data.subOrders.some(s => (s.status || '').toLowerCase() === 'shipped')
  const allDelivered = data.subOrders.length > 0 && data.subOrders.every(s => (s.status || '').toLowerCase() === 'delivered')

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100">
      {/* Mobile sticky header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-black text-primary truncate">Tracking</h1>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 max-w-3xl mx-auto space-y-4">
        <div className="hidden md:flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Shipment tracking</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
              Order <span className="font-mono font-semibold">{data.orderNumber}</span> · {data.subOrders.length} shipment{data.subOrders.length === 1 ? '' : 's'}
            </p>
          </div>
          <Badge
            className={
              allDelivered ? 'bg-emerald-600 text-white'
              : anyShipped ? 'bg-primary text-white'
              : 'bg-slate-200 text-slate-700 dark:text-slate-300'
            }
          >
            {allDelivered ? 'Delivered' : anyShipped ? 'In transit' : 'Processing'}
          </Badge>
        </div>

        {/* Honest note about live GPS */}
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-3">
          <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
            Milestones below come from the driver app (dispatched, in-transit, delivered).
            Continuous live GPS is shown only inside the active delivery chat room — this view
            shows the verified timeline.
          </p>
        </div>

        {/* Per-shipment cards */}
        {data.subOrders.map((so, idx) => {
          const stage = (so.status || 'pending').toLowerCase()
          return (
            <Card key={so.id} className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">
                      Shipment {idx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {STATUS_LABEL[stage] || stage}
                    </h3>
                    {so.trackingNumber && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-mono mt-0.5 break-all">
                        AWB: {so.trackingNumber}
                      </p>
                    )}
                  </div>
                  {so.estimatedDelivery && (
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">
                        Est. delivery
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{formatDate(so.estimatedDelivery)}</span>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                {so.timeline.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 text-center">
                    <Clock className="h-5 w-5 text-slate-400 dark:text-slate-500 dark:text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      No milestones yet. The seller hasn't dispatched this shipment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pl-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {so.timeline.map((t, i) => {
                      const isLatest = i === 0
                      return (
                        <div key={t.id} className="relative flex items-start gap-3">
                          <div
                            className={
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ' +
                              (isLatest
                                ? 'bg-primary border-primary text-white'
                                : 'bg-white dark:bg-gray-900 border-slate-300 text-slate-400 dark:text-slate-500')
                            }
                          >
                            {isLatest ? <Truck className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <h4 className={'text-xs ' + (isLatest ? 'font-black text-primary' : 'font-bold text-slate-800 dark:text-slate-200')}>
                              {STATUS_LABEL[(t.status || '').toLowerCase()] || t.status}
                            </h4>
                            {t.location && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0" /> {t.location}
                              </p>
                            )}
                            {t.note && <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 mt-0.5 break-words">{t.note}</p>}
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">{formatDate(t.trackedAt)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Chat driver — only when there's an active shipment */}
                {(stage === 'shipped') && (
                  <Button
                    onClick={() => navigate('delivery-chat', { orderId, subOrderId: so.id })}
                    variant="outline"
                    className="w-full text-xs font-bold gap-2 rounded-2xl"
                  >
                    <MessageSquare className="h-4 w-4" /> Chat driver
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}

        <div className="pt-2 flex justify-center">
          <Button
            onClick={() => navigate('order-detail', { orderId })}
            variant="ghost"
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-500 gap-1.5"
          >
            View full order <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </main>
    </div>
  )
}
export default ShippingTrackerPage
import { PageLoader } from '@/components/ui/page-loader'
