'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, AlertTriangle, XCircle, Package
} from 'lucide-react'

/**
 * REAL order cancellation — no demo items, no fake success.
 * - Items come from GET /api/orders/[id] (the buyer's real order).
 * - Submission calls POST /api/orders/[id]/cancel with the selected real
 *   item ids. Backend errors are surfaced verbatim; success is only shown
 *   when the API actually confirms the cancellation.
 */

interface ApiItem {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product?: { id: string; name: string; thumbnailUrl?: string | null; unit?: string | null } | null
}

interface ApiSubOrder {
  id: string
  status: string
  supplier?: { companyName?: string } | null
  items: ApiItem[]
}

interface ApiOrder {
  id: string
  orderNumber: string
  status?: string
  subOrders: ApiSubOrder[]
}

interface CancelResult {
  cancellationId: string
  refundAmount: number
  message?: string
}

const CANCEL_REASONS = [
  { value: 'mistake', label: 'Ordered by mistake' },
  { value: 'delay', label: 'Delayed shipment schedule' },
  { value: 'price', label: 'Found better wholesale pricing' },
  { value: 'specs', label: 'Specifications / Requirements changed' },
  { value: 'other', label: 'Other reason' },
]

export function CancelOrderPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<CancelResult | null>(null)

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

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const selectedCount = items.filter((i) => selectedItems[i.id]).length

  const handleCancelSubmit = async () => {
    if (!orderId) return
    setSubmitError('')
    const itemIds = items.filter((i) => selectedItems[i.id]).map((i) => i.id)
    if (itemIds.length === 0) {
      setSubmitError('Select at least one item to cancel.')
      return
    }
    if (!reason) {
      setSubmitError('Please provide a reason for cancellation.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemIds, reason, notes: notes.trim() || undefined }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setSubmitError(json?.error || `Cancellation failed (HTTP ${res.status}).`)
        return
      }
      setResult({
        cancellationId: json.data?.cancellationId || '',
        refundAmount: typeof json.data?.refundAmount === 'number' ? json.data.refundAmount : 0,
        message: json.message,
      })
    } catch {
      setSubmitError('Network error while submitting the cancellation. Check your connection and retry.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── No order selected — honest state ───
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <XCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-lg font-black text-slate-900">No order selected</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Open one of your orders and choose the cancel action there — this screen
          cancels items of a specific order.
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

  // ─── Real cancellation result (only after the API confirmed it) ───
  if (result) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 bg-rose-50 text-primary rounded-full flex items-center justify-center mb-4 border border-rose-100">
          <XCircle className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Cancellation Submitted</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          {result.message ||
            `Your cancellation request for order ${order?.orderNumber || ''} was received.`}
          {result.refundAmount > 0 && (
            <> Refund amount recorded: <span className="font-bold text-slate-700">{formatPrice(result.refundAmount)}</span>.</>
          )}
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            Return to My Orders
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900 truncate">
            Cancel Order{order ? ` #${order.orderNumber}` : ''}
          </h1>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" role="alert">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
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
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3" aria-busy="true" aria-live="polite">
            <div className="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !loadError && order && items.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <Package className="h-8 w-8 text-slate-400 mx-auto mb-3" />
            <h2 className="text-sm font-black text-slate-900">No cancelable items found</h2>
            <p className="text-xs text-slate-500 mt-1">
              This order has no line items available for cancellation.
            </p>
          </div>
        )}

        {/* Card 1: Step 1 Select Items */}
        {!loading && !loadError && order && items.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center shrink-0">
                1
              </div>
              <h2 className="text-xs font-black text-slate-900">Select Items to Cancel</h2>
            </div>
            <p className="text-xs text-slate-500">
              Choose the items you wish to remove from order #{order.orderNumber}.
            </p>

            <div className="space-y-3 pt-1 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
              {items.map((item) => {
                const isChecked = !!selectedItems[item.id]

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                      isChecked
                        ? 'border-primary bg-rose-50/40 ring-1 ring-primary/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-primary accent-primary cursor-pointer shrink-0"
                    />

                    <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.product?.thumbnailUrl ? (
                        <img
                          src={item.product.thumbnailUrl}
                          alt={item.product?.name || 'Product'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {item.product?.name || '--'}
                      </h3>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-xs font-black text-primary">
                          {formatPrice(item.totalPrice || 0)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Qty: {item.quantity}{item.product?.unit ? ` ${item.product.unit}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Card 2: Step 2 Reason */}
        {!loading && !loadError && order && items.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                2
              </div>
              <h2 className="text-xs font-black text-slate-900">Reason for Cancellation</h2>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Please select a reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-11 rounded-2xl bg-white border border-slate-200 text-xs font-medium px-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select an option...</option>
                {CANCEL_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Additional Notes <span className="text-slate-400 font-normal">(Optional)</span></label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Provide any additional details to help us improve..."
                rows={3}
                className="rounded-2xl bg-white border-slate-200 text-xs font-medium resize-none"
              />
            </div>
          </div>
        )}

        {/* Card 3: Refund Processing Alert */}
        {!loading && !loadError && order && items.length > 0 && (
          <div className="bg-rose-50/70 border border-rose-100 rounded-3xl p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h3 className="font-bold text-slate-900">Refund Processing</h3>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                If your payment has already been processed, refunds may take 3-5 business days to appear on your original payment method. Cancellations cannot be undone once confirmed.
              </p>
            </div>
          </div>
        )}

        {/* Submit error — real backend error text */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" role="alert">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs font-bold text-red-700">{submitError}</p>
          </div>
        )}

        {/* Action Buttons */}
        {!loading && !loadError && order && items.length > 0 && (
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              onClick={goBack}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
            >
              Keep Order
            </Button>

            <Button
              onClick={handleCancelSubmit}
              disabled={submitting || !reason || selectedCount === 0}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              {submitting ? 'Submitting...' : `Confirm Cancellation${selectedCount > 0 ? ` (${selectedCount} item${selectedCount === 1 ? '' : 's'})` : ''}`}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

export default CancelOrderPage
