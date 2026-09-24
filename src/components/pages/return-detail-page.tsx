'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Check, Truck, Headphones,
  Package, AlertCircle, RefreshCw, LogIn, Box, RotateCcw
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
  supplier: { companyName: string; ratingAvg?: number }
  subtotal: number
  trackingNumber: string | null
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
  const [order, setOrder] = useState<OrderData | null>(null)

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setNotFound(false)
    setNeedsAuth(false)
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 404) setNotFound(true)
        else if (res.status === 401) setNeedsAuth(true)
        else setError(data?.error || `Failed to load return (${res.status})`)
        setOrder(null)
        return
      }
      setOrder(data?.data || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading the return')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  /* Only sub-orders actually marked 'returned' by the real returns API are shown */
  const returnedSubOrders = useMemo<SubOrder[]>(() => {
    if (!order) return []
    return order.subOrders.filter((so) => so.status === 'returned')
  }, [order])

  const returnedValue = useMemo(() => {
    return returnedSubOrders.reduce(
      (acc, so) => acc + (so.items || []).reduce((s, i) => s + i.totalPrice, 0),
      0
    )
  }, [returnedSubOrders])

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
              Order #{order?.orderNumber || orderId.slice(-8).toUpperCase()}
              {returnId ? ` · Ref ${returnId}` : ''}
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
              {notFound ? 'Order not found' : needsAuth ? 'Sign in required' : 'Couldn\u2019t load this return'}
            </h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              {notFound
                ? 'We couldn\u2019t find this order. It may belong to a different account.'
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
                  onClick={fetchOrder}
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

        {/* No returned sub-orders — honest empty */}
        {!loading && !error && !needsAuth && !notFound && order && returnedSubOrders.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <RotateCcw className="h-9 w-9 text-gray-400" />
            </div>
            <h2 className="text-sm font-black text-slate-900">No return found for this order</h2>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
              No items in order #{order.orderNumber} have been marked as returned yet. If you
              recently submitted a return request, its status will appear here.
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

        {/* Returned items — real data */}
        {!loading && !error && !needsAuth && !notFound && returnedSubOrders.length > 0 && (
          <>
            {/* Status card — real sub-order statuses from the backend */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <h2 className="text-xs font-black text-slate-900">Status</h2>

              <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl flex items-center gap-2.5 text-xs text-slate-700">
                <Truck className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[11px]">
                  Return recorded by the marketplace. The supplier will arrange pickup — track
                  updates from your orders page.
                </span>
              </div>

              {returnedSubOrders.map((so) => (
                <div key={so.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-slate-900 truncate">
                      {so.supplier?.companyName || 'Supplier'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {so.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Items in Return — real order items */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold text-slate-900">Items in Return</h2>

              <div className="space-y-3 pt-1">
                {returnedSubOrders.flatMap((so) =>
                  (so.items || []).map((item) => {
                    const image = item.product?.thumbnailUrl || null
                    return (
                      <div key={item.id} className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 flex gap-3 items-center">
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200">
                          {image ? (
                            <img src={image} alt={item.product?.name || 'Product'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 w-full h-full">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                            {item.product?.name || 'Product'}
                          </h3>
                          {item.variant && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {item.variant.variantName}: {item.variant.variantValue}
                            </p>
                          )}
                          <div className="flex justify-between items-baseline mt-1">
                            <span className="text-[11px] text-slate-500 font-medium">Qty: {item.quantity}</span>
                            <span className="text-xs font-black text-slate-900">{formatPrice(item.totalPrice)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}

                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-800">Returned items value</span>
                  <span className="text-base font-black text-slate-900">{formatPrice(returnedValue)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default ReturnDetailPage
