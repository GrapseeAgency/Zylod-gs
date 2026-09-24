'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Check, ShieldCheck, FileText, Package, Star,
  ArrowLeft, AlertCircle, Loader2, Truck
} from 'lucide-react'

/**
 * REAL delivery confirmation — renders the actual order state from
 * GET /api/orders/[id]. No invented delivery dates, signatures, items or
 * photos. The delivery rating is submitted to POST /api/orders/[id]/feedback
 * (real persistence) — the thank-you message only appears after the API
 * confirms it.
 */

interface ApiTracking {
  id: string
  status: string
  location?: string | null
  note?: string | null
  trackedAt: string
}

interface ApiItem {
  id: string
  quantity: number
  product?: { id: string; name: string; thumbnailUrl?: string | null; unit?: string | null } | null
}

interface ApiSubOrder {
  id: string
  status: string
  trackingNumber?: string | null
  tracking: ApiTracking[]
  items: ApiItem[]
}

interface ApiOrder {
  id: string
  orderNumber: string
  subOrders: ApiSubOrder[]
}

export function DeliveryConfirmationPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [rating, setRating] = useState(0)
  const [ratingSaved, setRatingSaved] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setLoadError(json?.error || `Could not load the order (HTTP ${res.status})`)
        setOrder(null)
        return
      }
      setOrder(json.data as ApiOrder)
    } catch {
      setLoadError('Network error while loading the order. Check your connection and retry.')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const items: ApiItem[] = order
    ? order.subOrders.flatMap((so) => (Array.isArray(so.items) ? so.items : []))
    : []

  const subStatuses = order ? order.subOrders.map((so) => (so.status || '').toLowerCase()) : []
  const allDelivered = subStatuses.length > 0 && subStatuses.every((s) => s === 'delivered')
  const anyDelivered = subStatuses.some((s) => s === 'delivered')

  // Real delivered timestamp — only from actual tracking events
  const deliveredAt = order
    ? order.subOrders
        .flatMap((so) => (Array.isArray(so.tracking) ? so.tracking : []))
        .filter((t) => t.status === 'delivered')
        .map((t) => t.trackedAt)
        .sort()
        .pop() || null
    : null

  const statusText = allDelivered
    ? 'Delivered'
    : subStatuses.length > 0
      ? subStatuses[0].toUpperCase()
      : ''

  const handleRate = async (star: number) => {
    if (!orderId || ratingSubmitting) return
    setRating(star)
    setRatingError('')
    setRatingSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ overallRating: star, deliverySpeed: star }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setRatingError(json?.error || `Could not save the rating (HTTP ${res.status}).`)
        return
      }
      setRatingSaved(true)
    } catch {
      setRatingError('Network error while saving the rating. Check your connection and retry.')
    } finally {
      setRatingSubmitting(false)
    }
  }

  // ─── No order selected — honest state ───
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Truck className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-lg font-black text-slate-900">No order selected</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Open an order to see its real delivery status — this screen confirms the
          delivery of a specific order.
        </p>
        <Button
          onClick={() => navigate('orders')}
          className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md w-full max-w-xs"
        >
          Return to My Orders
        </Button>
      </div>
    )
  }

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900" aria-busy="true" aria-live="polite">
        <main className="px-4 py-8 md:px-6 space-y-5 max-w-lg mx-auto lg:max-w-3xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-5 w-56 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <div className="aspect-[16/9] rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-3.5 w-1/2 bg-slate-200 rounded animate-pulse" />
          </div>
          <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading delivery status…
          </p>
        </main>
      </div>
    )
  }

  // ─── Real error ───
  if (loadError || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 max-w-sm w-full text-left" role="alert">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-700">{loadError || 'Order not found.'}</p>
            <Button
              onClick={loadOrder}
              className="mt-2.5 h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
            >
              Retry
            </Button>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('orders')}
          className="mt-4 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
        >
          Go to My Orders
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      <main className="px-4 py-8 md:px-6 space-y-5 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        {/* Status heading — real state only */}
        <div className="text-center space-y-2">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-lg ${allDelivered ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-200 text-slate-500'}`}>
            {allDelivered ? <Check className="h-8 w-8 stroke-[3]" /> : <Truck className="h-7 w-7" />}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            {allDelivered ? 'Order Delivered' : 'Delivery Status'}
          </h1>
          <p className="text-xs text-slate-500">
            Order #{order.orderNumber}
            {statusText ? ` • ${statusText}` : ''}
            {deliveredAt
              ? ` • Delivered on ${new Date(deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : ''}
          </p>
          {!allDelivered && !anyDelivered && (
            <p className="text-[11px] text-slate-400">
              This order has not been marked as delivered by the supplier yet.
            </p>
          )}
        </div>

        {/* Card 1: Proof of Delivery — honest: only if a real POD exists */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="aspect-[16/9] rounded-2xl bg-gray-100 dark:bg-gray-800 border border-slate-200 flex flex-col items-center justify-center gap-2">
            <Truck className="h-8 w-8 text-gray-400" />
            <p className="text-[11px] font-semibold text-gray-400">No proof-of-delivery photo available yet</p>
          </div>

          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-slate-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-bold text-slate-900">Proof of Delivery</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {deliveredAt
                  ? `Delivery recorded on ${new Date(deliveredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
                  : 'Delivery will be confirmed by the supplier in the tracking timeline.'}
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('delivery-proof', { orderId })}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" />
            View Proof of Delivery
          </Button>
        </div>

        {/* Card 2: Items Received — real items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-start">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Items Received ({items.length})</h2>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No line items recorded on this order.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 space-y-2 pt-1">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-1">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {item.product?.name || '--'}
                      </h3>
                    </div>
                    <span className="bg-slate-100 text-slate-700 text-xs font-mono font-bold px-2.5 py-1 rounded-lg shrink-0 ml-3">
                      x{item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Rate Delivery — real submission to the feedback API */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs text-center space-y-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900">Rate Delivery</h2>
              <p className="text-xs text-slate-400 mt-0.5">How was the logistics service?</p>
            </div>

            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRate(star)}
                  disabled={ratingSubmitting || ratingSaved}
                  className="p-1 transition-transform hover:scale-110 disabled:cursor-default"
                  aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                >
                  {ratingSubmitting && rating === star ? (
                    <Loader2 className="h-7 w-7 text-slate-400 animate-spin" />
                  ) : (
                    <Star
                      className={`h-7 w-7 ${
                        star <= rating
                          ? 'fill-amber-400 stroke-amber-400'
                          : 'stroke-slate-300 fill-transparent'
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>

            {ratingSaved && (
              <p className="text-[11px] font-bold text-emerald-600">
                Thank you — your delivery rating was saved.
              </p>
            )}
            {ratingError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-left" role="alert">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[11px] font-bold text-red-700">{ratingError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Return to Dashboard */}
        <div className="text-center pt-2">
          <button
            onClick={() => navigate('buyer-dashboard')}
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </main>
    </div>
  )
}

export default DeliveryConfirmationPage
