'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Factory, Ship, Satellite, Bell, FileText, RefreshCw, AlertCircle, Package, Boxes, CheckCircle2, Clock,
} from 'lucide-react'

/**
 * REAL import/export tracker (audit unit 21). The old page was theater: a
 * fake PO number (PO-2023-8942A), a fabricated Shenzhen→Dhaka journey with
 * an invented vessel ("EVER GIVEN V.042E"), a fake 65% progress bar, and a
 * decorative Updates toggle. Now it is bound to a REAL order through the
 * ?page=import-export-tracker&orderId=<id> deep link: the journey is the
 * order's REAL tracking events (chronological across all shipment slices),
 * the manifest is the REAL line items, and every status chip comes from a
 * real slice. Without an order id: an honest gate, never an invented PO.
 */

interface TrackingRow {
  id: string
  status: string
  location: string | null
  note: string | null
  trackedAt: string
}

interface ItemRow {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: { name: string; unit?: string | null } | null
}

interface Slice {
  id: string
  status: string
  supplierName: string | null
  estimatedDelivery: string | null
  items: ItemRow[]
  tracking: TrackingRow[]
}

interface OrderView {
  id: string
  orderNumber: string
  paymentStatus: string
  totalAmount: number
  placedAt: string
  subOrders: Slice[]
}

const STEP_ORDER = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'] as const

export function ImportExportTrackerPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = typeof pageParams.orderId === 'string' ? pageParams.orderId : ''

  const [order, setOrder] = useState<OrderView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' })
      if (res.status === 401) {
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && json?.data) {
        const d = json.data
        setOrder({
          id: d.id,
          orderNumber: d.orderNumber,
          paymentStatus: d.paymentStatus,
          totalAmount: typeof d.totalAmount === 'number' ? d.totalAmount : 0,
          placedAt: d.placedAt,
          subOrders: (d.subOrders ?? []).map((so: {
            id: string
            status?: string
            supplier?: { companyName?: string } | null
            estimatedDelivery?: string | null
            items?: ItemRow[]
            tracking?: TrackingRow[]
          }) => ({
            id: so.id,
            status: typeof so.status === 'string' ? so.status : 'pending',
            supplierName: so.supplier?.companyName ?? null,
            estimatedDelivery: typeof so.estimatedDelivery === 'string' ? so.estimatedDelivery : null,
            items: (so.items ?? []).map((it) => ({
              id: it.id,
              quantity: typeof it.quantity === 'number' ? it.quantity : 0,
              unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : 0,
              totalPrice: typeof it.totalPrice === 'number' ? it.totalPrice : 0,
              product: it.product ?? null,
            })),
            tracking: (so.tracking ?? []).map((t) => ({
              id: t.id,
              status: t.status,
              location: t.location,
              note: t.note,
              trackedAt: t.trackedAt,
            })),
          })),
        })
      } else {
        setError(json?.error || `Could not load this order (HTTP ${res.status}).`)
      }
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  if (!orderId) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Open this from an order</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs leading-relaxed">
          An import/export journey is always a real order&apos;s journey. Open one of your orders to follow it.
        </p>
        <Button onClick={() => navigate('my-orders')} className="mt-5 w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl">
          Go to my orders
        </Button>
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Sign in required</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs">Import tracking is visible to the order&apos;s buyer.</p>
        <Button onClick={() => navigate('login')} className="mt-5 w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl">
          Sign in
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-slate-900 dark:text-slate-100">
        <PageLoader className="min-h-0" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Order not found</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs">{error || 'This order does not exist or is not visible to your account.'}</p>
        <Button variant="outline" onClick={() => navigate('my-orders')} className="mt-5 w-full max-w-xs font-bold text-xs h-11 rounded-2xl">
          Go to my orders
        </Button>
      </div>
    )
  }

  // Real journey: every tracking event across every slice, oldest first.
  const journey: Array<TrackingRow & { supplier: string | null }> = order.subOrders
    .flatMap((s) => s.tracking.map((t) => ({ ...t, supplier: s.supplierName })))
    .sort((a, b) => new Date(a.trackedAt).getTime() - new Date(b.trackedAt).getTime())

  // Real stepper position: the furthest step ANY slice has reached.
  const furthest = order.subOrders.reduce((acc, s) => {
    const idx = STEP_ORDER.indexOf(s.status as (typeof STEP_ORDER)[number])
    return Math.max(acc, idx === -1 ? 0 : idx)
  }, 0)
  const allFinal = order.subOrders.length > 0 && order.subOrders.every((s) => ['delivered', 'cancelled', 'returned'].includes(s.status))
  const totalItems = order.subOrders.reduce((n, s) => n + s.items.length, 0)

  const stepIcon = (idx: number) => (idx <= 1 ? Factory : idx <= 3 ? Ship : CheckCircle2)

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-5 max-w-lg mx-auto md:max-w-4xl">
        {/* Real PO header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">{order.orderNumber}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              Placed {new Date(order.placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ·
              {' '}{totalItems} line item{totalItems !== 1 ? 's' : ''} · {formatPrice(order.totalAmount)}
            </p>
          </div>
          <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${
            allFinal ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {allFinal ? 'Closed' : 'In progress'}
          </span>
        </div>

        {/* Real stage stepper — no fake percentages */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="grid grid-cols-5 gap-1 text-center">
            {STEP_ORDER.map((step, idx) => {
              const Icon = stepIcon(idx)
              const reached = idx <= furthest
              const current = idx === furthest && !allFinal
              return (
                <div key={step} className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${
                    current ? 'bg-white dark:bg-gray-900 border-2 border-primary text-primary' :
                    reached ? 'bg-primary text-white border-primary' :
                    'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
                  }`}>
                    {current ? <Satellite className="h-4 w-4 animate-pulse" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-[9px] font-bold capitalize leading-tight ${reached ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
          {allFinal && (
            <p className="text-[11px] text-emerald-700 font-bold mt-3 text-center">
              Every shipment on this order is delivered/closed.
            </p>
          )}
        </div>

        {/* Real journey events */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-xs">
            <Clock className="h-4 w-4 text-primary" />
            <span>Journey — real tracking events ({journey.length})</span>
          </div>
          {journey.length === 0 ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-start gap-2">
              <Package className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
              No tracking events yet — the factory dispatch row appears when the supplier marks the first transition. There is no fabricated vessel or route here.
            </div>
          ) : (
            <ol className="space-y-3">
              {journey.map((t) => (
                <li key={t.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-50 text-primary flex items-center justify-center shrink-0 border border-rose-100">
                    <Ship className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 capitalize">{t.status}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {t.supplier ? `${t.supplier} · ` : ''}
                      {t.location ? `${t.location} · ` : ''}
                      {new Date(t.trackedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {t.note && <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 mt-0.5">{t.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Real manifest */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-xs">
            <FileText className="h-4 w-4 text-primary" />
            <span>Manifest — real line items</span>
          </div>
          <div className="space-y-2">
            {order.subOrders.flatMap((s) =>
              s.items.map((it) => (
                <div key={it.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{it.product?.name ?? 'Item'}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold">
                      {s.supplierName ?? 'Supplier'} · qty {it.quantity}{it.product?.unit ? ` ${it.product.unit}` : ''} × {formatPrice(it.unitPrice)}
                    </p>
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 font-mono shrink-0">{formatPrice(it.totalPrice)}</span>
                </div>
              ))
            )}
            {totalItems === 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">No line items recorded on this order.</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('freight-tracking', { orderId: order.id })}
            className="flex-1 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 font-bold h-11 rounded-2xl text-xs"
          >
            <Boxes className="h-4 w-4 mr-2" /> Per-shipment view
          </Button>
          <Button
            onClick={() => navigate('order-detail', { orderId: order.id })}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md"
          >
            Full order
          </Button>
        </div>
      </main>
    </div>
  )
}

export default ImportExportTrackerPage
import { PageLoader } from '@/components/ui/page-loader'
