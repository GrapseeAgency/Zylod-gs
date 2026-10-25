'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Search, Truck, Warehouse, Calculator, MapPin, ShieldCheck, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
/**
 * REAL warehouse locator (audit unit 21). The old page rendered three
 * hard-coded fictional facilities — "Dhaka Central Mega-Hub, 3.2 km,
 * 85% Utilized" with invented cold/hazmat capability chips — while the
 * platform's REAL warehouseLocations rows (suppliers manage them through
 * the Task 98 rail) had no public directory read. Now every card is a real
 * row from GET /api/warehouses (active suppliers, approved verification),
 * search runs against the real name/city/district/company fields, the
 * district chips are derived from the live rows, and empty is honest —
 * no fabricated distances, utilization, or capabilities the model cannot
 * know.
 */

interface FacilityRow {
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

export function WarehouseLocatorPage() {
  const { navigate, goBack } = useNavigationStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [rows, setRows] = useState<FacilityRow[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/warehouses')
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setRows(json.data)
        setTotal(typeof json.total === 'number' ? json.total : json.data.length)
        setDistricts(Array.isArray(json.districts) ? json.districts : [])
      } else {
        setError(json?.error || `Could not load the directory (HTTP ${res.status}).`)
      }
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const q = searchQuery.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (activeDistrict && r.district !== activeDistrict) return false
    if (!q) return true
    return [r.name, r.city, r.district, r.companyName, r.addressLine1]
      .filter((v): v is string => typeof v === 'string')
      .some((v) => v.toLowerCase().includes(q))
  })

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg lg:max-w-4xl mx-auto">
        {/* Title */}
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Warehouse Directory</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
            Ship-from locations suppliers publish on Zylod — real rows, no invented distances.
          </p>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by warehouse, company, city, or district…"
              className="h-11 pl-10 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-slate-800 text-xs font-semibold"
            />
          </div>
          {districts.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setActiveDistrict(null)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap ${
                  activeDistrict === null ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                All ({total})
              </button>
              {districts.map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveDistrict(activeDistrict === d ? null : d)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap ${
                    activeDistrict === d ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <PageLoader />
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="mt-3">
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <Warehouse className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {total === 0 ? 'No warehouses published yet' : 'Nothing matches that search'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
              {total === 0
                ? 'Suppliers publish their ship-from locations from their console — the directory fills as they do. Nothing is invented here.'
                : 'Try a different name, city, or district — or clear the filters.'}
            </p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {filtered.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate('seller-storefront', { supplierId: f.supplierId })}
                className="w-full text-left bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{f.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-semibold truncate">{f.companyName}</p>
                  </div>
                  {f.verificationStatus === 'approved' && (
                    <span className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {f.addressLine1}
                    {f.addressLine2 ? `, ${f.addressLine2}` : ''} — {f.city}, {f.district}
                  </span>
                </div>
                {f.ratingCount > 0 && (
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold">
                    ★ {f.ratingAvg.toFixed(1)} ({f.ratingCount} store review{f.ratingCount !== 1 ? 's' : ''})
                  </p>
                )}
                <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {f.district} district
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                    View supplier <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {/* Real companion tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('shipping-calculator')}
            className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs text-left hover:border-slate-300 transition-colors"
          >
            <Calculator className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-black text-slate-900 dark:text-slate-100">Live freight quotes</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed mt-0.5">
              The operators&apos; real zone book — same rates checkout charges.
            </p>
          </button>
          <button
            onClick={() => navigate('my-orders')}
            className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs text-left hover:border-slate-300 transition-colors"
          >
            <Truck className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-black text-slate-900 dark:text-slate-100">Track a real shipment</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed mt-0.5">
              Real tracking events live on each order&apos;s detail page.
            </p>
          </button>
        </div>
      </main>
    </div>
  )
}

export default WarehouseLocatorPage
