'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Info, CheckCircle2, Sun, Sunset, AlertCircle } from 'lucide-react'

/**
 * REAL delivery reschedule (audit unit 20). The old page faked everything:
 * a hard-coded order number (WS-992834-A), fake 2023 dates, and a
 * setTimeout "Delivery Rescheduled" screen — nothing was persisted and no
 * seller ever heard about it. Now the page is bound to a REAL order through
 * the ?page=reschedule-delivery&orderId=<id> deep link, shows the order's
 * REAL shipment slices and their estimated dates, lists the buyer's REAL
 * past requests, and submits through POST /api/orders/[id]/reschedule whose
 * 201/409/404 verdicts are surfaced verbatim. The seller's durable
 * notification row is written server-side (the seller side of the circuit).
 */

interface OrderSlice {
  id: string
  status: string
  estimatedDelivery: string | null
  supplierName: string | null
}

interface OrderView {
  id: string
  orderNumber: string
  paymentStatus: string
  placedAt: string
  subOrders: OrderSlice[]
}

interface RescheduleRow {
  id: string
  requestedDate: string
  window: string
  instructions: string | null
  status: string
  createdAt: string
}

const FINAL_SLICE = ['delivered', 'cancelled', 'returned']

/** The API returns full ISO timestamps; the date input yields YYYY-MM-DD.
 *  Render both through the same honest formatter (no `T00:00:00` gluing —
 *  that produced "Invalid Date" when the value was already ISO). */
const fmtISODate = (iso: string, opts?: Intl.DateTimeFormatOptions) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'long', year: 'numeric' })
}

export function RescheduleDeliveryPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = typeof pageParams.orderId === 'string' ? pageParams.orderId : ''

  const [order, setOrder] = useState<OrderView | null>(null)
  const [requests, setRequests] = useState<RescheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedWindow, setSelectedWindow] = useState<'morning' | 'afternoon'>('morning')
  const [instructions, setInstructions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState<{ date: string; window: string } | null>(null)

  const minDate = useMemo(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000)
    return d.toISOString().slice(0, 10)
  }, [])

  const load = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const [orderRes, reqRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`, { credentials: 'include' }),
        fetch(`/api/orders/${orderId}/reschedule`, { credentials: 'include' }),
      ])
      if (orderRes.status === 401 || reqRes.status === 401) {
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      const orderJson = await orderRes.json().catch(() => null)
      if (orderRes.ok && orderJson?.success && orderJson?.data) {
        const d = orderJson.data
        setOrder({
          id: d.id,
          orderNumber: d.orderNumber,
          paymentStatus: d.paymentStatus,
          placedAt: d.placedAt,
          subOrders: (d.subOrders ?? []).map((so: {
            id: string; status?: string; estimatedDelivery?: string | null; supplierName?: string | null
          }) => ({
            id: so.id,
            status: typeof so.status === 'string' ? so.status : 'pending',
            estimatedDelivery: typeof so.estimatedDelivery === 'string' ? so.estimatedDelivery : null,
            supplierName: typeof so.supplierName === 'string' ? so.supplierName : null,
          })),
        })
      } else {
        setLoadError(orderJson?.error || `Could not load this order (HTTP ${orderRes.status}).`)
      }
      if (reqRes.ok) {
        const reqJson = await reqRes.json().catch(() => null)
        if (reqJson?.success && Array.isArray(reqJson.data)) setRequests(reqJson.data)
      }
    } catch {
      setLoadError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  const pendingRequest = requests.find((r) => r.status === 'pending')

  const allFinal = Boolean(order && order.subOrders.length > 0 && order.subOrders.every((s) => FINAL_SLICE.includes(s.status)))

  const handleSubmit = async () => {
    if (!orderId || submitting) return
    if (!selectedDate) {
      toast.error('Pick a date first', { description: 'The delivery cannot move without a target day.' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestedDate: selectedDate, window: selectedWindow, instructions: instructions.trim() || undefined }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success('Reschedule request sent', { description: 'The supplier sees it now.' })
        setConfirmed({ date: selectedDate, window: selectedWindow })
      } else if (res.status === 401) {
        setNeedsAuth(true)
      } else {
        toast.message('Not sent', { description: json?.error || `The server refused (HTTP ${res.status}).` })
      }
    } catch {
      toast.error('Network error — the request was NOT sent. Please retry.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── No order id: the honest gate (the old page invented WS-992834-A) ── */
  if (!orderId) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Open this from an order</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs leading-relaxed">
          A reschedule is always tied to a real order. Open one of your orders and tap
          &ldquo;Reschedule delivery&rdquo; there.
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
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs">Reschedule requests are tied to your buyer account.</p>
        <Button onClick={() => navigate('login')} className="mt-5 w-full max-w-xs bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl">
          Sign in
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-100">
        <PageLoader className="min-h-0" />
      </div>
    )
  }

  if (loadError || !order) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
        <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Order not found</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs">{loadError || 'This order does not exist or belongs to another account.'}</p>
        <Button variant="outline" onClick={() => navigate('my-orders')} className="mt-5 w-full max-w-xs font-bold text-xs h-11 rounded-2xl">
          Go to my orders
        </Button>
      </div>
    )
  }

  /* ── Confirmed screen: REAL order + REAL chosen values only ── */
  if (confirmed) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <div className="w-16 h-16 bg-rose-50 text-primary rounded-full flex items-center justify-center mb-4 border border-rose-100 shadow-md">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Reschedule request sent</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs leading-relaxed">
          Order <span className="font-mono font-bold">{order.orderNumber}</span> — the supplier has been asked to move
          delivery to <strong>{new Date(`${confirmed.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          {' '}({confirmed.window === 'morning' ? '8:00 AM – 12:00 PM' : '12:00 PM – 4:00 PM'}).
          The request is pending until the supplier responds.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('order-detail', { orderId: order.id })}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            View order
          </Button>
          <Button
            variant="outline"
            onClick={() => { setConfirmed(null); load() }}
            className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold h-11 rounded-2xl text-xs"
          >
            Back to request details
          </Button>
        </div>
      </div>
    )
  }

  const fmtDay = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Not scheduled yet'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Reschedule Delivery</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{order.orderNumber}</p>
          </div>

          {/* Real current schedule — one row per shipment slice */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">
            <Info className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed space-y-1">
              {order.subOrders.map((s) => (
                <p key={s.id}>
                  {s.supplierName ? `${s.supplierName}: ` : 'Shipment: '}
                  <strong>{fmtDay(s.estimatedDelivery)}</strong>
                  {' '}· status {s.status}
                </p>
              ))}
              {order.subOrders.length === 0 && <p>No shipment slices on this order.</p>}
            </div>
          </div>

          {/* Pending request notice */}
          {pendingRequest && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
              A reschedule request is already <strong>pending</strong> for{' '}
              <strong>{fmtISODate(pendingRequest.requestedDate)}</strong>{' '}
              ({pendingRequest.window === 'morning' ? 'morning' : 'afternoon'}). The seller sees it now — a second
              request for the same order would be ambiguous, so submit is blocked until it is answered.
            </div>
          )}

          {allFinal && (
            <div className="p-3.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
              Every shipment on this order is already delivered/closed — there is no delivery left to reschedule.
            </div>
          )}

          {/* Date picker */}
          <div className="space-y-2">
            <label htmlFor="reschedule-date" className="text-xs font-bold text-slate-900 dark:text-slate-100 block">New delivery date</label>
            <input
              id="reschedule-date"
              type="date"
              min={minDate}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={Boolean(pendingRequest) || allFinal || submitting}
              className="w-full h-11 px-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Tomorrow onward — the delivery cannot move into the past.</p>
          </div>

          {/* Window */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Preferred window</span>
            <div className="grid grid-cols-2 gap-2">
              {([['morning', '8:00 AM – 12:00 PM', Sun], ['afternoon', '12:00 PM – 4:00 PM', Sunset]] as const).map(
                ([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={Boolean(pendingRequest) || allFinal || submitting}
                    onClick={() => setSelectedWindow(value)}
                    className={`h-16 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 ${
                      selectedWindow === value
                        ? 'border-primary bg-rose-50 text-primary'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-bold">{label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <label htmlFor="reschedule-instructions" className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Note for the supplier <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400 font-normal">(optional)</span>
            </label>
            <Textarea
              id="reschedule-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
              placeholder="e.g. Deliver before Friday prayer; call the gate number at arrival."
              rows={3}
              disabled={Boolean(pendingRequest) || allFinal || submitting}
              className="rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 text-right">{instructions.length}/500</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={goBack}
            className="flex-1 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold h-11 rounded-2xl text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || Boolean(pendingRequest) || allFinal}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send Reschedule Request'}
          </Button>
        </div>

        {/* The buyer's real request history for this order */}
        {requests.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">Your requests for this order</h2>
            <ul className="space-y-2">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <span>
                    {fmtISODate(r.requestedDate)} ·{' '}
                    {r.window === 'morning' ? 'morning' : 'afternoon'}
                    {r.instructions ? <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400"> — {r.instructions.slice(0, 60)}</span> : null}
                  </span>
                  <span className={`font-bold uppercase tracking-wide ${
                    r.status === 'pending' ? 'text-amber-600' :
                    r.status === 'applied' ? 'text-emerald-600' :
                    r.status === 'rejected' ? 'text-red-600' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}

export default RescheduleDeliveryPage
import { PageLoader } from '@/components/ui/page-loader'
