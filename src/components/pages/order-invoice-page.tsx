'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import {
  Printer, Download, CheckCircle2, Clock, AlertTriangle, FileText, RefreshCw, XCircle
} from 'lucide-react'

// ── Real API types (GET /api/orders/[id]) ──────────────────────────────
interface ApiItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: { id: string; name: string; thumbnailUrl: string | null; unit: string | null; slug: string }
  variant: { id: string; variantName: string; variantValue: string } | null
}
interface ApiSubOrder {
  id: string
  supplier: { companyName: string; slug: string; ratingAvg: number; ratingCount: number } | null
  subtotal: number
  shippingCost: number
  status: string
  items: ApiItem[]
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

export function OrderInvoicePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
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
        setError(json?.error || `Failed to load invoice (HTTP ${res.status})`)
        setOrder(null)
        return
      }
      setOrder(json.data as ApiOrderDetail)
    } catch {
      setError('Network error while loading the invoice. Check your connection and retry.')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { loadOrder() }, [loadOrder])

  const handlePrint = () => { window.print() }

  // ── Honest guard states ───────────────────────────────────────────────
  if (!loading && !orderId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">No order selected</h1>
          <p className="text-xs text-slate-500">Open an order from your order history to view its invoice.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-base font-black">Sign in required</h1>
          <p className="text-xs text-slate-500">You need to be signed in to view invoices.</p>
          <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
        </div>
      </div>
    )
  }

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <XCircle className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">Order not found</h1>
          <p className="text-xs text-slate-500">This invoice does not exist or is not visible to your account.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-base font-black">Could not load invoice</h1>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={loadOrder} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100">
        <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 max-w-lg mx-auto md:max-w-2xl">
          <div className="h-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="h-64 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        </main>
      </div>
    )
  }

  if (!order) return null

  // ── Real derived values ───────────────────────────────────────────────
  const subtotal = order.subOrders.reduce((sum, so) => sum + (typeof so.subtotal === 'number' ? so.subtotal : 0), 0)
  const shipping = order.subOrders.reduce((sum, so) => sum + (typeof so.shippingCost === 'number' ? so.shippingCost : 0), 0)
  const allItems = order.subOrders.flatMap((so) => so.items || [])
  const isPaid = order.paymentStatus === 'paid'
  const itemIndex = new Map<string, number>()
  allItems.forEach((it) => {
    if (!itemIndex.has(it.productId)) itemIndex.set(it.productId, itemIndex.size + 1)
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs print:hidden md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back">
              ←
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Top Invoice Actions Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3 print:hidden">
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-black truncate">
              Invoice — Order #{order.orderNumber || '--'}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Issued: {new Date(order.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              onClick={handlePrint}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white flex items-center gap-1.5 shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Save PDF
            </Button>
          </div>
        </div>

        {/* Main Invoice Sheet */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          {/* Document Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-black tracking-wider uppercase">TAX INVOICE</h2>
              <div className="mt-1">
                {isPaid ? (
                  <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900 flex items-center gap-1 inline-flex">
                    <CheckCircle2 className="h-3 w-3" />
                    PAID
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-100 dark:border-amber-900 flex items-center gap-1 inline-flex">
                    <Clock className="h-3 w-3" />
                    {(order.paymentStatus || 'unpaid').toUpperCase()} — PAYMENT PENDING VERIFICATION
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-black text-primary block">Zylod</span>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                B2B Wholesale Marketplace<br />
                Order #{order.orderNumber || '--'}
              </p>
            </div>
          </div>

          {/* BILLED TO / SHIPPED TO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* BILLED TO — real account data only */}
            <div className="bg-slate-50/80 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                BILLED TO
              </span>
              <p className="font-bold">{user?.businessName || user?.fullName || 'Account holder'}</p>
              {user?.email && <p className="text-slate-600 dark:text-slate-400">{user.email}</p>}
              <p className="text-[10px] text-slate-400 pt-1">Buyer of record on this order.</p>
            </div>

            {/* SHIPPED TO — real order shipping address */}
            <div className="bg-slate-50/80 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                SHIPPED TO
              </span>
              {order.shippingAddress ? (
                <>
                  {order.shippingAddress.label && <p className="font-bold">{order.shippingAddress.label}</p>}
                  <p className="text-slate-600 dark:text-slate-400">{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && <p className="text-slate-600 dark:text-slate-400">{order.shippingAddress.addressLine2}</p>}
                  <p className="text-slate-600 dark:text-slate-400">
                    {order.shippingAddress.city}{order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ''}{order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-slate-400">No shipping address on file for this order.</p>
              )}
            </div>
          </div>

          {/* Items Table — real order items */}
          <div className="space-y-2">
            <div className="flex text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="w-8">#</span>
              <span className="flex-1">Item Description</span>
              <span className="w-14 text-right">Qty</span>
              <span className="w-24 text-right">Amount</span>
            </div>

            {allItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No items recorded on this order.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-2">
                {allItems.map((item) => {
                  const num = itemIndex.get(item.productId) ?? 0
                  return (
                    <div key={item.id} className="flex pt-2 text-xs">
                      <span className="w-8 font-bold text-slate-400">{num}</span>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold truncate">{item.product?.name || '--'}</p>
                        <p className="text-[10px] text-slate-400">
                          {item.variant ? `${item.variant.variantName}: ${item.variant.variantValue}` : ''}
                          {item.product?.unit ? `${item.variant ? ' · ' : ''}per ${item.product.unit}` : ''}
                        </p>
                      </div>
                      <span className="w-14 text-right font-semibold">{item.quantity}</span>
                      <span className="w-24 text-right font-bold">{formatPrice(item.totalPrice)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Financial Breakdown — only real totals, no invented VAT/discounts */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping &amp; Handling</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(shipping)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total</span>
              <span className="text-xl font-black text-primary">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>

          {/* Payment info footnote — real payment records only */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 leading-relaxed space-y-2">
            <span className="font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-0.5">Payment Information</span>
            {order.payments.length === 0 ? (
              <p>
                No payment has been recorded for this order yet. Orders remain{' '}
                <span className="font-bold text-amber-600 uppercase">{(order.paymentStatus || 'unpaid')}</span>{' '}
                until payment is submitted and verified. Reference: Order #{order.orderNumber || '--'}.
              </p>
            ) : (
              order.payments.map((p) => (
                <p key={p.id}>
                  {p.method ? p.method.toUpperCase() : 'PAYMENT'} — {formatPrice(p.amount)} — status:{' '}
                  <span className="font-bold uppercase">{p.status || '--'}</span>
                  {p.transactionId ? <> · Ref: {p.transactionId}</> : null}
                  {p.paidAt ? <> · recorded {new Date(p.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</> : null}
                </p>
              ))
            )}
            <p>For any discrepancies regarding this invoice, contact billing@zylod.com within 14 days of receipt. All goods remain the property of the supplier until fully paid.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default OrderInvoicePage
