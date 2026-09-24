'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, HelpCircle, Check, Package, Truck, Home,
  Download, AlertTriangle, MapPin, CreditCard, FileText, RefreshCw, XCircle
} from 'lucide-react'

// ── Real API types (GET /api/orders/[id]) ──────────────────────────────
interface ApiProduct { id: string; name: string; thumbnailUrl: string | null; unit: string | null; slug: string }
interface ApiVariant { id: string; variantName: string; variantValue: string }
interface ApiItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: ApiProduct
  variant: ApiVariant | null
}
interface ApiTracking { id: string; status: string; location: string | null; note: string | null; lat: number | null; lng: number | null; trackedAt: string }
interface ApiSubOrder {
  id: string
  supplierId: string
  supplier: { companyName: string; slug: string; ratingAvg: number; ratingCount: number } | { companyName: string; slug: string; ratingAvg: number; ratingCount: number }
  subtotal: number
  shippingCost: number
  status: string
  trackingNumber: string | null
  estimatedDelivery: string | null
  createdAt: string
  updatedAt: string
  items: ApiItem[]
  tracking: ApiTracking[]
}
interface ApiPayment { id: string; method: string; amount: number; status: string; transactionId: string | null; paidAt: string | null }
interface ApiOrderDetail {
  id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  placedAt: string
  updatedAt: string
  shippingAddress: {
    id: string; label: string | null; addressLine1: string; addressLine2: string | null
    city: string; district: string | null; postalCode: string | null
  } | null
  payments: ApiPayment[]
  subOrders: ApiSubOrder[]
}

/** Derive the display status purely from real sub-order statuses (mirror of backend logic). */
function deriveStatus(subOrders: ApiSubOrder[]): 'processing' | 'shipped' | 'delivered' | 'cancelled' {
  const statuses = subOrders.map((s) => (s.status || 'pending').toLowerCase())
  if (statuses.length === 0) return 'processing'
  if (statuses.every((s) => s === 'delivered')) return 'delivered'
  if (statuses.some((s) => s === 'cancelled')) return 'cancelled'
  if (statuses.some((s) => s === 'shipped')) return 'shipped'
  return 'processing'
}

function PlaceholderImage() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <Package className="h-5 w-5 text-gray-400" />
    </div>
  )
}

export function OrderDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const user = useAuthStore((s) => s.user)
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [order, setOrder] = useState<ApiOrderDetail | null>(null)

  const loadOrder = useCallback(async () => {
    if (!orderId) { setLoading(false); return }
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    setNotFound(false)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { credentials: 'include' })
      if (res.status === 401) { setNeedsAuth(true); setOrder(null); return }
      if (res.status === 404) { setNotFound(true); setOrder(null); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load order (HTTP ${res.status})`)
        setOrder(null)
        return
      }
      setOrder(json.data as ApiOrderDetail)
    } catch {
      setError('Network error while loading this order. Check your connection and retry.')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { loadOrder() }, [loadOrder])

  // ── Honest empty / guard states ───────────────────────────────────────
  if (!loading && !orderId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">No order selected</h1>
          <p className="text-xs text-slate-500">Pick an order from your order history to see its details.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-base font-black">Sign in required</h1>
          <p className="text-xs text-slate-500">You need to be signed in to view this order.</p>
          <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
        </div>
      </div>
    )
  }

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <XCircle className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">Order not found</h1>
          <p className="text-xs text-slate-500">This order does not exist or is not visible to your account.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-base font-black">Could not load order</h1>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={loadOrder} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  // ── Loading skeleton (never fake rows) ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 md:hidden">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </header>
        <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6 md:max-w-2xl lg:max-w-6xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-5 lg:col-span-2">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 lg:col-span-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            {[0, 1].map((i) => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 lg:col-start-3 lg:row-start-1 lg:row-span-2">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            {[0, 1, 2].map((i) => <div key={i} className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
          </div>
        </main>
      </div>
    )
  }

  // order is non-null here (all other paths returned above)
  if (!order) return null

  // ── Real derived values ───────────────────────────────────────────────
  const status = deriveStatus(order.subOrders)
  const subtotal = order.subOrders.reduce((sum, so) => sum + (typeof so.subtotal === 'number' ? so.subtotal : 0), 0)
  const shipping = order.subOrders.reduce((sum, so) => sum + (typeof so.shippingCost === 'number' ? so.shippingCost : 0), 0)
  const allItems = order.subOrders.flatMap((so) => so.items || [])
  const estDelivery = order.subOrders
    .map((so) => so.estimatedDelivery)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort()[0] || null
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
  const paymentStatusLabel = (order.paymentStatus || 'unpaid').toUpperCase()

  // Stepper progress from real statuses only
  const statuses = order.subOrders.map((s) => (s.status || 'pending').toLowerCase())
  const stepPacked = statuses.some((s) => ['processing', 'packed', 'shipped', 'delivered'].includes(s))
  const stepShipped = statuses.some((s) => ['shipped', 'delivered'].includes(s))
  const stepDelivered = statuses.length > 0 && statuses.every((s) => s === 'delivered')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-bold truncate max-w-[180px]">Order #{order.orderNumber || '--'}</h1>
          </div>
          <button onClick={() => navigate('help-center')} className="p-1 text-slate-400 hover:text-slate-700" title="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6 md:max-w-2xl lg:max-w-6xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        {/* Status Card & 4-Step Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-black">
                Order #{order.orderNumber || '--'}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Placed {new Date(order.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <Button
              onClick={() => navigate('track-order', { orderId })}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shadow-xs shrink-0"
            >
              Track Order
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              {statusLabel}
            </span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
              order.paymentStatus === 'paid'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}>
              {paymentStatusLabel}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            {estDelivery
              ? <>Estimated Delivery: <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(estDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></>
              : 'Estimated delivery: to be scheduled by the supplier'}
          </p>

          {/* 4-Step Stepper */}
          <div className="flex items-center justify-between px-2 pt-2">
            {/* Step 1: Placed */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Placed</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-1" />

            {/* Step 2: Packed */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-xs ${stepPacked ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Package className="h-4 w-4" />
              </div>
              <span className={`text-[10px] font-bold mt-1 ${stepPacked ? 'text-primary' : 'text-slate-400'}`}>Packed</span>
            </div>

            <div className={`flex-1 h-0.5 mx-1 ${stepPacked ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />

            {/* Step 3: Shipped */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-xs ${stepShipped ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Truck className="h-4 w-4" />
              </div>
              <span className={`text-[10px] font-bold mt-1 ${stepShipped ? 'text-primary' : 'text-slate-400'}`}>Shipped</span>
            </div>

            <div className={`flex-1 h-0.5 mx-1 ${stepShipped ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />

            {/* Step 4: Delivered */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${stepDelivered ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Home className="h-4 w-4" />
              </div>
              <span className={`text-[10px] font-bold mt-1 ${stepDelivered ? 'text-primary' : 'text-slate-400'}`}>Delivered</span>
            </div>
          </div>
        </div>

        {/* Items in Order Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 lg:col-span-2">
          <h2 className="text-xs md:text-sm font-bold">
            Items in Order ({allItems.length})
          </h2>

          {allItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No items recorded on this order.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-3 pt-1">
              {allItems.map((item, idx) => (
                <div key={item.id} className={`flex gap-3 items-center ${idx > 0 ? 'pt-3' : ''}`}>
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                    {item.product?.thumbnailUrl ? (
                      <img src={item.product.thumbnailUrl} alt={item.product?.name || 'Product'} className="w-full h-full object-cover" />
                    ) : (
                      <PlaceholderImage />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold line-clamp-1 leading-snug">
                      {item.product?.name || '--'}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {item.variant ? `${item.variant.variantName}: ${item.variant.variantValue} · ` : ''}
                      {item.product?.unit ? `Sold per ${item.product.unit}` : ''}
                    </p>
                    <div className="flex items-baseline justify-between mt-1.5">
                      <span className="text-xs font-black text-primary">
                        {formatPrice(item.totalPrice)}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({formatPrice(item.unitPrice)}/unit)
                        </span>
                      </span>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        Qty: {item.quantity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Summary Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 lg:col-start-3 lg:row-start-1 lg:row-span-2">
          <h2 className="text-xs md:text-sm font-bold">Payment Summary</h2>

          <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(shipping)}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total</span>
              <span className="text-xl md:text-2xl font-black text-primary">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Real payment records */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {order.payments.length === 0 ? (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                No payments recorded yet. Orders start <span className="font-bold text-amber-600">UNPAID</span> — payment is confirmed only after verification.
              </p>
            ) : (
              order.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 capitalize">
                    <CreditCard className="h-3.5 w-3.5" /> {p.method || '--'}
                  </span>
                  <span className="text-right">
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">{formatPrice(p.amount)}</span>
                    <span className="text-[10px] uppercase text-slate-400">{p.status || '--'}</span>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-2">
            <Button
              variant="outline"
              onClick={() => navigate('order-invoice', { orderId })}
              className="w-full bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              View Invoice
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => navigate('submit-ticket', { orderId })}
                className="py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Raise Dispute Ticket
              </button>

              <button
                onClick={() => navigate('report-user', { orderId })}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Report Seller
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] md:text-xs text-slate-500 dark:text-slate-400 pt-2 px-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => navigate('escrow-protection-guide')}
                className="hover:text-red-600 hover:underline"
              >
                SafePay Escrow Rules
              </button>
              <button
                onClick={() => navigate('buyer-protection-policy')}
                className="hover:text-red-600 hover:underline"
              >
                48h Inspection Policy
              </button>
            </div>
          </div>
        </div>

        {/* Shipping & Payment Info Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 lg:col-span-3 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          {/* Shipping */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Truck className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>Shipping Address</span>
            </div>
            {order.shippingAddress ? (
              <div className="text-xs text-slate-600 dark:text-slate-400 pl-6 space-y-0.5">
                {order.shippingAddress.label && <p className="font-bold text-slate-800 dark:text-slate-200">{order.shippingAddress.label}</p>}
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress.city}{order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ''}{order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ''}</p>
              </div>
            ) : (
              <div className="text-xs text-slate-400 pl-6 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> No shipping address on file for this order.
              </div>
            )}
          </div>

          {/* Billing */}
          <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-800 lg:border-t-0 lg:pt-0">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CreditCard className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>Billed To</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 pl-6 space-y-0.5">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {user?.businessName || user?.fullName || 'Your account'}
              </p>
              {user?.email && <p>{user.email}</p>}
              <p className="text-slate-400 text-[11px] capitalize">
                Payment status: {paymentStatusLabel.toLowerCase()}
                {order.paymentStatus !== 'paid' && ' — verified payment required before shipment'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default OrderDetailPage
