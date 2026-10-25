'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, MapPin, Warehouse, Loader2, RefreshCw, AlertCircle, Truck, PackageSearch,
} from 'lucide-react'

/**
 * REAL freight calculator (audit unit 20). The old page quoted from a
 * hard-coded "$1.25/kg" constant with invented hazmat/insurance fees and a
 * fabricated "2-3 Business Days", then faked a "Book Freight" action. Now
 * every quote comes from the LIVE zone book the admins actually configure —
 * GET /api/shipping/quote resolves the active zone covering the district,
 * intersects its rates with active methods and the weight band, honors
 * freeAbove crossings, and returns the real estimatedDays. An uncovered
 * district is an honest empty list, never an invented standard rate.
 * The dimensions row is a real volumetric-weight helper (L×W×H/5000) that
 * fills the chargeable-weight input — pure math, clearly labeled.
 */

interface QuoteOption {
  rateId: string
  zoneId: string
  zoneName: string
  methodId: string
  methodName: string
  methodDescription: string | null
  estimatedDays: string | null
  basePrice: number
  price: number
  freeShipping: boolean
  freeAbove: number | null
}

export function ShippingCalculatorPage() {
  const { goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [district, setDistrict] = useState('Dhaka')
  const [weight, setWeight] = useState('10')
  const [dims, setDims] = useState({ l: '', w: '', h: '' })
  const [subtotal, setSubtotal] = useState('')
  const [options, setOptions] = useState<QuoteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyVolumetric = () => {
    const l = parseFloat(dims.l) || 0
    const w = parseFloat(dims.w) || 0
    const h = parseFloat(dims.h) || 0
    if (l <= 0 || w <= 0 || h <= 0) {
      toast.error('Enter all three dimensions first')
      return
    }
    const volumetric = (l * w * h) / 5000
    setWeight(volumetric.toFixed(2))
    toast.message(`Volumetric weight applied: ${volumetric.toFixed(2)} kg`, {
      description: 'L × W × H ÷ 5000 — the chargeable weight is the greater of this and the real weight.',
    })
  }

  const quote = useCallback(async () => {
    const weightKg = parseFloat(weight)
    if (!district.trim()) {
      toast.error('Enter a destination district')
      return
    }
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      toast.error('Enter a valid weight in kg')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ district: district.trim(), weightKg: String(weightKg) })
      const sub = parseFloat(subtotal)
      if (Number.isFinite(sub) && sub > 0) qs.set('subtotal', String(sub))
      const res = await fetch(`/api/shipping/quote?${qs.toString()}`)
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setOptions(json.data)
        setLoaded(true)
      } else {
        setError(json?.error || `Could not quote (HTTP ${res.status}).`)
      }
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [district, weight, subtotal])

  // Quote once on mount so the page never sits on an invented number.
  useEffect(() => {
    quote()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <span className="w-6" />
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Title */}
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Freight Calculator</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
            Live quotes from the operators&apos; zone book — the same rates checkout charges.
          </p>
        </div>

        {/* Shipment Details Form Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Shipment Details</h2>

          {/* Destination */}
          <div className="space-y-1.5">
            <label htmlFor="calc-district" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Destination District</label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              <Input
                id="calc-district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Dhaka, Chittagong, Khulna"
                className="h-11 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <label htmlFor="calc-weight" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Chargeable Weight</label>
            <div className="flex gap-2">
              <Input
                id="calc-weight"
                type="number"
                min="0"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.00"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
              />
              <div className="h-11 px-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                KG
              </div>
            </div>
          </div>

          {/* Dimensions — real volumetric helper */}
          <div className="space-y-1.5">
            <label htmlFor="calc-dim-l" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Volumetric helper (L × W × H cm ÷ 5000)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="calc-dim-l"
                type="number"
                min="0"
                value={dims.l}
                onChange={(e) => setDims((d) => ({ ...d, l: e.target.value }))}
                placeholder="L"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs text-center font-bold"
              />
              <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold">×</span>
              <Input
                aria-label="Width in cm"
                type="number"
                min="0"
                value={dims.w}
                onChange={(e) => setDims((d) => ({ ...d, w: e.target.value }))}
                placeholder="W"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs text-center font-bold"
              />
              <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold">×</span>
              <Input
                aria-label="Height in cm"
                type="number"
                min="0"
                value={dims.h}
                onChange={(e) => setDims((d) => ({ ...d, h: e.target.value }))}
                placeholder="H"
                className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs text-center font-bold"
              />
              <Button
                type="button"
                variant="outline"
                onClick={applyVolumetric}
                className="h-11 px-3 rounded-2xl border-slate-200 dark:border-slate-800 text-[11px] font-bold shrink-0"
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Subtotal (for freeAbove crossings) */}
          <div className="space-y-1.5">
            <label htmlFor="calc-subtotal" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Order subtotal <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400 font-normal">(optional — unlocks free-above thresholds)</span>
            </label>
            <div className="relative">
              <Warehouse className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              <Input
                id="calc-subtotal"
                type="number"
                min="0"
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                placeholder="e.g. 50000"
                className="h-11 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
              />
            </div>
          </div>

          <Button
            onClick={quote}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Quoting…</span>
            ) : (
              <span className="flex items-center gap-2"><PackageSearch className="h-4 w-4" /> Get Live Quote</span>
            )}
          </Button>
        </div>

        {/* Result — the zone book's real answer */}
        {loading && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <PageLoader label="Asking the live zone book…" className="min-h-0" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{error}</p>
            <Button variant="outline" size="sm" onClick={quote} className="mt-3">
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </div>
        )}

        {!loading && !error && loaded && options.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <Truck className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No shipping option covers that yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
              No active zone in the operators&apos; book reaches &ldquo;{district}&rdquo; at this weight.
              Try a nearby district — or contact support to request the lane.
            </p>
          </div>
        )}

        {!loading && !error && options.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Live options</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 font-medium">{options.length} option{options.length !== 1 ? 's' : ''} · {district}</span>
            </div>
            {options.map((opt, idx) => (
              <div
                key={opt.rateId}
                className={`bg-white dark:bg-gray-900 rounded-3xl p-4 border shadow-2xs space-y-2 ${idx === 0 ? 'border-l-4 border-l-primary border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{opt.methodName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">{opt.zoneName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-black ${opt.freeShipping ? 'text-emerald-600' : 'text-primary'}`}>
                      {opt.freeShipping ? 'FREE' : formatPrice(opt.price)}
                    </p>
                    {opt.freeShipping && opt.freeAbove !== null && (
                      <p className="text-[10px] text-emerald-700 font-semibold">
                        (৳{Number(opt.basePrice).toLocaleString()} waived above {formatPrice(opt.freeAbove)})
                      </p>
                    )}
                  </div>
                </div>
                {opt.methodDescription && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">{opt.methodDescription}</p>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-50 text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-500">
                  <span>Estimated transit: <strong className="text-slate-900 dark:text-slate-100">{opt.estimatedDays ?? 'Not stated by the operator'}</strong></span>
                  {idx === 0 && <span className="text-primary font-black uppercase tracking-wide text-[10px]">Cheapest</span>}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed px-1">
              These are the operators&apos; configured rates for this lane — the same book checkout charges against.
              Freight is booked by placing an order; there is no separate freight booking on this platform.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  )
}

export default ShippingCalculatorPage
import { PageLoader } from '@/components/ui/page-loader'
