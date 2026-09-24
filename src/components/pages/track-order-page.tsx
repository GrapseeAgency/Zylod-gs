'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Truck, Package, Check, Copy,
  CheckCircle2, PackageSearch, AlertCircle, LogIn, XCircle
} from 'lucide-react'

/**
 * REAL order tracking — no fake carriers, no invented tracking events,
 * no fake ETAs, no fake "live" route map.
 * Data comes exclusively from GET /api/orders/[id] (credentials: 'include').
 * - Loading  → skeleton pulse blocks (never fake rows).
 * - 401      → sign-in required state.
 * - 404      → honest "Order not found" state.
 * - Errors   → the real backend error text with a retry action.
 * The decorative "Live Freight Route" SVG was removed: no live GPS feed exists.
 */

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
  estimatedDelivery: string | null
  supplier?: { companyName?: string | null } | null
  tracking?: ApiTrackingEvent[]
}

interface ApiOrder {
  id: string
  orderNumber: string
  paymentStatus?: string
  placedAt?: string
  updatedAt?: string
  subOrders: ApiSubOrder[]
}

/** Real subOrder statuses → 4-step progress stage (Confirmed=1 … Delivered=4). */
const STAGE_BY_STATUS: Record<string, number> = {
  pending: 1,
  confirmed: 1,
  processing: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
  returned: 3,
  cancelled: 1,
}

/** Overall badge, derived only from real subOrder statuses. */
function deriveBadge(subOrders: ApiSubOrder[]): string {
  const statuses = subOrders.map((s) => (s.status || 'pending').toLowerCase())
  if (statuses.length === 0) return 'PROCESSING'
  if (statuses.every((s) => s === 'delivered')) return 'DELIVERED'
  if (statuses.some((s) => s === 'shipped')) return 'IN TRANSIT'
  if (statuses.some((s) => s === 'cancelled')) return 'CANCELLED'
  return 'PROCESSING'
}

/** Furthest stage actually reached by any non-cancelled subOrder. */
function deriveStage(subOrders: ApiSubOrder[]): number {
  const statuses = subOrders
    .filter((s) => (s.status || '').toLowerCase() !== 'cancelled')
    .map((s) => (s.status || 'pending').toLowerCase())
  if (statuses.length === 0) return 1
  return statuses.reduce((max, s) => Math.max(max, STAGE_BY_STATUS[s] ?? 1), 1)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '--'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '--'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const PROGRESS_STEPS = [
  { label: 'Confirmed', icon: Check },
  { label: 'Packed', icon: Package },
  { label: 'Transit', icon: Truck },
  { label: 'Delivered', icon: CheckCircle2 },
] as const

export function TrackOrderPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [loading, setLoading] = useState(!!orderId)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  const handleCopy = (id: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopiedId(id)
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000)
  }

  // ─── No order selected — honest state, no fake fallback id ───
  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <PackageSearch className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">No order selected</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
          Open one of your orders and choose the tracking action there — this screen
          tracks a specific order.
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

  // ─── Real derivations from the API payload only ───
  const subOrders = order ? (Array.isArray(order.subOrders) ? order.subOrders : []) : []
  const statuses = subOrders.map((s) => (s.status || 'pending').toLowerCase())
  const allDelivered = statuses.length > 0 && statuses.every((s) => s === 'delivered')
  const overallBadge = deriveBadge(subOrders)
  const stage = deriveStage(subOrders)

  const BadgeIcon =
    overallBadge === 'DELIVERED' ? CheckCircle2 : overallBadge === 'IN TRANSIT' ? Truck : overallBadge === 'CANCELLED' ? XCircle : Package
  const badgeClass =
    overallBadge === 'DELIVERED'
      ? 'bg-emerald-600'
      : overallBadge === 'CANCELLED'
        ? 'bg-red-500'
        : overallBadge === 'PROCESSING'
          ? 'bg-slate-800 dark:bg-slate-600'
          : 'bg-primary'

  const etaCandidates = subOrders
    .map((s) => s.estimatedDelivery)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((iso) => ({ iso, t: new Date(iso).getTime() }))
    .filter((c) => !Number.isNaN(c.t))
    .sort((a, b) => a.t - b.t)
  const estimatedDelivery = etaCandidates.length > 0 ? formatDate(etaCandidates[0].iso) : null

  const trackingEvents = subOrders
    .flatMap((so) =>
      (Array.isArray(so.tracking) ? so.tracking : []).map((t) => ({
        ...t,
        supplierName: so.supplier?.companyName || null,
      }))
    )
    .sort((a, b) => new Date(b.trackedAt).getTime() - new Date(a.trackedAt).getTime())

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Track Order</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Track Order</h1>

      {/* Neutral header band — no fake live map, no live-tracking claim */}
      <div className="bg-slate-900 dark:bg-slate-800">
        <div className="max-w-lg mx-auto px-4 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Shipment Tracking</h2>
            <p className="text-[11px] text-slate-300">Status updates from your suppliers</p>
          </div>
        </div>
      </div>

      <main className="px-4 -mt-8 relative z-20 space-y-4 max-w-lg mx-auto">
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

        {/* Loading skeleton — pulse blocks only, never fake rows */}
        {loading && !error && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-lg space-y-5" aria-busy="true" aria-live="polite">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
              </div>
              <div className="h-9 w-44 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse mx-auto" />
              <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
              <div className="h-16 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4" aria-hidden="true">
              <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              {[0, 1].map((i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Real data */}
        {!loading && !error && !needsAuth && !notFound && order && (
          <>
            {/* Status Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-lg space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Order Number
                  </span>
                  <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    #{order.orderNumber || '--'}
                  </h2>
                </div>
                <span className={`${badgeClass} text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1`}>
                  <BadgeIcon className="h-3 w-3" />
                  {overallBadge}
                </span>
              </div>

              {/* Estimated Delivery — only a real supplier-set date */}
              <div className="text-center py-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Estimated Delivery</span>
                {estimatedDelivery ? (
                  <div className="text-xl font-black text-primary mt-0.5 tracking-tight">
                    {estimatedDelivery}
                  </div>
                ) : (
                  <div className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-1">
                    To be scheduled by the supplier
                  </div>
                )}
              </div>

              {/* 4-Step Progress — derived only from real subOrder statuses */}
              <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {PROGRESS_STEPS.map((step, idx) => {
                  const position = idx + 1
                  const completed = allDelivered || position < stage
                  const active = !allDelivered && position === stage
                  const StepIcon = step.icon
                  return (
                    <React.Fragment key={step.label}>
                      {idx > 0 && (
                        <div className={`flex-1 h-0.5 mx-1 ${allDelivered || position <= stage ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      )}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                            completed
                              ? 'bg-primary text-white shadow-xs'
                              : active
                                ? 'border-2 border-primary bg-white dark:bg-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {completed ? (
                            <Check className="h-4 w-4" />
                          ) : active ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-primary" />
                          ) : (
                            <StepIcon className="h-4 w-4" />
                          )}
                        </div>
                        <span
                          className={`text-[10px] mt-1 ${
                            completed || active
                              ? 'font-black text-primary'
                              : 'font-bold text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>

              {/* Per-shipment tracking — real numbers only */}
              <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                {subOrders.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-1">No shipments recorded for this order.</p>
                )}
                {subOrders.map((so, idx) => (
                  <div
                    key={so.id}
                    className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-primary flex items-center justify-center border border-rose-100 dark:border-rose-900 shrink-0">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {so.supplier?.companyName || '--'}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Shipment {idx + 1} of {subOrders.length}
                          </p>
                        </div>
                      </div>
                      <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0">
                        {(so.status || 'pending').toUpperCase()}
                      </span>
                    </div>

                    {so.trackingNumber ? (
                      <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          Tracking: {so.trackingNumber}
                        </p>
                        <button
                          onClick={() => handleCopy(so.id, so.trackingNumber as string)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg shrink-0"
                          title="Copy tracking number"
                        >
                          {copiedId === so.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                        No tracking number assigned yet
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tracking History — only real events from the API */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-slate-900 dark:text-slate-100">
                  Tracking History{trackingEvents.length > 0 ? ` (${trackingEvents.length})` : ''}
                </h2>
                <button
                  onClick={() => navigate('order-timeline', { orderId })}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  View Full Timeline →
                </button>
              </div>

              {trackingEvents.length === 0 ? (
                <div className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Truck className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">No tracking updates yet</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Updates appear here once the supplier ships your order.
                  </p>
                </div>
              ) : (
                <div className="space-y-5 pl-2 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                  {trackingEvents.map((event, idx) => {
                    const isLatest = idx === 0
                    return (
                      <div key={event.id} className="relative flex items-start gap-3.5">
                        {/* Node */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 z-10 bg-white dark:bg-slate-900 ${
                            isLatest
                              ? 'border-primary ring-4 ring-rose-100 dark:ring-rose-950'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isLatest && <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto my-auto" />}
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <h3
                            className={`text-xs uppercase tracking-wide ${
                              isLatest
                                ? 'font-black text-slate-900 dark:text-slate-100'
                                : 'font-semibold text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {(event.status || '--').replace(/_/g, ' ')}
                          </h3>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {event.location ? `${event.location} • ` : ''}
                            {formatDateTime(event.trackedAt)}
                          </p>
                          {event.note && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              {event.note}
                            </p>
                          )}
                          {event.supplierName && (
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
                              {event.supplierName}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default TrackOrderPage
