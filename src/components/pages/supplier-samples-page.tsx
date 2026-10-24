'use client'

/**
 * SupplierSamplesPage — the seller side of the sample rail (Task 90):
 * incoming sample requests for THIS supplier's products, with the real
 * state machine actions (ship with an optional declared value; cancel while
 * unshipped), the buyer's real display name, and the immutable creation-time
 * address snapshot. The seller console joins its token-gated seller:<id>
 * room — a new request lands a 'sample:new' tap that refreshes the queue
 * live; otherwise the 30s poll degrades honestly.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { toast } from 'sonner'
import { ArrowRight, PackageOpen, RefreshCw, Truck, Trash2, MapPin } from 'lucide-react'

interface SupplierSampleRow {
  id: string
  quantity: number
  status: 'requested' | 'shipped' | 'delivered' | 'cancelled'
  samplePrice: number
  createdAt: string
  updatedAt: string
  product: { id: string; name: string; slug: string; thumbnail: string | null; unit: string; basePrice: number } | null
  buyerName: string | null
  shippingAddress: Record<string, string | null> | null
  fromSnapshot: boolean
}

interface SampleStats {
  total: number
  requested: number
  shipped: number
  delivered: number
  cancelled: number
}

const STATUS_STYLES: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800 border-amber-200',
  shipped: 'bg-primary/5 text-primary border-primary/30',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function SupplierSamplesPage() {
  const navigate = useNavigationStore((s) => s.navigate)
  const [sellerId, setSellerId] = useState('')
  const [samples, setSamples] = useState<SupplierSampleRow[]>([])
  const [stats, setStats] = useState<SampleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [needsProfile, setNeedsProfile] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Ship dialog: declared sample value (0 = free — honest default).
  const [shipDialog, setShipDialog] = useState<SupplierSampleRow | null>(null)
  const [shipPrice, setShipPrice] = useState('')
  const [shipError, setShipError] = useState('')
  const [shipping, setShipping] = useState(false)

  const inflightRef = useRef(false)
  const seqRef = useRef(0)

  const load = useCallback(async (background = false) => {
    if (background && inflightRef.current) return
    inflightRef.current = true
    const seq = ++seqRef.current
    const apply = (fn: () => void) => { if (seq === seqRef.current) fn() }
    if (background) apply(() => setRefreshing(true))
    else { setLoading(true); setError('') }
    try {
      const res = await fetch('/api/supplier/samples', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        apply(() => { setNeedsProfile(true); setSamples([]); setStats(null) })
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        apply(() => setError(json?.error || `Failed to load sample requests (HTTP ${res.status})`))
        return
      }
      apply(() => {
        setSamples(Array.isArray(json.data?.samples) ? json.data.samples : [])
        setStats(json.data?.stats ?? null)
        setLastUpdated(new Date())
        setNeedsProfile(false)
      })
    } catch {
      apply(() => setError('Network error while loading sample requests'))
    } finally {
      if (seq === seqRef.current) {
        inflightRef.current = false
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => { if (!document.hidden) load(true) }, 30_000)
    return () => clearInterval(id)
  }, [load])

  // Session seller room id — from the real profile projection (no fabrication;
  // the same projection the seller order console uses).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/profile/me', { credentials: 'include' })
        if (!res.ok) return // signed out → no live feed, honest
        const data = await res.json()
        const id = data?.data?.supplierProfile?.id
        if (!cancelled && typeof id === 'string' && id.length > 0) setSellerId(id)
      } catch {
        /* profile fetch failed — live feed stays off, list still works */
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Live taps on the supplier's own token-gated seller room (Task 90):
  // a buyer's new request ('sample:new') or a status change ('sample:status')
  // refreshes this queue instantly — polling is only the degradation path.
  const lastEventRef = useRef('')
  useRealtimeRoom(sellerId ? [`seller:${sellerId}`] : [], {
    onEvent: (message) => {
      const key = `${message.event}:${message.receivedAt.getTime()}`
      if (key === lastEventRef.current) return
      lastEventRef.current = key
      if (message.event === 'sample:new') {
        toast('New sample request', { description: 'A buyer asked for a sample — the queue is refreshing.' })
        void load(true)
      } else if (message.event === 'sample:status') {
        void load(true)
      }
    },
  })

  const cancel = async (s: SupplierSampleRow) => {
    setBusyId(s.id)
    try {
      const res = await fetch(`/api/samples/${s.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Failed to cancel (HTTP ${res.status})`)
        return
      }
      toast.success('Sample request cancelled — the buyer has been notified')
      void load(true)
    } catch {
      toast.error('Network error while cancelling')
    } finally {
      setBusyId(null)
    }
  }

  const openShip = (s: SupplierSampleRow) => {
    setShipDialog(s)
    setShipPrice('')
    setShipError('')
  }

  const submitShip = async () => {
    if (!shipDialog) return
    const price = shipPrice.trim() === '' ? 0 : Number(shipPrice)
    if (!(price >= 0)) {
      setShipError('Declared value must be 0 or a positive number.')
      return
    }
    setShipping(true)
    setShipError('')
    try {
      const body: Record<string, unknown> = { action: 'ship' }
      if (price > 0) body.samplePrice = price
      const res = await fetch(`/api/samples/${shipDialog.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setShipError(json?.error || `Failed to ship (HTTP ${res.status})`)
        return
      }
      toast.success('Marked shipped — the buyer has been notified')
      setShipDialog(null)
      void load(true)
    } catch {
      setShipError('Network error while shipping')
    } finally {
      setShipping(false)
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('supplier-dashboard')} className="text-muted-foreground hover:text-primary">
            <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sample Requests</h1>
            <p className="text-muted-foreground text-sm">Buyers trying your products before bulk cartons</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load()} disabled={refreshing} className="text-muted-foreground">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>

      {needsProfile ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-semibold text-amber-900">Seller sign-in required</p>
          <p className="text-sm text-amber-800 mt-1">Sample requests are tied to your supplier account.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Total</span><span className="font-semibold tabular-nums">{stats?.total ?? '…'}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Awaiting shipment</span><span className="font-semibold tabular-nums text-amber-700">{stats?.requested ?? '…'}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Shipped</span><span className="font-semibold tabular-nums text-primary">{stats?.shipped ?? '…'}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Delivered</span><span className="font-semibold tabular-nums text-green-700">{stats?.delivered ?? '…'}</span></span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><span className="text-muted-foreground">Cancelled</span><span className="font-semibold tabular-nums">{stats?.cancelled ?? '…'}</span></span>
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : samples.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="flex justify-center mb-2"><PackageOpen className="h-8 w-8 text-muted-foreground/40" /></div>
              <p className="font-medium">No sample requests yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                When a buyer taps "Order a sample first" on one of your products, the request lands here — live, with their address snapshot.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {samples.map((s) => (
                <div key={s.id} className="p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                        {s.product?.thumbnail ? (
                          <img src={s.product.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <PackageOpen className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{s.product?.name || '(deleted product)'}</p>
                          <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_STYLES[s.status]}`}>{s.status}</Badge>
                          {s.samplePrice > 0 && <span className="text-[11px] text-muted-foreground whitespace-nowrap">declared ৳{s.samplePrice}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.buyerName || 'A buyer'} · {s.quantity} {s.product?.unit || 'unit'}{s.quantity > 1 ? 's' : ''} (bulk base ৳{s.product?.basePrice ?? '—'}) · {fmtDate(s.createdAt)}
                        </p>
                        {s.shippingAddress ? (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              {s.shippingAddress.contactName ? `${s.shippingAddress.contactName} — ` : ''}
                              {s.shippingAddress.addressLine1}
                              {s.shippingAddress.city ? `, ${s.shippingAddress.city}` : ''}
                              {s.shippingAddress.contactPhone ? ` · ${s.shippingAddress.contactPhone}` : ''}
                              {s.fromSnapshot ? ' · snapshot from request time' : ''}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700 mt-1">No address attached — agree delivery with the buyer.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.status === 'requested' && (
                        <>
                          <Button size="sm" className="h-8 text-xs" disabled={busyId === s.id} onClick={() => openShip(s)}>
                            <Truck className="h-3.5 w-3.5 mr-1" /> Ship
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" disabled={busyId === s.id} onClick={() => void cancel(s)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancel
                          </Button>
                        </>
                      )}
                      {s.status === 'shipped' && (
                        <span className="inline-flex items-center text-[11px] text-primary"><Truck className="h-3.5 w-3.5 mr-1" />awaiting buyer confirmation</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-right">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s · live taps on seller room` : ''}
          </p>
        </>
      )}

      <Dialog open={shipDialog !== null} onOpenChange={(v) => { if (!v) setShipDialog(null) }}>
        <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ship sample</DialogTitle>
            <DialogDescription>
              {shipDialog?.product?.name ? `${shipDialog.product.name} — ${shipDialog.quantity} ${shipDialog.product.unit}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ship-price">Declared value (৳, optional)</Label>
              <Input id="ship-price" type="number" min={0} step="0.01" value={shipPrice} onChange={(e) => setShipPrice(e.target.value)} placeholder="0 = free sample" />
              <p className="text-xs text-muted-foreground">Informational — the value shown to the buyer and on your records. Money handling stays outside the sample rail.</p>
            </div>
            {shipError && <p className="text-sm text-red-600" role="alert">{shipError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialog(null)}>Back</Button>
            <Button onClick={() => void submitShip()} disabled={shipping}>{shipping ? 'Shipping…' : 'Mark shipped'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
