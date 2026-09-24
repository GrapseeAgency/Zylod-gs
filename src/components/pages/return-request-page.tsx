'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Minus, Plus,
  Package, ChevronRight, AlertCircle, RefreshCw, LogIn, Box
} from 'lucide-react'

interface OrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: { id: string; name: string; thumbnailUrl: string | null; unit: string; slug: string } | null
  variant: { id: string; variantName: string; variantValue: string } | null
}

interface SubOrder {
  id: string
  status: string
  supplier: { companyName: string } | null
  items: OrderItem[]
}

interface OrderData {
  id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  placedAt: string
  subOrders: SubOrder[]
}

const REASONS = [
  { value: 'damaged', label: 'Damaged on arrival' },
  { value: 'wrong', label: 'Wrong item received' },
  { value: 'defect', label: 'Manufacturing defect' },
  { value: 'specs', label: 'Not as specified in catalog' },
]

export function ReturnRequestPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [order, setOrder] = useState<OrderData | null>(null)

  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setNotFound(false)
    setNeedsAuth(false)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 404) setNotFound(true)
        else if (res.status === 401) setNeedsAuth(true)
        else setError(data?.error || `Failed to load order (${res.status})`)
        setOrder(null)
        return
      }
      setOrder(data?.data || null)
      // start with nothing pre-selected — the buyer picks what to return
      setSelectedItems({})
      setQuantities({})
      setReasons({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading order')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const items = useMemo<OrderItem[]>(() => {
    if (!order) return []
    return order.subOrders.flatMap((so) => so.items || [])
  }, [order])

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }))
    setQuantities((prev) => ({ ...prev, [id]: prev[id] || 1 }))
  }

  const handleQtyChange = (id: string, delta: number, max: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, Math.min(max, (prev[id] || 1) + delta)),
    }))
  }

  const selectedIds = Object.keys(selectedItems).filter((k) => selectedItems[k])
  const selectedCount = selectedIds.length
  const selectedQty = selectedIds.reduce((acc, id) => acc + (quantities[id] || 1), 0)
  const totalRefund = items.reduce((acc, item) => {
    if (selectedItems[item.id]) {
      return acc + item.unitPrice * (quantities[item.id] || 1)
    }
    return acc
  }, 0)

  const missingReason = selectedIds.some((id) => !reasons[id])

  const handleContinue = async () => {
    if (!orderId) return
    if (missingReason) {
      setSubmitError('Please choose a reason for every selected item.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedIds.map((id) => ({
            itemId: id,
            reason: reasons[id],
            quantity: quantities[id] || 1,
            comments: comments.trim() || undefined,
          })),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401) {
          setNeedsAuth(true)
          setSubmitError('Your session has expired. Please sign in again to submit this return.')
        } else {
          setSubmitError(data?.error || `Return request failed (${res.status})`)
        }
        return
      }
      // Real backend confirmation — navigate to the order's return view
      navigate('return-detail', { orderId })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Network error while submitting the return request')
    } finally {
      setSubmitting(false)
    }
  }

  /* ─── No order id — honest state ─── */
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            <Box className="h-9 w-9 text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900">No order selected</h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Returns are started from a specific order. Open one of your delivered orders and choose
            “Return”.
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

  /* ─── Auth / not found / load error — honest states ─── */
  if (notFound || needsAuth || error) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5 text-primary" />
            </button>
            <h1 className="text-base font-bold text-primary">Return Request</h1>
          </div>
        </header>
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            {needsAuth ? <LogIn className="h-9 w-9 text-gray-400" /> : <AlertCircle className="h-9 w-9 text-gray-400" />}
          </div>
          <h1 className="text-base font-black text-slate-900">
            {notFound ? 'Order not found' : needsAuth ? 'Sign in required' : 'Couldn\u2019t load this order'}
          </h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            {notFound
              ? 'We couldn\u2019t find this order. It may belong to a different account.'
              : needsAuth
                ? 'Sign in with the buyer account that placed this order to request a return.'
                : error}
          </p>
          <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto">
            {needsAuth ? (
              <Button
                onClick={() => navigate('login')}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl shadow-md"
              >
                Sign In
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={fetchOrder}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={goBack}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-10 rounded-2xl"
            >
              Go Back
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-primary">Return Request</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <h1 className="hidden md:block text-2xl font-bold text-primary">Return Request</h1>

        {/* Progress Card — real order identity */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-bold text-slate-900">Order #{order?.orderNumber}</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {order?.placedAt
                  ? `Placed ${new Date(order.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : null}
              </p>
            </div>
            <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-md capitalize">
              {order?.paymentStatus || ''}
            </span>
          </div>

          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full w-1/3" />
          </div>

          <p className="text-[11px] text-slate-500 font-medium">Select items to return</p>
        </div>

        {/* Section: Select Items */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-900">Select Items</h2>

          {items.map((item) => {
            const isSelected = !!selectedItems[item.id]
            const qty = quantities[item.id] || 1
            const orderedQty = item.quantity
            const image = item.product?.thumbnailUrl || null

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border transition-all overflow-hidden shadow-2xs ${
                  isSelected ? 'border-primary ring-1 ring-primary/20 border-l-4 border-l-primary' : 'border-slate-200'
                }`}
              >
                {/* Item Header */}
                <div className="p-4 flex gap-3 items-start">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 rounded text-primary accent-primary mt-1 shrink-0 cursor-pointer"
                  />

                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200">
                    {image ? (
                      <img src={image} alt={item.product?.name || 'Product'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 w-full h-full">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                      {item.product?.name || 'Product'}
                    </h3>
                    {item.variant && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.variant.variantName}: {item.variant.variantValue}
                      </p>
                    )}
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-xs font-black text-primary">
                        {formatPrice(item.unitPrice)}{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          / {item.product?.unit || 'unit'}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Qty: {orderedQty}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Return Details Form (Shown if item is checked) */}
                {isSelected && (
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 space-y-4">
                    {/* Reason */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Reason for Return *
                      </label>
                      <select
                        value={reasons[item.id] || ''}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full h-11 rounded-2xl bg-white border border-slate-200 text-xs font-medium px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Select a reason…</option>
                        {REASONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Quantity to Return
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                          <button
                            onClick={() => handleQtyChange(item.id, -1, orderedQty)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-10 text-center text-xs font-bold text-slate-900">
                            {qty}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, 1, orderedQty)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs text-slate-400">of {orderedQty} ordered</span>
                      </div>
                    </div>

                    {/* Additional Comments */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">
                        Additional Comments
                      </label>
                      <Textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="Describe the issue in detail..."
                        rows={2}
                        className="rounded-2xl bg-white border-slate-200 text-xs font-medium resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Empty order items — honest */}
        {items.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Package className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">Nothing to return</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              This order doesn&apos;t contain any line items, so there is nothing to return.
            </p>
          </div>
        )}
      </main>

      {/* Sticky Bottom Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
          <div className="max-w-lg md:max-w-2xl mx-auto space-y-2">
            {submitError && (
              <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-2.5 leading-relaxed flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {submitError}
              </p>
            )}

            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-500">
                Selected: <strong>{selectedCount}</strong> item{selectedCount === 1 ? '' : 's'} · Qty: <strong>{selectedQty}</strong>
              </span>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">Estimated Refund:</span>
                <span className="text-sm font-black text-primary">{formatPrice(totalRefund)}</span>
              </div>
            </div>

            <Button
              onClick={handleContinue}
              disabled={selectedCount === 0 || submitting || missingReason}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Submitting Request…' : 'Submit Return Request'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReturnRequestPage
