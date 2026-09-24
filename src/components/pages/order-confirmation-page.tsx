'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Check, Truck, Package, AlertCircle, Loader2, ShoppingBag
} from 'lucide-react'

/**
 * REAL order confirmation — renders the order that was actually created
 * server-side (GET /api/orders/[id]). No hardcoded items, totals or dates.
 * Without an orderId there is nothing to confirm — an honest empty state is
 * shown instead of demo content. Payment status is shown verbatim (orders
 * start UNPAID and are never shown as paid without a verified payment).
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
  subtotal: number
  shippingCost: number
  status: string
  estimatedDelivery?: string | null
  supplier?: { companyName?: string } | null
  items: ApiItem[]
}

interface ApiOrder {
  id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  placedAt: string
  subOrders: ApiSubOrder[]
}

export function OrderConfirmationPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Could not load the order (HTTP ${res.status})`)
        setOrder(null)
        return
      }
      setOrder(json.data as ApiOrder)
    } catch {
      setError('Network error while loading the order. Check your connection and retry.')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  // ─── No order reference — honest empty state, never demo content ───
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <ShoppingBag className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-lg font-black text-slate-900">No order to confirm</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          This screen shows the details of an order you have placed. Place an order
          first and its real details will appear here.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            View My Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
          >
            Continue Sourcing
          </Button>
        </div>
      </div>
    )
  }

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 md:pb-10 text-slate-900" aria-busy="true" aria-live="polite">
        <main className="px-4 md:px-6 py-6 md:py-10 space-y-5 max-w-lg mx-auto lg:max-w-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading your order…
          </p>
        </main>
      </div>
    )
  }

  // ─── Real error — surfaced verbatim ───
  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 max-w-sm w-full text-left" role="alert">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-700">{error || 'Order not found.'}</p>
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

  const subOrders = Array.isArray(order.subOrders) ? order.subOrders : []
  const allItems = subOrders.flatMap((so) => (Array.isArray(so.items) ? so.items : []))
  const subtotal = subOrders.reduce((sum, so) => sum + (so.subtotal || 0), 0)
  const shipping = subOrders.reduce((sum, so) => sum + (so.shippingCost || 0), 0)
  const paymentStatus = (order.paymentStatus || '').toUpperCase()
  const isPaid = paymentStatus === 'paid'
  const realEstDeliveries = subOrders
    .map((so) => so.estimatedDelivery)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort()
  const estDelivery = realEstDeliveries[0]
    ? new Date(realEstDeliveries[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs text-center md:hidden">
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
      </header>

      <main className="px-4 md:px-6 py-6 md:py-10 space-y-6 md:space-y-8 max-w-lg mx-auto lg:max-w-2xl">
        {/* Success Icon & Heading */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center">
              <Check className="h-7 w-7 stroke-[3]" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Order Received</h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1.5 leading-relaxed">
              Order <span className="font-bold text-slate-700">#{order.orderNumber}</span> was created
              and sent to the supplier{allItems.length > 0 ? ` with ${allItems.length} item${allItems.length === 1 ? '' : 's'}` : ''}.
            </p>
          </div>
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
          {/* Header Strip */}
          <div className="p-4 bg-slate-50/70 flex justify-between items-center">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Order Number</span>
              <span className="text-xs font-black text-slate-900">{order.orderNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Est. Delivery</span>
              <span className="text-xs font-black text-primary">
                {estDelivery || 'To be scheduled by the supplier'}
              </span>
            </div>
          </div>

          {/* Payment Status — real, never faked as paid */}
          <div className="p-4 flex items-center gap-2.5">
            <Package className="h-4 w-4 text-slate-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Payment status: <span className={isPaid ? 'text-emerald-600 uppercase' : 'text-amber-600 uppercase'}>{paymentStatus || 'UNKNOWN'}</span>
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isPaid
                  ? 'Your payment has been verified.'
                  : 'This order is not confirmed until payment is verified. Use the payment instructions on the order to pay.'}
              </p>
            </div>
          </div>

          {/* Items Ordered List */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Package className="h-4 w-4 text-slate-600" />
              <span>Items Ordered ({allItems.length})</span>
            </div>

            {allItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                This order has no line items recorded.
              </p>
            ) : (
              <div className="space-y-3 pt-1 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                {allItems.map((item) => (
                  <div key={item.id} className="flex gap-3 items-center">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.product?.thumbnailUrl ? (
                        <img src={item.product.thumbnailUrl} alt={item.product?.name || 'Product'} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                        {item.product?.name || '--'}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Qty: {item.quantity}{item.product?.unit ? ` ${item.product.unit}` : ''}
                      </p>
                      <p className="text-xs font-black text-primary mt-1">
                        {formatPrice(item.totalPrice || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Breakdown — only real numbers */}
          <div className="p-4 space-y-2 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Freight Shipping</span>
              <span className="font-semibold text-slate-800">
                {shipping > 0 ? formatPrice(shipping) : 'Set by supplier'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-xl font-black text-primary">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2 md:flex md:justify-center md:gap-3 md:space-y-0">
          <Button
            onClick={() => navigate('track-order', { orderId: order.id })}
            className="w-full md:w-auto md:px-8 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Truck className="h-4 w-4" />
            Track Order
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full md:w-auto md:px-8 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 md:h-12 rounded-2xl text-xs"
          >
            Continue Sourcing
          </Button>
        </div>
      </main>
    </div>
  )
}

export default OrderConfirmationPage
