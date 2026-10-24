'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, AlertTriangle, Clock, MapPin, Calendar, LogIn, Search,
  Loader2, MessageSquare, CheckCircle2, ArrowRight,
} from 'lucide-react'

/**
 * REAL missed-delivery resolution — replaces the fabricated "AWB-9876543210"
 * + Unsplash photo + setTimeout "rescheduled" theater.
 *
 * Source of truth:
 *   - GET /api/orders/[id] — the real order (slices, statuses, addresses)
 *   - GET /api/orders/[id]/reschedule — existing pending requests
 *   - POST /api/orders/[id]/reschedule — the real reschedule request rail
 *     (Task 162: buyer-only, ownership, final-state 409, one-pending-per-order,
 *     audit + seller notification)
 *
 * pageParams.orderId is required. Without it: an honest "open an order" prompt.
 */

interface ApiSubOrder {
  id: string
  status: string
  estimatedDelivery?: string | null
  supplier?: { companyName?: string | null } | null
}
interface ApiOrder {
  id: string
  orderNumber: string
  status?: string
  shippingAddress?: {
    recipientName?: string | null
    phone?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    city?: string | null
    district?: string | null
  } | null
  subOrders?: ApiSubOrder[]
}
interface ApiReschedule {
  id: string
  requestedDate: string
  status: string
  note?: string | null
  createdAt: string
}

type Phase = 'loading' | 'anon' | 'notfound' | 'error' | 'ready' | 'submitted'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export function MissedDeliveryPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { toast } = useToast()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || pageParams.id || ''

  const [phase, setPhase] = useState<Phase>('loading')
  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [existing, setExisting] = useState<ApiReschedule[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // form
  const [reqDate, setReqDate] = useState('')
  const [window, setWindow] = useState<'morning' | 'afternoon'>('afternoon')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = React.useCallback(async () => {
    if (!orderId) { setPhase('notfound'); return }
    setPhase('loading')
    try {
      const [ordRes, reRes] = await Promise.all([
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, { credentials: 'include' }),
        fetch(`/api/orders/${encodeURIComponent(orderId)}/reschedule`, { credentials: 'include' }),
      ])
      if (ordRes.status === 401) { setPhase('anon'); return }
      const ordJson = await ordRes.json().catch(() => null)
      if (ordRes.status === 404) { setPhase('notfound'); return }
      if (!ordRes.ok) { setPhase('error'); setErrorMsg(ordJson?.error || `HTTP ${ordRes.status}`); return }
      const reJson = reRes.ok ? await reRes.json().catch(() => null) : null
      setOrder(ordJson?.data ?? ordJson?.order ?? null)
      setExisting(reJson?.data ?? [])
      setPhase('ready')
    } catch {
      setPhase('error'); setErrorMsg('Network error — check your connection and retry.')
    }
  }, [orderId])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqDate) {
      toast({ title: 'Pick a date', description: 'Choose a new delivery date.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestedDate: reqDate, // YYYY-MM-DD
          window,
          instructions: note.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast({
          title: `Request failed (${res.status})`,
          description: json?.error || 'The reschedule request was not submitted.',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Reschedule requested',
        description: "The seller has been notified. You'll hear back before the new window.",
      })
      setPhase('submitted')
      load()
    } finally {
      setSubmitting(false)
    }
  }

  // ── no-order gate ──
  if (!orderId) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <Search className="h-6 w-6 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">No order selected</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              Open an order from your order history to request a delivery reschedule.
            </p>
            <Button onClick={() => navigate('orders-history')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <ArrowRight className="h-4 w-4" /> Go to orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'anon') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <LogIn className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sign in required</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Only the order's buyer can request a reschedule.</p>
            <Button onClick={() => navigate('login')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'notfound') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              <Search className="h-6 w-6 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Order not found</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">This order may have been removed or the link is stale.</p>
            <Button onClick={() => navigate('orders-history')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <ArrowRight className="h-4 w-4" /> Go to orders
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Couldn't load the order</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 break-words">{errorMsg}</p>
            <Button onClick={load} variant="outline" className="text-xs font-bold gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'loading' || !order) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const addr = order.shippingAddress
  const slices = order.subOrders ?? []
  const hasPending = existing.some(r => r.status === 'pending')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-base font-black text-primary">Missed delivery</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 space-y-4 max-w-2xl mx-auto">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Missed delivery</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
            Order <span className="font-mono font-semibold">{order.orderNumber}</span>
          </p>
        </div>

        {/* Alert banner */}
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 flex gap-3.5 items-start">
          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Delivery couldn't be completed</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
              If the courier couldn't reach the destination, request a new delivery window below.
              The seller is notified and will confirm the reschedule.
            </p>
          </div>
        </div>

        {/* Shipping address card */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Shipping address</span>
                {addr ? (
                  <p className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                    {[addr.recipientName, addr.addressLine1, addr.addressLine2, addr.city, addr.district].filter(Boolean).join(', ')}
                    {addr.phone && <span className="block text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">📞 {addr.phone}</span>}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">No address on file.</p>
                )}
              </div>
            </div>
            {slices.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Shipments</span>
                {slices.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      {s.supplier?.companyName || 'Supplier'}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Est. {formatDate(s.estimatedDelivery)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Existing pending request */}
        {hasPending && (
          <Card className="rounded-3xl border-amber-200 bg-amber-50/50 shadow-sm">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-amber-900">A reschedule request is already pending</h3>
                <p className="text-[11px] text-amber-700/80 mt-0.5">
                  You'll hear back before the new window. One pending request per order keeps the
                  seller's queue unambiguous.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submitted confirmation */}
        {phase === 'submitted' && (
          <Card className="rounded-3xl border-emerald-200 bg-emerald-50/50 shadow-sm">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-emerald-900">Request submitted</h3>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">
                  The seller has been notified. Track the shipment or open the delivery chat for live updates.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reschedule form */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Request a new window
              </h3>

              <div className="space-y-2">
                <Label htmlFor="reqDate" className="text-xs font-bold">New delivery date</Label>
                <Input
                  id="reqDate"
                  type="date"
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  value={reqDate}
                  onChange={(e) => setReqDate(e.target.value)}
                  required
                  disabled={submitting || hasPending}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500">Pick a future date (tomorrow or later).</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Delivery window</Label>
                <Select value={window} onValueChange={(v: 'morning' | 'afternoon') => setWindow(v)} disabled={submitting || hasPending}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (9 AM – 12 PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12 PM – 4 PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note" className="text-xs font-bold">Note for the seller (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Gate code 4472, call before arriving…"
                  rows={3}
                  maxLength={500}
                  disabled={submitting || hasPending}
                  className="text-xs resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || hasPending}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                {submitting ? 'Submitting…' : hasPending ? 'Pending request' : 'Request reschedule'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing request history */}
        {existing.length > 0 && (
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Request history</h3>
              <div className="space-y-2">
                {existing.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-xs py-2 border-t border-slate-100 dark:border-slate-800 first:border-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(r.requestedDate)}</p>
                      {r.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 truncate">{r.note}</p>}
                    </div>
                    <span className={
                      'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ' +
                      (r.status === 'pending' ? 'bg-amber-100 text-amber-700'
                      : r.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
                      : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
                    }>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center pt-2">
          <button
            onClick={() => navigate('delivery-chat', { orderId })}
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Contact driver / support</span>
          </button>
        </div>
      </main>
    </div>
  )
}
export default MissedDeliveryPage
