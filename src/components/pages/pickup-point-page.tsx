'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Search, MapPin, Star, BadgeCheck, Loader2, Warehouse,
  AlertCircle, Store, Package,
} from 'lucide-react'

/**
 * REAL pickup points — replaces the fabricated "Downtown Logistics Center
 * / Northside Industrial Park / Westport Depot" hubs with invented
 * distances, traffic levels, and pickup estimates, plus a "Confirm Hub"
 * button that only navigated away.
 *
 * Source of truth: GET /api/warehouses (the Task 163 public rail — the
 * REAL warehouseLocations rows of APPROVED suppliers, with live q= search
 * and district list derived from live rows).
 *
 * On Zylod a "pickup point" is a verified supplier warehouse where goods
 * can be collected. There are no invented operating hours, traffic levels,
 * or distances — the platform cannot know those; pickup timing is arranged
 * with the supplier directly (the honest path is their storefront).
 */

interface ApiWarehouse {
  id: string
  name: string
  city: string
  district: string
  addressLine1: string
  addressLine2: string | null
  supplierId: string
  companyName: string
  ratingAvg: number
  ratingCount: number
  verificationStatus: string
}

export function PickupPointPage() {
  const { navigate, goBack } = useNavigationStore()
  const [allRows, setAllRows] = useState<ApiWarehouse[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [district, setDistrict] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const load = React.useCallback(async (q: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/warehouses?${params.toString()}`, { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setError(json?.error || `HTTP ${res.status}`); return }
      setAllRows(Array.isArray(json?.data) ? json.data : [])
      setDistricts(Array.isArray(json?.districts) ? json.districts : [])
    } catch {
      setError('Network error — check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { load(search) }, 300)
    return () => clearTimeout(t)
  }, [search, load])

  // District chips filter client-side over the fetched rows (the rail's q=
  // covers name/city/district/company text; district is a facet, not a param).
  const rows = district === 'all'
    ? allRows
    : allRows.filter(r => (r.district || '') === district)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Pickup Points</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
        <div className="hidden md:block">
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Pickup points</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified supplier warehouses where you can collect your orders
          </p>
        </div>

        {/* Honest explainer */}
        <div className="flex items-start gap-3 bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <Warehouse className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Every location below is a real warehouse registered by a verified supplier. Collection
            windows are arranged directly with the supplier after your order is confirmed — open their
            storefront to coordinate.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, or address…"
            className="h-11 pl-10 rounded-2xl bg-white dark:bg-gray-900 border-slate-200 dark:border-slate-800 text-xs font-semibold"
            aria-label="Search pickup points"
          />
        </div>

        {/* District chips (derived from live rows) */}
        {districts.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setDistrict('all')}
              aria-pressed={district === 'all'}
              className={
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ' +
                (district === 'all' ? 'bg-primary text-white shadow-xs' : 'bg-slate-200/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80')
              }
            >
              All districts
            </button>
            {districts.map(d => (
              <button
                key={d}
                onClick={() => setDistrict(d)}
                aria-pressed={district === d}
                className={
                  'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ' +
                  (district === d ? 'bg-primary text-white shadow-xs' : 'bg-slate-200/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80')
                }
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!loading && error && (
          <div className="rounded-3xl bg-white dark:bg-gray-900 border border-red-200 p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Couldn't load pickup points</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{error}</p>
            <Button onClick={() => load(search)} variant="outline" className="text-xs font-bold gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="rounded-3xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
            <Package className="h-10 w-10 text-slate-300 mx-auto" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {search || district !== 'all' ? 'No pickup points match' : 'No pickup points yet'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {search || district !== 'all'
                ? 'Try a different search term or clear the district filter.'
                : 'Verified suppliers register their warehouses here. Check back soon.'}
            </p>
          </div>
        )}

        {/* Real warehouse cards */}
        {!loading && !error && rows.length > 0 && (
          <div className="space-y-3.5 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3.5 md:space-y-0">
            {rows.map(w => {
              const isSelected = selected === w.id
              return (
                <div
                  key={w.id}
                  onClick={() => setSelected(w.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(w.id) }}
                  aria-pressed={isSelected}
                  className={
                    'bg-white dark:bg-gray-900 rounded-3xl p-5 border transition-all cursor-pointer shadow-2xs space-y-3 ' +
                    (isSelected ? 'border-primary ring-2 ring-primary/20 border-l-4 border-l-primary' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 break-words">{w.name}</h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {w.companyName}
                      </p>
                    </div>
                    {w.verificationStatus === 'approved' ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0 gap-1">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-[10px]">{w.verificationStatus}</Badge>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                    <span className="break-words">
                      {[w.addressLine1, w.addressLine2, w.city, w.district].filter(Boolean).join(', ')}
                    </span>
                  </div>

                  {w.ratingCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      {w.ratingAvg.toFixed(1)} ({w.ratingCount} review{w.ratingCount === 1 ? '' : 's'})
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-50 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {w.district || w.city}
                    </span>
                    <Button
                      onClick={e => {
                        e.stopPropagation()
                        navigate('seller-storefront', { supplierId: w.supplierId })
                      }}
                      className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shadow-xs gap-1.5"
                    >
                      <Store className="h-3.5 w-3.5" /> Visit store
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
export default PickupPointPage
