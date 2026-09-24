'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Download, Camera, PenTool, Package,
  MapPin, CheckCircle2, PackageSearch, AlertCircle, LogIn, Truck
} from 'lucide-react'

/**
 * REAL proof-of-delivery view — no fake POD photos, GPS overlays, signatures,
 * recipients, carriers, weights or "verified/authentic" badges.
 * All evidence comes exclusively from GET /api/orders/[id] (credentials: 'include').
 * - Loading  → skeleton pulse blocks (never fake evidence).
 * - 401      → sign-in required state.
 * - 404      → honest "Order not found" state.
 * - Errors   → the real backend error text with a retry action.
 * The backend stores no POD photo or signature data yet — those sections render
 * honest "not available yet" placeholders instead of fabricated evidence.
 */

interface ApiShippingAddress {
  id: string
  label?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  district?: string | null
  postalCode?: string | null
}

interface ApiTrackingEvent {
  id: string
  status: string
  location: string | null
  note: string | null
  lat: number | null
  lng: number | null
  trackedAt: string
}

interface ApiSubOrder {
  id: string
  status: string
  trackingNumber: string | null
  supplier?: { companyName?: string | null } | null
  items?: Array<{ id: string }>
  tracking?: ApiTrackingEvent[]
}

interface ApiOrder {
  id: string
  orderNumber: string
  paymentStatus?: string
  placedAt?: string
  updatedAt?: string
  shippingAddress: ApiShippingAddress | null
  subOrders: ApiSubOrder[]
}

/** Mirror of the backend's overall-status logic (my-orders route). */
function deriveStatus(subOrders: ApiSubOrder[]): string {
  const statuses = subOrders.map((s) => (s.status || 'pending').toLowerCase())
  if (statuses.length === 0) return 'processing'
  if (statuses.every((s) => s === 'delivered')) return 'delivered'
  if (statuses.some((s) => s === 'cancelled')) return 'cancelled'
  if (statuses.some((s) => s === 'shipped')) return 'shipped'
  return 'processing'
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '--'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function DeliveryProofPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [loading, setLoading] = useState(!!orderId)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    setNotFound(false)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' })
      const json = await res.json().catch(() => null)

      if (res.status === 401) {
        setNeedsAuth(true)
        setError(json?.error || 'Authentication required')
        setOrder(null)
        return
      }
      if (res.status === 404) {
        setNotFound(true)
        setOrder(null)
        return
      }
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

  // window.print() is a real browser capability — kept as the PDF action.
  const handleDownloadPdf = () => {
    window.print()
  }

  // ─── No order selected — honest state, no fake POD id ───
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <PackageSearch className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">No order selected</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
          Open one of your orders and choose the delivery proof action there — this
          screen shows delivery evidence for a specific order.
        </p>
        <Button
          onClick={() => navigate('my-orders')}
          className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md w-full max-w-xs"
        >
          Go to My Orders
        </Button>
      </div>
    )
  }

  const subOrders = order ? (Array.isArray(order.subOrders) ? order.subOrders : []) : []

  /** Real 'delivered' tracking events across all sub-orders, most recent first. */
  const deliveredEvents = subOrders
    .flatMap((so) =>
      (Array.isArray(so.tracking) ? so.tracking : [])
        .filter((t) => (t.status || '').toLowerCase() === 'delivered')
        .map((t) => ({ ...t, supplierName: so.supplier?.companyName || null }))
    )
    .sort((a, b) => new Date(b.trackedAt).getTime() - new Date(a.trackedAt).getTime())

  const overallStatus = deriveStatus(subOrders).toUpperCase()
  const noDeliveries = !!order && deliveredEvents.length === 0

  const address = order?.shippingAddress || null
  const addressLocality = address
    ? [address.city, address.district, address.postalCode].filter((v): v is string => typeof v === 'string' && v.length > 0)
    : []

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center gap-3 md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-5xl">
        {/* Breadcrumb & Title */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            ORDER HISTORY &gt; <span className="text-primary font-mono">{order?.orderNumber ? `#${order.orderNumber}` : orderId}</span>
          </span>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Proof of Delivery</h1>
            {!loading && !error && !needsAuth && !notFound && order && (
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                PDF Report
              </Button>
            )}
          </div>
        </div>

        {/* Sign-in required (401) */}
        {needsAuth && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center">
            <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 text-primary flex items-center justify-center mx-auto mb-3">
              <LogIn className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Sign in required</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{error}</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button
                onClick={() => navigate('login')}
                className="bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 px-5 rounded-2xl"
              >
                Sign In
              </Button>
              <Button
                variant="outline"
                onClick={loadOrder}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-bold text-xs h-10 px-5 rounded-2xl"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Not found (404) */}
        {!needsAuth && notFound && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <PackageSearch className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Order not found</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              This order doesn&apos;t exist or the link you followed is incorrect.
            </p>
            <Button
              onClick={() => navigate('my-orders')}
              className="mt-5 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 px-5 rounded-2xl"
            >
              Go to My Orders
            </Button>
          </div>
        )}

        {/* Real backend / network error */}
        {!needsAuth && !notFound && !!error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex items-start gap-3" role="alert">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-700 dark:text-red-300">{error}</p>
              <Button
                onClick={loadOrder}
                className="mt-2.5 h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Loading skeleton — pulse blocks only, never fake evidence */}
        {loading && !error && (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="h-3.5 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3" aria-hidden="true">
              <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-20 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
            </div>
          </div>
        )}

        {/* Real data */}
        {!loading && !error && !needsAuth && !notFound && order && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
            <div className="space-y-4 md:space-y-6 lg:col-span-2">
              {/* Honest overall state when nothing has been delivered yet */}
              {noDeliveries && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-3xl p-4 flex items-start gap-3">
                  <Truck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-amber-800 dark:text-amber-200">
                      This order has no confirmed deliveries yet
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                      Delivery evidence appears here once a supplier marks your shipment delivered.
                    </p>
                    <span className="inline-block mt-2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                      Current status: {overallStatus}
                    </span>
                  </div>
                </div>
              )}

              {/* Card 1: Proof-of-delivery photo — none exists yet, honest placeholder */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Camera className="h-4 w-4 text-primary" />
                  <span>Proof of Delivery Photo</span>
                </div>
                <div className="aspect-[4/3] rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <Camera className="h-8 w-8 text-slate-400" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    No proof-of-delivery photo available yet
                  </p>
                </div>
              </div>

              {/* Card 2: Recipient signature — none exists yet, honest placeholder */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <PenTool className="h-4 w-4 text-primary" />
                  <span>Recipient Signature</span>
                </div>
                <div className="h-28 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <PenTool className="h-6 w-6 text-slate-400" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Signature capture is not available yet
                  </p>
                </div>
              </div>

              {/* Card 3: Real delivery confirmations from tracking history */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Delivery Confirmations</span>
                  </div>
                  {deliveredEvents.length > 0 && (
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                      {deliveredEvents.length} recorded
                    </span>
                  )}
                </div>

                {deliveredEvents.length === 0 ? (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2">
                    No delivered tracking events recorded for this order yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {deliveredEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {(event.status || '--').replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 text-right shrink-0">
                            {formatDateTime(event.trackedAt)}
                          </span>
                        </div>
                        {event.location && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {event.location}
                          </p>
                        )}
                        {event.note && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{event.note}</p>
                        )}
                        {/* Coordinates shown only when the API actually recorded them */}
                        {event.lat !== null && event.lng !== null && (
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            {event.lat}, {event.lng}
                          </p>
                        )}
                        {event.supplierName && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {event.supplierName}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 md:space-y-6">
              {/* Card 4: Real shipment summary per sub-order */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Package className="h-4 w-4 text-primary" />
                  <span>Shipment Summary</span>
                </div>

                {subOrders.length === 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
                    No shipments recorded for this order.
                  </p>
                )}

                <div className="space-y-2.5">
                  {subOrders.map((so) => {
                    const itemCount = Array.isArray(so.items) ? so.items.length : 0
                    return (
                      <div
                        key={so.id}
                        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {so.supplier?.companyName || '--'}
                          </h3>
                          <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0">
                            {(so.status || 'pending').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] gap-2">
                          <span className="text-slate-500 dark:text-slate-400">Tracking</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {so.trackingNumber || 'not assigned'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">Items</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {itemCount} item{itemCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Card 5: Real ship-to address */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Ship To</span>
                </div>

                {address ? (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed space-y-0.5">
                    {address.label && (
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {address.label}
                      </p>
                    )}
                    {address.addressLine1 && <p>{address.addressLine1}</p>}
                    {address.addressLine2 && <p>{address.addressLine2}</p>}
                    {addressLocality.length > 0 && <p>{addressLocality.join(', ')}</p>}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                    No shipping address on file
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default DeliveryProofPage
