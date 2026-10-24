'use client'

/**
 * MySamplesPage — the buyer's side of the sample rail (Task 90): every
 * sample this buyer requested, with the REAL state machine actions
 * (cancel while requested, confirm delivery while shipped), the product,
 * the supplier, and the shipping address served from the live row while it
 * exists and honestly flagged fromSnapshot:true after deletion (the Task 87
 * read shape). Auth failure renders the honest sign-in gate, never a fake
 * empty list.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'
import { ArrowRight, PackageOpen, RefreshCw, Trash2, Truck, CircleCheck, MapPin } from 'lucide-react'

interface SampleRow {
  id: string
  quantity: number
  status: 'requested' | 'shipped' | 'delivered' | 'cancelled'
  samplePrice: number
  createdAt: string
  updatedAt: string
  product: { id: string; name: string; slug: string; thumbnail: string | null; unit: string; supplierName: string | null } | null
  shippingAddress: Record<string, string | null> | null
  fromSnapshot: boolean
}

const STATUS_STYLES: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800 border-amber-200',
  shipped: 'bg-primary/5 text-primary border-primary/30',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function MySamplesPage() {
  const navigate = useNavigationStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const [samples, setSamples] = useState<SampleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const inflightRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (background && inflightRef.current) return
    inflightRef.current = true
    if (!background) { setLoading(true); setError('') }
    try {
      const res = await fetch('/api/samples', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setSamples([])
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load samples (HTTP ${res.status})`)
        return
      }
      setSamples(Array.isArray(json.data?.samples) ? json.data.samples : [])
      setNeedsAuth(false)
      setLastUpdated(new Date())
    } catch {
      setError('Network error while loading samples')
    } finally {
      inflightRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => { if (!document.hidden) load(true) }, 30_000)
    return () => clearInterval(id)
  }, [load])

  const act = async (s: SampleRow, action: 'cancel' | 'deliver') => {
    setBusyId(s.id)
    try {
      const res = await fetch(`/api/samples/${s.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Failed to update sample (HTTP ${res.status})`)
        return
      }
      toast.success(action === 'cancel' ? 'Sample cancelled' : 'Delivery confirmed')
      void load(true)
    } catch {
      toast.error('Network error while updating the sample')
    } finally {
      setBusyId(null)
    }
  }

  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-10 text-center">
        <PackageOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <h1 className="text-xl font-bold">Sign in to see your samples</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Sample requests are tied to your buyer account.</p>
        <Button onClick={() => navigate('login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('home')} className="text-muted-foreground hover:text-primary">
            <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Home
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Samples</h1>
            <p className="text-muted-foreground text-sm">Try one before the bulk carton — request, receive, then order wholesale</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load()} className="text-muted-foreground">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : samples.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <div className="flex justify-center mb-2"><PackageOpen className="h-8 w-8 text-muted-foreground/40" /></div>
          <p className="font-medium">No samples yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            On any product page, use "Order a sample first" to ask the supplier for one — the supplier is notified instantly.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('home')}>Browse products</Button>
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
                      {s.samplePrice > 0 && <span className="text-[11px] text-muted-foreground whitespace-nowrap">declared value ৳{s.samplePrice}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.quantity} {s.product?.unit || 'unit'}{s.quantity > 1 ? 's' : ''} · {s.product?.supplierName || 'unknown supplier'} · requested {fmtDate(s.createdAt)}
                    </p>
                    {s.shippingAddress ? (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                          {s.shippingAddress.addressLine1}
                          {s.shippingAddress.city ? `, ${s.shippingAddress.city}` : ''}
                          {s.fromSnapshot ? ' (from your address book — original entry deleted)' : ''}
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 mt-1">No address attached — agree delivery with the supplier.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.status === 'requested' && (
                    <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" disabled={busyId === s.id} onClick={() => void act(s, 'cancel')}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  )}
                  {s.status === 'shipped' && (
                    <Button size="sm" className="h-8 text-xs" disabled={busyId === s.id} onClick={() => void act(s, 'deliver')}>
                      <CircleCheck className="h-3.5 w-3.5 mr-1" /> Confirm delivery
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-right">
        {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s` : ''}
      </p>
    </div>
  )
}
