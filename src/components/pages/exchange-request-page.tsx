'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, HelpCircle, Check, CheckCircle2,
  Package, AlertCircle, RefreshCw, LogIn, RefreshCcw
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

interface OrderData {
  id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  placedAt: string
  subOrders: Array<{ id: string; status: string; items: OrderItem[] }>
}

interface ReplacementOption {
  id: string
  variantName: string
  variantValue: string
  sku: string | null
  stockQuantity: number
  effectivePrice: number
  isAvailable: boolean
}

interface ExchangeResult {
  exchangeId: string
  orderId: string
  status: string
  message?: string
}

const REASONS = [
  { value: 'wrong-spec', label: 'Wrong specification ordered' },
  { value: 'damaged', label: 'Damaged on arrival' },
  { value: 'defect', label: 'Manufacturing defect' },
  { value: 'not-as-described', label: 'Not as described' },
]

export function ExchangeRequestPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''
  const itemId = pageParams.itemId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [order, setOrder] = useState<OrderData | null>(null)
  const [originalItem, setOriginalItem] = useState<OrderItem | null>(null)
  const [options, setOptions] = useState<ReplacementOption[]>([])

  const [selectedId, setSelectedId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<ExchangeResult | null>(null)

  const fetchData = useCallback(async () => {
    if (!orderId || !itemId) {
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
        return
      }
      const o: OrderData = data?.data
      setOrder(o || null)

      const allItems: OrderItem[] = (o?.subOrders || []).flatMap((so) => so.items || [])
      const item = allItems.find((i) => i.id === itemId) || null
      setOriginalItem(item)

      if (item?.productId) {
        const varRes = await fetch(`/api/products/${item.productId}/variants`)
        const varData = await varRes.json().catch(() => null)
        if (varRes.ok) {
          const list: ReplacementOption[] = Array.isArray(varData?.data?.variants) ? varData.data.variants : []
          setOptions(list)
          setSelectedId(list.find((v) => v.isAvailable)?.id || '')
        } else {
          setOptions([])
        }
      } else {
        setOptions([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading the exchange')
    } finally {
      setLoading(false)
    }
  }, [orderId, itemId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const selectedOpt = useMemo(() => options.find((o) => o.id === selectedId) || null, [options, selectedId])

  /* Price difference computed from real prices only */
  const priceDiffUnit = selectedOpt && originalItem ? selectedOpt.effectivePrice - originalItem.unitPrice : 0
  const priceDiffTotal = originalItem ? priceDiffUnit * originalItem.quantity : 0

  const handleSubmit = async () => {
    if (!orderId || !itemId) return
    if (!selectedOpt) {
      setSubmitError('Please select a replacement variant first.')
      return
    }
    if (!reason) {
      setSubmitError('Please select a reason for the exchange.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalItemId: itemId,
          replacementOptionId: selectedOpt.id,
          reason,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401) {
          setNeedsAuth(true)
          setSubmitError('Your session has expired. Please sign in again to submit this exchange.')
        } else {
          setSubmitError(data?.error || `Exchange request failed (${res.status})`)
        }
        return
      }
      setResult(data?.data || null)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Network error while submitting the exchange request')
    } finally {
      setSubmitting(false)
    }
  }

  /* ─── Success — real response data ─── */
  if (result) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Exchange Request Submitted</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Reference <strong className="text-slate-800">{result.exchangeId}</strong> —{' '}
          {result.message || 'You will be notified once it is processed.'}
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('my-orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            View My Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
          >
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  /* ─── No order/item reference — honest state ─── */
  if (!orderId || !itemId) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Exchange Request</h1>
          </div>
        </header>
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            <RefreshCcw className="h-9 w-9 text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900">No order item selected</h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Exchanges are started from a specific item in one of your orders. Open the order and
            choose “Exchange” on the item.
          </p>
          <Button
            onClick={() => navigate('my-orders')}
            className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md"
          >
            View My Orders
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Exchange Request</h1>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-700" title="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Error / auth / not found states */}
        {(notFound || needsAuth || error) && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              {needsAuth ? <LogIn className="h-7 w-7 text-gray-400" /> : <AlertCircle className="h-7 w-7 text-gray-400" />}
            </div>
            <h2 className="text-sm font-black text-slate-900">
              {notFound ? 'Order not found' : needsAuth ? 'Sign in required' : 'Couldn\u2019t load this exchange'}
            </h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {notFound
                ? 'We couldn\u2019t find this order. It may belong to a different account.'
                : needsAuth
                  ? 'Sign in with the buyer account that placed this order to request an exchange.'
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
                  onClick={fetchData}
                  className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
              <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
              <div className="h-4 w-1/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-20 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            </div>
          </div>
        )}

        {/* Original Item — real order data */}
        {!loading && !error && !needsAuth && !notFound && originalItem && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              ORIGINAL ITEM · ORDER #{order?.orderNumber}
            </span>

            <div className="flex gap-3 items-center">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200">
                {originalItem.product?.thumbnailUrl ? (
                  <img
                    src={originalItem.product.thumbnailUrl}
                    alt={originalItem.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 w-full h-full">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                  {originalItem.product?.name || 'Product'}
                </h3>
                {originalItem.variant && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Current: {originalItem.variant.variantName}: {originalItem.variant.variantValue}
                  </p>
                )}

                <div className="flex justify-between items-baseline mt-2">
                  <span className="text-xs text-slate-500 font-medium">
                    Qty: {originalItem.quantity} {originalItem.product?.unit || 'units'}
                  </span>
                  <span className="text-xs font-black text-primary">{formatPrice(originalItem.totalPrice)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Item not found in order — honest */}
        {!loading && !error && !needsAuth && !notFound && !originalItem && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">Item not found in this order</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              The selected item doesn&apos;t belong to this order anymore.
            </p>
          </div>
        )}

        {/* Replacement Selection — real variants only */}
        {!loading && !error && !needsAuth && !notFound && originalItem && options.length > 0 && (
          <div className="space-y-2.5">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
                REPLACEMENT SELECTION
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Live variants of this product — stock and prices are real.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {options.map((opt) => {
                const isSelected = selectedId === opt.id
                const diffUnit = opt.effectivePrice - originalItem.unitPrice

                return (
                  <button
                    key={opt.id}
                    disabled={!opt.isAvailable}
                    onClick={() => setSelectedId(opt.id)}
                    className={`w-full text-left bg-white rounded-3xl p-4 border transition-all shadow-2xs ${
                      !opt.isAvailable
                        ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                        : isSelected
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-bold text-slate-900">
                            {opt.variantName}: {opt.variantValue}
                          </h3>
                          {!opt.isAvailable && (
                            <span className="bg-slate-200 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-md">
                              Out of Stock
                            </span>
                          )}
                        </div>
                        {opt.sku && <p className="text-[10px] text-slate-400 mt-0.5">SKU: {opt.sku}</p>}
                      </div>

                      {opt.isAvailable && (
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-50 flex justify-between items-baseline text-xs">
                      <span className="text-[11px] text-slate-500">
                        In stock: {opt.stockQuantity.toLocaleString()}
                      </span>
                      <span className="text-xs font-black text-slate-800">
                        {formatPrice(opt.effectivePrice)}
                        <span className="text-[10px] font-normal text-slate-400 ml-1">
                          ({diffUnit === 0 ? 'same price' : `${diffUnit > 0 ? '+' : '−'}${formatPrice(Math.abs(diffUnit))}/unit`})
                        </span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* No variants configured — honest */}
        {!loading && !error && !needsAuth && !notFound && originalItem && options.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Package className="h-7 w-7 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">No replacement variants available</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              This product has no variants configured to exchange to. Contact the supplier or
              request a return instead.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('return-request', { orderId })}
              className="mt-5 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 px-6 rounded-2xl"
            >
              Request a Return
            </Button>
          </div>
        )}

        {/* Exchange Summary + submit — computed from real prices */}
        {!loading && !error && !needsAuth && !notFound && originalItem && options.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
              EXCHANGE SUMMARY
            </h2>

            <div className="space-y-1.5 text-xs text-slate-500 pt-1">
              <div className="flex justify-between">
                <span>Current item value ({originalItem.quantity} units)</span>
                <span className="font-semibold text-slate-900">{formatPrice(originalItem.totalPrice)}</span>
              </div>
              {selectedOpt && (
                <div className="flex justify-between">
                  <span>Replacement value ({originalItem.quantity} units)</span>
                  <span className="font-semibold text-slate-900">
                    {formatPrice(selectedOpt.effectivePrice * originalItem.quantity)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">Price difference</span>
                <span className="text-base font-black text-primary">
                  {priceDiffTotal === 0 ? formatPrice(0) : `${priceDiffTotal > 0 ? '+' : '−'}${formatPrice(Math.abs(priceDiffTotal))}`}
                </span>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-slate-800">Reason for Exchange *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-11 rounded-2xl bg-white border border-slate-200 text-xs font-medium px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800">Additional Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the supplier should know…"
                rows={2}
                className="rounded-2xl bg-white border-slate-200 text-xs font-medium resize-none"
              />
            </div>

            <p className="text-[10px] text-slate-400">
              The final settlement is confirmed by the supplier when the exchange is processed.
            </p>

            {submitError && (
              <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-2.5 leading-relaxed flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {submitError}
              </p>
            )}

            <div className="space-y-2 pt-2">
              <Button
                variant="outline"
                onClick={goBack}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
              >
                Cancel Exchange
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedOpt || !reason}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Exchange Request'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ExchangeRequestPage
