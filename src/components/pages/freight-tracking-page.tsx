'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, MapPin, Package, Clock, Loader2, RefreshCw, AlertCircle, CheckCircle2, Boxes,
} from 'lucide-react'

/**
 * REAL shipment tracking (audit unit 21). The old page was theater: a fake
 * shipment id (SHP-89234-A), a fake Shanghai→Dhaka SVG map with a pulsing
 * dot, fake cargo stats (48 pallets / 14,250 kg / 62.5 CBM), a fake
 * "In Transit" badge, and a fake "Download Manifest" that just called
 * window.print(). Now the page is bound to a REAL order through the
 * ?page=freight-tracking&orderId=<id> deep link and renders the REAL
 * shipment slices — status, supplier, shipping method, tracking number,
 * estimated delivery — plus each slice's REAL orderTracking events (seller
 * transitions and driver milestones, the same rows the order page shows).
 * Without an order id the page says so honestly and points at My Orders.
 */

interface TrackingRow {
  id: string
  status: string
  location: string | null
  note: string | null
  trackedAt: string
}

interface Slice {
  id: string
  status: string
  supplierName: string | null
  shippingMethodName: string | null
  trackingNumber: string | null
  shippingCost: number
  estimatedDelivery: string | null
  tracking: TrackingRow[]
}

interface OrderView {
  id: string
  orderNumber: string
  paymentStatus: string
  placedAt: string
  subOrders: Slice[]
}

const STATUS_TONE: Record<string, string> = {
  pending: 'text-slate-500 bg-slate-100 border-slate-200',
  confirmed: 'text-sky-700 bg-sky-50 border-sky-200',
  packed: 'text-sky-700 bg-sky-50 border-sky-200',
  shipped: 'text-amber-700 bg-amber-50 border-amber-200',
  delivered: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  cancelled: 'text-red-700 bg-red-50 border-red-200',
  returned: 'text-red-700 bg-red-50 border-red-200',
}

export function FreightTrackingPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = typeof pageParams.orderId === 'string' ? pageParams.orderId : ''

  const [order, setOrder] = useState<OrderView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' })
      if (res.status === 401) {
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && json?.data) {
        const d = json.data
        setOrder({
          id: d.id,
          orderNumber: d.orderNumber,
          paymentStatus: d.paymentStatus,
          placedAt: d.placedAt,
          subOrders: (d.subOrders ?? []).map((so: {
            id: string
            status?: string
            supplier?: { companyName?: string } | null
            shippingMethodName?: string | null
            trackingNumber?: string | null
            shippingCost?: number
            estimatedDelivery?: string | null
            tracking?: Array<{ id: string; status: string; location: string | null; note: string | null; trackedAt: string }>
          }) => ({
            id: so.id,
            status: typeof so.status === 'string' ? so.status : 'pending',
            supplierName: so.supplier?.companyName ?? null,
            shippingMethodName: typeof so.shippingMethodName === 'string' ? so.shippingMethodName : null,
            trackingNumber: typeof so.trackingNumber === 'string' ? so.trackingNumber : null,
            shippingCost: typeof so.shippingCost === 'number' ? so.shippingCost : 0,
            estimatedDelivery: typeof so.estimatedDelivery === 'string' ? so.estimatedDelivery : null,
            tracking: (so.tracking ?? []).map((t) => ({
              id: t.id,
              status: t.status,
              location: t.location,
              note: t.note,
              trackedAt: t.trackedAt,
            })),
          })),
        })
      } else {
        setError(json?.error || `Could not load this order (HTTP ${res.status}).`)
      }
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  if (!orderId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900">Open this from an order</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Tracking is tied to a real order&apos;s shipment slices. Open one of your orders and follow it from there.
        </p>
        <Button onClick={() => navigate('my-orders')} className="mt-5 w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl">
          Go to my orders
        </Button>
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900">Sign in required</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs">Tracking is visible to the order&apos;s buyer and its suppliers.</p>
        <Button onClick={() => navigate('login')} className="mt-5 w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl">
          Sign in
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900">Order not found</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs">{error || 'This order does not exist or is not visible to your account.'}</p>
        <Button variant="outline" onClick={() => navigate('my-orders')} className="mt-5 w-full max-w-xs font-bold text-xs h-11 rounded-2xl">
          Go to my orders
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-8">
        {/* Real order header */}
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 font-mono tracking-tight">{order.orderNumber}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Placed {new Date(order.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ·
            payment {order.paymentStatus.toUpperCase()}
          </p>
        </div>

        {order.subOrders.length === 0 && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 text-center text-xs text-slate-500">
            This order has no shipment slices on record.
          </div>
        )}

        {order.subOrders.map((slice) => (
          <motion.div
            key={slice.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4"
          >
            {/* Slice header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shipment</p>
                <h2 className="text-sm font-black text-slate-900 truncate">{slice.supplierName ?? 'Supplier shipment'}</h2>
                {slice.shippingMethodName && (
                  <p className="text-[11px] text-slate-500 font-semibold">{slice.shippingMethodName}</p>
                )}
              </div>
              <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${STATUS_TONE[slice.status] ?? STATUS_TONE.pending}`}>
                {slice.status}
              </span>
            </div>

            {/* Real fields only */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Estimated delivery</span>
                <span className="text-xs font-black text-slate-900">
                  {slice.estimatedDelivery
                    ? new Date(slice.estimatedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Not scheduled yet'}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Freight (quoted live)</span>
                <span className="text-xs font-black text-slate-900 font-mono">{formatPrice(slice.shippingCost)}</span>
              </div>
            </div>
            {slice.trackingNumber && (
              <p className="text-[11px] text-slate-500 font-semibold">
                Carrier reference: <span className="font-mono font-bold text-slate-800">{slice.trackingNumber}</span>
              </p>
            )}

            {/* REAL tracking events — the same orderTracking rows the order page renders */}
            <div className="pt-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Tracking events ({slice.tracking.length})
              </p>
              {slice.tracking.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  No tracking events yet — the supplier&apos;s first status transition will appear here the moment it happens.
                </div>
              ) : (
                <ol className="space-y-2">
                  {slice.tracking.map((t, i) => (
                    <li key={t.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          i === 0 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200'
                        }`}>
                          {i === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Boxes className="h-3 w-3" />}
                        </div>
                        {i < slice.tracking.length - 1 && <div className="w-px h-6 bg-slate-200 mt-1" />}
                      </div>
                      <div className="min-w-0 pb-1">
                        <p className="text-xs font-bold text-slate-900 capitalize">{t.status}</p>
                        <p className="text-[11px] text-slate-500">
                          {t.location ? `${t.location} · ` : ''}{new Date(t.trackedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {t.note && <p className="text-[11px] text-slate-600 mt-0.5">{t.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </motion.div>
        ))}

        <Button
          variant="outline"
          onClick={() => navigate('order-detail', { orderId: order.id })}
          className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs"
        >
          <Package className="h-4 w-4 mr-2" /> Open the full order
        </Button>
        <p className="text-[10px] text-slate-400 leading-relaxed px-1 flex items-start gap-1.5">
          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
          Every event above is a real row the platform persisted — seller status transitions and driver milestones. There is no live map: the operators&apos; driver app reports milestones, not continuous coordinates.
        </p>
      </main>
    </div>
  )
}

export default FreightTrackingPage
