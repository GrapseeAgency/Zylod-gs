'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Menu, Search, ArrowLeft, Star, Building2, Package,
  CheckCircle2, AlertCircle, Loader2
} from 'lucide-react'

/**
 * REAL order feedback — ratings are submitted to POST /api/orders/[id]/feedback,
 * which persists real reviews (verified purchase) for the order's products.
 * No pre-filled ratings, no fake order/product data, success only when the
 * API actually confirms the submission.
 */

interface ApiItem {
  id: string
  quantity: number
  product?: { id: string; name: string; thumbnailUrl?: string | null; unit?: string | null } | null
}

interface ApiSubOrder {
  id: string
  supplier?: { companyName?: string } | null
  items: ApiItem[]
}

interface ApiOrder {
  id: string
  orderNumber: string
  subOrders: ApiSubOrder[]
}

const getLabel = (stars: number) => {
  switch (stars) {
    case 5: return 'Excellent'
    case 4: return 'Good'
    case 3: return 'Average'
    case 2: return 'Fair'
    case 1: return 'Poor'
    default: return 'Rate'
  }
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-1 text-primary transition-transform hover:scale-110"
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            className={`h-6 w-6 ${
              star <= value
                ? 'fill-primary stroke-primary'
                : 'stroke-rose-200 fill-transparent'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export function OrderFeedbackPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [qualityRating, setQualityRating] = useState(0)
  const [shippingRating, setShippingRating] = useState(0)
  const [commRating, setCommRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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
  const supplierNames = order
    ? Array.from(
        new Set(
          order.subOrders
            .map((so) => so.supplier?.companyName)
            .filter((n): n is string => typeof n === 'string' && n.length > 0)
        )
      )
    : []

  const allRated = qualityRating > 0 && shippingRating > 0 && commRating > 0
  const overallRating = allRated
    ? Math.round((qualityRating + shippingRating + commRating) / 3)
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId) return
    setSubmitError('')
    if (!allRated) {
      setSubmitError('Please rate Item Quality, Shipping Speed and Supplier Communication first.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          overallRating,
          productQuality: qualityRating,
          deliverySpeed: shippingRating,
          supplierCommunication: commRating,
          reviewText: reviewText.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setSubmitError(json?.error || `Feedback submission failed (HTTP ${res.status}).`)
        return
      }
      setSubmitted(true)
    } catch {
      setSubmitError('Network error while submitting feedback. Check your connection and retry.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Header (shared) ───
  const header = (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
      <div className="flex items-center justify-between">
        <button className="p-1 text-slate-700 hover:text-slate-900" title="Menu">
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="Search">
          <Search className="h-6 w-6" />
        </button>
      </div>
    </header>
  )

  // ─── No order selected — honest state ───
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
        {header}
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Star className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-black text-slate-900">No order selected</h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
            Open one of your delivered orders and choose to leave feedback there —
            this screen reviews a specific order.
          </p>
          <Button
            onClick={() => navigate('orders')}
            className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl"
          >
            Go to My Orders
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {header}

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6 md:max-w-3xl lg:max-w-4xl md:space-y-6">
        {/* Back Link */}
        <button
          onClick={() => navigate('orders')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Order History</span>
        </button>

        {/* Title — real order reference only */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
            Order Feedback &amp; Issues
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 font-medium">
            {loading ? 'Loading order…' : order ? `Order #${order.orderNumber}` : 'Order unavailable'}
          </p>
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" role="alert">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-700">{loadError}</p>
              <Button
                onClick={loadOrder}
                className="mt-2 h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex gap-3.5 items-start" aria-busy="true" aria-live="polite">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        )}

        {/* Product(s) — real items of the order */}
        {!loading && !loadError && order && (
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs text-center">
                <Package className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  This order has no recorded products to review.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex gap-3.5 items-start"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.product?.thumbnailUrl ? (
                      <img
                        src={item.product.thumbnailUrl}
                        alt={item.product?.name || 'Product'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-xs font-bold text-slate-900 leading-snug">
                      {item.product?.name || '--'}
                    </h2>
                    {supplierNames.length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>Supplier: {supplierNames.join(', ')}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Package className="h-3 w-3 text-slate-400 shrink-0" />
                      <span>
                        Qty: {item.quantity}{item.product?.unit ? ` ${item.product.unit}` : ''}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Rate Your Experience Section */}
        {!loading && !loadError && order && items.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-5">
            <h2 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400">
              Rate your experience
            </h2>

            {submitted ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                <h3 className="text-sm font-bold text-emerald-900">Feedback Submitted</h3>
                <p className="text-xs text-emerald-700">
                  Thank you — your verified review was saved for the products in this order.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Criteria Grid */}
                <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
                  {/* Criterion 1: Item Quality */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Item Quality</span>
                      <span className="text-xs font-bold text-slate-500">{getLabel(qualityRating)}</span>
                    </div>
                    <StarPicker value={qualityRating} onChange={setQualityRating} />
                  </div>

                  {/* Criterion 2: Shipping Speed */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Shipping Speed</span>
                      <span className="text-xs font-bold text-slate-500">{getLabel(shippingRating)}</span>
                    </div>
                    <StarPicker value={shippingRating} onChange={setShippingRating} />
                  </div>

                  {/* Criterion 3: Supplier Comm. */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Supplier Comm.</span>
                      <span className="text-xs font-bold text-slate-500">{getLabel(commRating)}</span>
                    </div>
                    <StarPicker value={commRating} onChange={setCommRating} />
                  </div>
                </div>

                {/* Written Review Textarea */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-700">Detailed Feedback (Optional)</label>
                  <Textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share details about packaging quality, delivery punctuality, or vendor cooperation..."
                    rows={3}
                    className="rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium resize-none"
                  />
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" role="alert">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs font-bold text-red-700">{submitError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !allRated}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Submitting Review...' : 'Submit Order Feedback'}
                </Button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default OrderFeedbackPage
