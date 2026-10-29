'use client'

/**
 * ADMIN SHIPPING CONSOLE (Task 94) — the configuration half of the
 * shipping circuit: zones (district coverage), methods (carriers), and
 * the weight-band price book that binds them, plus a LIVE QUOTE TESTER
 * that runs the exact public quote API buyers will hit at checkout —
 * so an admin sees the buyer's honest options before a district goes
 * wrong, not after.
 *
 * LIVE: joins the session admin's token-gated admin:<id> room — any
 * console's shipping mutation toasts nothing here but refreshes all four
 * queues; 30s poll degrades gracefully. Every mutation is audited
 * server-side; this surface only renders what the API returns.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AdminDeliveryMethodsManager } from '@/components/admin/admin-delivery-methods-manager'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { toast } from 'sonner'
import {
  ArrowLeft, MapPin, Package, Plus, RefreshCw, Route, Scale, Trash2, Truck,
} from 'lucide-react'

interface Zone { id: string; name: string; districts: string[]; isActive: boolean; rateCount: number }
interface Method { id: string; name: string; description: string | null; estimatedDays: string | null; isActive: boolean; rateCount: number }
interface Rate { id: string; zoneId: string; methodId: string; zoneName: string | null; methodName: string | null; weightMin: number; weightMax: number | null; price: number; freeAbove: number | null }
interface QuoteOption { rateId: string; zoneName: string; methodName: string; estimatedDays: string | null; basePrice: number; price: number; freeShipping: boolean; freeAbove: number | null }

const money = (n: number) => `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const band = (r: { weightMin: number; weightMax: number | null }) =>
  `${r.weightMin}kg – ${r.weightMax === null ? '∞' : `${r.weightMax}kg`}`

export function AdminShippingPage() {
  const { navigate } = useNavigationStore()
  const sessionUser = useAuthStore((s) => s.user)

  const [tab, setTab] = useState<'zones' | 'methods' | 'rates' | 'quote' | 'couriers'>('zones')
  const [zones, setZones] = useState<Zone[] | null>(null)
  const [methods, setMethods] = useState<Method[] | null>(null)
  const [rates, setRates] = useState<Rate[] | null>(null)
  const [authGate, setAuthGate] = useState<'checking' | 'denied' | 'ok'>('checking')
  const [busyId, setBusyId] = useState<string | null>(null)

  // create dialogs
  const [zoneOpen, setZoneOpen] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [zoneForm, setZoneForm] = useState({ name: '', districts: '' })
  const [methodForm, setMethodForm] = useState({ name: '', description: '', estimatedDays: '' })
  const [rateForm, setRateForm] = useState({ zoneId: '', methodId: '', weightMin: '0', weightMax: '', price: '', freeAbove: '' })
  const [saving, setSaving] = useState(false)

  // quote tester
  const [quoteForm, setQuoteForm] = useState({ district: '', weightKg: '10', subtotal: '50000' })
  const [quote, setQuote] = useState<{ options: QuoteOption[]; error: string; loading: boolean }>({ options: [], error: '', loading: false })

  const load = useCallback(async (background = false) => {
    if (!background) setAuthGate((g) => (g === 'ok' ? g : 'checking'))
    try {
      const [zRes, mRes, rRes] = await Promise.all([
        fetch('/api/admin/shipping/zones', { credentials: 'include' }),
        fetch('/api/admin/shipping/methods', { credentials: 'include' }),
        fetch('/api/admin/shipping/rates', { credentials: 'include' }),
      ])
      if (zRes.status === 401 || zRes.status === 403 || mRes.status === 401 || mRes.status === 403 || rRes.status === 401 || rRes.status === 403) {
        setAuthGate('denied')
        return
      }
      const [zJson, mJson, rJson] = await Promise.all([zRes.json(), mRes.json(), rRes.json()])
      setZones(Array.isArray(zJson?.data) ? zJson.data : [])
      setMethods(Array.isArray(mJson?.data) ? mJson.data : [])
      setRates(Array.isArray(rJson?.data) ? rJson.data : [])
      setAuthGate('ok')
    } catch {
      if (!background) toast.error('Failed to load shipping configuration')
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 30s poll fallback
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (authGate !== 'ok') return
    pollRef.current = setInterval(() => load(true), 30_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [authGate, load])

  const sessionUserRef = useRef(sessionUser)
  sessionUserRef.current = sessionUser
  const adminRoom = sessionUser?.userType === 'admin' && sessionUser.id ? `admin:${sessionUser.id}` : ''
  const lastEventRef = useRef('')
  useRealtimeRoom(adminRoom ? [adminRoom] : [], {
    onEvent: (message) => {
      const key = `${message.event}:${message.receivedAt.getTime()}`
      if (key === lastEventRef.current) return
      lastEventRef.current = key
      if (message.event === 'shipping:changed') void load(true)
    },
  })

  const runQuote = async () => {
    const q = `/api/shipping/quote?district=${encodeURIComponent(quoteForm.district.trim())}&weightKg=${encodeURIComponent(quoteForm.weightKg)}&subtotal=${encodeURIComponent(quoteForm.subtotal)}`
    setQuote((s) => ({ ...s, loading: true, error: '' }))
    try {
      const res = await fetch(q)
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setQuote({ options: Array.isArray(json?.data) ? json.data : [], error: '', loading: false })
      } else {
        setQuote({ options: [], error: json?.error || `Quote failed (${res.status})`, loading: false })
      }
    } catch {
      setQuote((s) => ({ ...s, error: 'Network error', loading: false }))
    }
  }

  const createZone = async () => {
    setSaving(true)
    try {
      const districts = zoneForm.districts.split(',').map((d) => d.trim()).filter(Boolean)
      const res = await fetch('/api/admin/shipping/zones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: zoneForm.name.trim(), districts }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success(`Zone "${zoneForm.name.trim()}" created`)
        setZoneOpen(false); setZoneForm({ name: '', districts: '' }); load(true)
      } else {
        toast.error(json?.error || `Create failed (${res.status})`)
      }
    } finally { setSaving(false) }
  }

  const createMethod = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { name: methodForm.name.trim() }
      if (methodForm.description.trim()) body.description = methodForm.description.trim()
      if (methodForm.estimatedDays.trim()) body.estimatedDays = methodForm.estimatedDays.trim()
      const res = await fetch('/api/admin/shipping/methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success(`Method "${methodForm.name.trim()}" created`)
        setMethodOpen(false); setMethodForm({ name: '', description: '', estimatedDays: '' }); load(true)
      } else {
        toast.error(json?.error || `Create failed (${res.status})`)
      }
    } finally { setSaving(false) }
  }

  const createRate = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        zoneId: rateForm.zoneId,
        methodId: rateForm.methodId,
        weightMin: Number(rateForm.weightMin),
        price: Number(rateForm.price),
      }
      if (rateForm.weightMax.trim()) body.weightMax = Number(rateForm.weightMax)
      if (rateForm.freeAbove.trim()) body.freeAbove = Number(rateForm.freeAbove)
      const res = await fetch('/api/admin/shipping/rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201) {
        toast.success('Rate added to the price book')
        setRateOpen(false); setRateForm({ zoneId: '', methodId: '', weightMin: '0', weightMax: '', price: '', freeAbove: '' }); load(true)
      } else {
        toast.error(json?.error || `Create failed (${res.status})`)
      }
    } finally { setSaving(false) }
  }

  const toggleZone = async (z: Zone) => {
    setBusyId(z.id)
    try {
      const res = await fetch(`/api/admin/shipping/zones/${z.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ isActive: !z.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) { toast.success(json?.data?.isActive ? 'Zone activated' : 'Zone deactivated'); load(true) }
      else toast.error(json?.error || `Toggle failed (${res.status})`)
    } finally { setBusyId(null) }
  }

  const toggleMethod = async (m: Method) => {
    setBusyId(m.id)
    try {
      const res = await fetch(`/api/admin/shipping/methods/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ isActive: !m.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) { toast.success(json?.data?.isActive ? 'Method activated' : 'Method deactivated'); load(true) }
      else toast.error(json?.error || `Toggle failed (${res.status})`)
    } finally { setBusyId(null) }
  }

  const removeRate = async (r: Rate) => {
    setBusyId(r.id)
    try {
      const res = await fetch(`/api/admin/shipping/rates/${r.id}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (res.ok) { toast.success('Rate removed from the price book'); load(true) }
      else toast.error(json?.error || `Delete failed (${res.status})`)
    } finally { setBusyId(null) }
  }

  if (authGate === 'checking') {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (authGate === 'denied') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Route className="h-10 w-10 mx-auto text-slate-300" />
          <h1 className="text-lg font-black text-slate-900 dark:text-neutral-100">Admin access required</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500">Shipping configuration is restricted to platform administrators.</p>
          <Button onClick={() => navigate('home')} variant="outline" className="h-9 rounded-xl text-xs font-bold">Back to home</Button>
        </div>
      </div>
    )
  }

  const zoneCount = zones?.length ?? 0
  const methodCount = methods?.length ?? 0
  const rateCount = rates?.length ?? 0
  const activeDistricts = new Set((zones ?? []).filter((z) => z.isActive).flatMap((z) => z.districts)).size

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10">
      <main className="px-4 py-5 md:px-8 md:py-8 max-w-6xl mx-auto space-y-5">
        <button onClick={() => navigate('admin-dashboard')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-neutral-400 dark:text-neutral-500 hover:text-slate-900 dark:text-neutral-100">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin dashboard
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-neutral-100 tracking-tight">Shipping configuration</h1>
            <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5">Zones, carriers and the weight-band price book buyers are quoted at checkout.</p>
          </div>
          <Button onClick={() => load()} variant="outline" className="h-9 rounded-xl text-xs font-bold gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Zones', value: zoneCount, icon: MapPin },
            { label: 'Methods', value: methodCount, icon: Truck },
            { label: 'Rates', value: rateCount, icon: Scale },
            { label: 'Districts covered', value: activeDistricts, icon: Route },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-neutral-100 mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(['zones', 'methods', 'rates', 'quote', 'couriers'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                tab === t ? 'bg-primary text-white' : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-card'
              }`}
            >
              {t === 'quote' ? 'Quote tester' : t === 'couriers' ? 'Checkout couriers' : t}
            </button>
          ))}
        </div>

        {/* ─── CHECKOUT COURIERS ─── */}
        {tab === 'couriers' && <AdminDeliveryMethodsManager />}

        {/* ─── ZONES ─── */}
        {tab === 'zones' && (
          <section className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setZoneOpen(true)} className="h-9 rounded-xl bg-primary text-white text-xs font-bold gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New zone
              </Button>
            </div>
            {(zones ?? []).length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-8 text-center">
                <MapPin className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-2">No zones yet. Create one to start covering districts.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(zones ?? []).map((z) => (
                  <div key={z.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 dark:text-neutral-100">{z.name}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${z.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 dark:bg-card text-slate-400 dark:text-neutral-500'}`}>
                          {z.isActive ? 'active' : 'inactive'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-bold uppercase">{z.rateCount} rate{z.rateCount === 1 ? '' : 's'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {z.districts.map((d) => (
                          <span key={d} className="text-[10px] bg-slate-50 dark:bg-background border border-slate-100 dark:border-neutral-800 rounded-full px-2 py-0.5 text-slate-600 dark:text-neutral-400 dark:text-neutral-500">{d}</span>
                        ))}
                      </div>
                    </div>
                    <Switch checked={z.isActive} disabled={busyId === z.id} onCheckedChange={() => toggleZone(z)} aria-label={`Toggle zone ${z.name}`} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── METHODS ─── */}
        {tab === 'methods' && (
          <section className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setMethodOpen(true)} className="h-9 rounded-xl bg-primary text-white text-xs font-bold gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New method
              </Button>
            </div>
            {(methods ?? []).length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-8 text-center">
                <Truck className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-2">No methods yet. Add the carriers you actually ship with.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(methods ?? []).map((m) => (
                  <div key={m.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 dark:text-neutral-100">{m.name}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${m.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 dark:bg-card text-slate-400 dark:text-neutral-500'}`}>
                          {m.isActive ? 'active' : 'inactive'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-bold uppercase">{m.rateCount} rate{m.rateCount === 1 ? '' : 's'}</span>
                      </div>
                      {(m.description || m.estimatedDays) && (
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-1">
                          {m.description}{m.description && m.estimatedDays ? ' · ' : ''}{m.estimatedDays ? `Est. ${m.estimatedDays}` : ''}
                        </p>
                      )}
                    </div>
                    <Switch checked={m.isActive} disabled={busyId === m.id} onCheckedChange={() => toggleMethod(m)} aria-label={`Toggle method ${m.name}`} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── RATES ─── */}
        {tab === 'rates' && (
          <section className="space-y-3">
            <div className="flex justify-end">
              <Button
                onClick={() => setRateOpen(true)}
                disabled={zoneCount === 0 || methodCount === 0}
                className="h-9 rounded-xl bg-primary text-white text-xs font-bold gap-1.5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> New rate
              </Button>
            </div>
            {zoneCount === 0 || methodCount === 0 ? (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 font-semibold">
                A rate binds a zone to a method — create at least one of each first.
              </div>
            ) : (rates ?? []).length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-8 text-center">
                <Scale className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-2">The price book is empty. Add weight bands per zone × method.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 divide-y divide-slate-100 dark:divide-neutral-800">
                {(rates ?? []).map((r) => (
                  <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-neutral-100">{r.zoneName ?? '?'} × {r.methodName ?? '?'}</p>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5 font-mono">
                        {band(r)} · {money(r.price)}
                        {r.freeAbove !== null ? ` · FREE above ${money(r.freeAbove)}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      disabled={busyId === r.id}
                      onClick={() => removeRate(r)}
                      className="h-8 w-8 p-0 text-slate-400 dark:text-neutral-500 dark:text-neutral-400 hover:text-rose-600 shrink-0 self-end sm:self-auto"
                      aria-label={`Remove rate ${r.zoneName} ${r.methodName} ${band(r)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── QUOTE TESTER ─── */}
        {tab === 'quote' && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-neutral-100">Live quote tester</h2>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5">Runs the exact public endpoint buyers will hit — what you see here is what they get.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">District</Label>
                <Input value={quoteForm.district} onChange={(e) => setQuoteForm((f) => ({ ...f, district: e.target.value }))} placeholder="e.g. Chattogram" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Weight (kg)</Label>
                <Input type="number" min="0" value={quoteForm.weightKg} onChange={(e) => setQuoteForm((f) => ({ ...f, weightKg: e.target.value }))} className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Order subtotal (৳)</Label>
                <Input type="number" min="0" value={quoteForm.subtotal} onChange={(e) => setQuoteForm((f) => ({ ...f, subtotal: e.target.value }))} className="h-9 text-xs" />
              </div>
            </div>
            <Button onClick={runQuote} disabled={!quoteForm.district.trim() || quote.loading} className="h-9 rounded-xl bg-primary text-white text-xs font-bold gap-1.5">
              {quote.loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />} Quote this shipment
            </Button>
            {quote.error && <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{quote.error}</p>}
            <div className="space-y-2">
              {quote.options.length === 0 && !quote.error && quote.options !== null && (
                <p className="text-xs text-slate-400 dark:text-neutral-500 dark:text-neutral-400 text-center py-4">
                  {quote.loading ? 'Quoting…' : 'No options — run a quote to see what a buyer in that district would be offered.'}
                </p>
              )}
              {quote.options.map((o) => (
                <div key={o.rateId} className="flex flex-col sm:flex-row sm:items-center gap-2 border border-slate-100 dark:border-neutral-800 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-neutral-100">{o.methodName}{o.freeShipping && <span className="ml-2 text-[10px] font-bold text-emerald-600 uppercase">free</span>}</p>
                    <p className="text-[10px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500">{o.zoneName}{o.estimatedDays ? ` · est. ${o.estimatedDays}` : ''}{o.freeShipping ? ` · crossed ${money(o.freeAbove ?? 0)}` : ''}</p>
                  </div>
                  <p className={`text-sm font-black ${o.freeShipping ? 'text-emerald-600' : 'text-slate-900 dark:text-neutral-100'}`}>
                    {o.freeShipping && o.basePrice > 0 ? <span className="text-slate-400 dark:text-neutral-500 dark:text-neutral-400 line-through mr-1.5">{money(o.basePrice)}</span> : null}
                    {money(o.price)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ─── CREATE ZONE ─── */}
      <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-black">New shipping zone</DialogTitle>
            <DialogDescription className="text-xs">Districts are matched case-insensitively. A district can belong to only one active zone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Zone name *</Label>
              <Input value={zoneForm.name} onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Dhaka metro" className="h-9 text-xs" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Districts (comma-separated) *</Label>
              <Textarea value={zoneForm.districts} onChange={(e) => setZoneForm((f) => ({ ...f, districts: e.target.value }))} placeholder="Dhaka, Gazipur, Narayanganj" rows={2} className="text-xs resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createZone} disabled={saving || !zoneForm.name.trim() || !zoneForm.districts.trim()} className="h-9 rounded-xl bg-primary text-white text-xs font-bold">
              Create zone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CREATE METHOD ─── */}
      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-black">New shipping method</DialogTitle>
            <DialogDescription className="text-xs">The carrier line buyers choose from — name it the way they know it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Method name *</Label>
              <Input value={methodForm.name} onChange={(e) => setMethodForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Sundarban Courier" className="h-9 text-xs" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Description</Label>
              <Input value={methodForm.description} onChange={(e) => setMethodForm((f) => ({ ...f, description: e.target.value }))} placeholder="Doorstep delivery with tracking" className="h-9 text-xs" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Estimated days</Label>
              <Input value={methodForm.estimatedDays} onChange={(e) => setMethodForm((f) => ({ ...f, estimatedDays: e.target.value }))} placeholder="e.g. 2-4 days" className="h-9 text-xs" maxLength={60} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createMethod} disabled={saving || !methodForm.name.trim()} className="h-9 rounded-xl bg-primary text-white text-xs font-bold">
              Create method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CREATE RATE ─── */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-black">New rate</DialogTitle>
            <DialogDescription className="text-xs">Binds a weight band to a zone × method. Overlapping bands are refused — one weight, one price.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Zone *</Label>
              <select value={rateForm.zoneId} onChange={(e) => setRateForm((f) => ({ ...f, zoneId: e.target.value }))} className="w-full h-9 text-xs rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-gray-900 px-2">
                <option value="">Select zone…</option>
                {(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Method *</Label>
              <select value={rateForm.methodId} onChange={(e) => setRateForm((f) => ({ ...f, methodId: e.target.value }))} className="w-full h-9 text-xs rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-gray-900 px-2">
                <option value="">Select method…</option>
                {(methods ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Weight min (kg) *</Label>
              <Input type="number" min="0" value={rateForm.weightMin} onChange={(e) => setRateForm((f) => ({ ...f, weightMin: e.target.value }))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Weight max (kg, empty = ∞)</Label>
              <Input type="number" min="0" value={rateForm.weightMax} onChange={(e) => setRateForm((f) => ({ ...f, weightMax: e.target.value }))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Price (৳) *</Label>
              <Input type="number" min="0" value={rateForm.price} onChange={(e) => setRateForm((f) => ({ ...f, price: e.target.value }))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500">Free above (৳, empty = never)</Label>
              <Input type="number" min="0" value={rateForm.freeAbove} onChange={(e) => setRateForm((f) => ({ ...f, freeAbove: e.target.value }))} className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={createRate}
              disabled={saving || !rateForm.zoneId || !rateForm.methodId || rateForm.price === '' || rateForm.weightMin === ''}
              className="h-9 rounded-xl bg-primary text-white text-xs font-bold"
            >
              Add rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminShippingPage
