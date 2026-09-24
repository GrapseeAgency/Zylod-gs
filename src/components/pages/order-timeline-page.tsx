'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  AlertTriangle, ArrowLeft, Clock, Headphones, HelpCircle, Home,
  Package, RefreshCw, ShieldCheck, ShoppingCart, Truck, XCircle
} from 'lucide-react'

// ── Real API types (GET /api/orders/[id]) ──────────────────────────────
interface ApiTracking {
  id: string
  status: string
  location: string | null
  note: string | null
  trackedAt: string
}
interface ApiSubOrder {
  id: string
  supplier: { companyName: string }
  status: string
  trackingNumber: string | null
  estimatedDelivery: string | null
  tracking: ApiTracking[]
}
interface ApiPayment {
  id: string
  method: string
  amount: number
  status: string
  transactionId: string | null
  paidAt: string | null
}
interface ApiOrderDetail {
  id: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string
  placedAt: string
  payments: ApiPayment[]
  subOrders: ApiSubOrder[]
}

type IconComponent = React.ComponentType<{ className?: string }>

interface TimelineEvent {
  id: string
  title: string
  description: string
  meta: string | null
  ts: number | null
  icon: IconComponent
}

function capitalizeWord(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Parse an ISO timestamp into epoch ms; null when absent/unparseable (never invented). */
function toTs(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

/** Overall status badge derived ONLY from real sub-order statuses. */
function deriveBadge(subOrders: ApiSubOrder[]): 'DELIVERED' | 'IN TRANSIT' | 'CANCELLED' | 'PROCESSING' {
  const statuses = subOrders.map((s) => (s.status || 'pending').toLowerCase())
  if (statuses.length === 0) return 'PROCESSING'
  if (statuses.every((s) => s === 'delivered')) return 'DELIVERED'
  if (statuses.some((s) => s === 'shipped')) return 'IN TRANSIT'
  if (statuses.some((s) => s === 'cancelled')) return 'CANCELLED'
  return 'PROCESSING'
}

/** Icon for a real tracking event, chosen from its real status text. */
function trackingIcon(status: string): IconComponent {
  const s = (status || '').toLowerCase()
  if (s.includes('deliver')) return Home
  if (s.includes('ship') || s.includes('transit') || s.includes('dispatch') || s.includes('depart')) return Truck
  return Package
}

function formatEventTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatEventDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDeliveryDate(iso: string): string {
  const ts = toTs(iso)
  return ts !== null ? formatEventDate(ts) : iso
}

/** Build the timeline exclusively from real API data: order placed + real payments + real tracking. */
function buildTimelineEvents(order: ApiOrderDetail, formatPrice: (value: number) => string): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Order placed — real orderNumber + placedAt
  events.push({
    id: `placed-${order.id}`,
    title: 'Order placed',
    description: `Order #${order.orderNumber || '--'} was placed.`,
    meta: `Payment status: ${(order.paymentStatus || 'unpaid').toUpperCase()}`,
    ts: toTs(order.placedAt),
    icon: ShoppingCart,
  })

  // Payments — only real payment records, labelled by their real status
  if (!order.payments || order.payments.length === 0) {
    events.push({
      id: 'payment-pending',
      title: 'Payment pending',
      description: 'No payment recorded yet — orders remain UNPAID until verified payment.',
      meta: `Order payment status: ${(order.paymentStatus || 'unpaid').toUpperCase()}`,
      ts: null,
      icon: Clock,
    })
  } else {
    for (const p of order.payments) {
      events.push({
        id: `payment-${p.id}`,
        title: `Payment ${capitalizeWord(p.status || 'unknown')}`,
        description: `Method: ${p.method || '--'} • Amount: ${formatPrice(p.amount)}`,
        meta: p.transactionId ? `Transaction: ${p.transactionId}` : 'No transaction ID recorded',
        ts: toTs(p.paidAt),
        icon: ShieldCheck,
      })
    }
  }

  // Shipments — real tracking events per sub-order, with real supplier + tracking number
  for (const so of order.subOrders || []) {
    const supplierName = so.supplier?.companyName || '--'
    const shipmentMeta = so.trackingNumber
      ? `Supplier: ${supplierName} — Tracking: ${so.trackingNumber}`
      : `Supplier: ${supplierName} — No tracking number assigned yet`

    const trackingRows = so.tracking || []
    if (trackingRows.length === 0) {
      // Real sub-order with no tracking history yet — honest placeholder, real status
      events.push({
        id: `shipment-${so.id}`,
        title: `Shipment ${capitalizeWord(so.status || 'pending')}`,
        description: 'No tracking updates recorded yet for this shipment.',
        meta: shipmentMeta,
        ts: null,
        icon: Package,
      })
      continue
    }
    for (const t of trackingRows) {
      const details = [t.location, t.note].filter(Boolean).join(' • ')
      events.push({
        id: `tracking-${t.id}`,
        title: capitalizeWord(t.status || 'update'),
        description: details.length > 0 ? details : 'No location or note recorded for this update.',
        meta: shipmentMeta,
        ts: toTs(t.trackedAt),
        icon: trackingIcon(t.status),
      })
    }
  }

  // Merge + sort by real timestamp, newest first; events without a timestamp go last
  return [...events].sort((a, b) => {
    const ta = a.ts ?? Number.NEGATIVE_INFINITY
    const tb = b.ts ?? Number.NEGATIVE_INFINITY
    if (ta === tb) return 0
    return tb - ta
  })
}

export function OrderTimelinePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
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
        // 403 and other real backend errors: surface the real error text
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
          <Package className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">No order selected</h1>
          <p className="text-xs text-slate-500">Pick an order from your order history to see its timeline.</p>
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
          <p className="text-xs text-slate-500">You need to be signed in to view this order timeline.</p>
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
        <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-6 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-52 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="space-y-6 pt-2 pl-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0" />
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="h-3.5 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // order is non-null here (all other paths returned above)
  if (!order) return null

  // ── Real derived values ───────────────────────────────────────────────
  const badge = deriveBadge(order.subOrders)
  const estDelivery = order.subOrders
    .map((so) => so.estimatedDelivery)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort()[0] || null
  const shipmentCount = order.subOrders.length
  const supplierCount = new Set(order.subOrders.map((so) => so.supplier?.companyName || '--')).size
  const timelineEvents = buildTimelineEvents(order, formatPrice)

  const badgeClasses: Record<typeof badge, string> = {
    'DELIVERED': 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
    'IN TRANSIT': 'bg-rose-50 text-primary border-rose-100 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-900',
    'CANCELLED': 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
    'PROCESSING': 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5 text-primary" />
            </button>
            <h1 className="text-base font-bold text-primary truncate max-w-[200px]">Order #{order.orderNumber || '--'}</h1>
          </div>
          <button onClick={() => navigate('help-center')} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Help">
            <HelpCircle className="h-5 w-5 text-primary" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Expected Delivery Card (real data only — no carrier invention) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Expected Delivery</span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeClasses[badge]}`}>
              {badge}
            </span>
          </div>

          <div className="text-lg font-black text-primary">
            {estDelivery ? formatDeliveryDate(estDelivery) : 'To be scheduled by the supplier'}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            <Truck className="h-4 w-4 text-slate-400" />
            <span>
              {shipmentCount > 0
                ? `${shipmentCount} shipment${shipmentCount === 1 ? '' : 's'} from ${supplierCount} supplier${supplierCount === 1 ? '' : 's'} — tracking details below`
                : 'No shipments recorded for this order yet'}
            </span>
          </div>
        </div>

        {/* Timeline Events List (built only from real placedAt / payments / tracking data) */}
        <div className="space-y-6 pt-2 pl-2 relative before:absolute before:left-7 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {timelineEvents.map((event, index) => {
            const Icon = event.icon

            return (
              <div key={event.id} className="relative flex items-start gap-4">
                {/* Icon Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    index === 0
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-slate-700 dark:text-slate-300 border border-rose-100 dark:border-rose-900/60'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* Event Details Card */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">{event.title}</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0">
                      {event.ts !== null ? formatEventTime(event.ts) : '--'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{event.description}</p>
                  {event.meta && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium break-words">{event.meta}</p>
                  )}
                  <p className="text-[10px] text-slate-400 font-medium pt-1">
                    {event.ts !== null ? formatEventDate(event.ts) : 'No timestamp recorded'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Contact Support CTA */}
        <div className="pt-4">
          <Button
            variant="outline"
            onClick={() => navigate('help-center')}
            className="w-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Headphones className="h-4 w-4" />
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  )
}

export default OrderTimelinePage
