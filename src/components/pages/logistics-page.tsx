'use client'

/**
 * Logistics & Freight hub (pageId 'logistics') — the page behind the header
 * search "Wholesale Logistics & Freight" destination. Previously this id fell
 * through to the generic-info placeholder; everything here is REAL data:
 *   - /api/delivery-methods → couriers the admin actually configured
 *   - /api/warehouses       → active ship-from locations of approved suppliers
 *   - /api/shipping/quote   → zone-based rate resolution (the Task 94 engine)
 * An empty methods/warehouse list is shown honestly — nothing is invented.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Truck, PackageCheck, Warehouse, Calculator, Search, MapPin,
  Clock, BadgeCheck, ChevronRight, Loader2, Ship, Globe, PackageOpen, Star,
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

interface DeliveryMethod {
  id: string
  name: string
  description: string | null
  estimated_delivery: string | null
  price: number
  badge: string | null
}

interface WarehouseRow {
  id: string
  name: string
  city: string | null
  district: string | null
  addressLine1: string | null
  addressLine2: string | null
  supplierId: string
  companyName: string
  ratingAvg: number
  ratingCount: number
  verificationStatus: string
}

interface QuoteOption {
  rateId: string
  zoneName: string
  methodName: string
  methodDescription: string | null
  estimatedDays: number | null
  basePrice: number
  price: number
  freeShipping: boolean
  freeAbove: number | null
}

export function LogisticsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [methods, setMethods] = useState<DeliveryMethod[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [warehouseQuery, setWarehouseQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ─── Shipping quote calculator state (real /api/shipping/quote) ───
  const [district, setDistrict] = useState('')
  const [weightKg, setWeightKg] = useState('10')
  const [subtotal, setSubtotal] = useState('50000')
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[] | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [mRes, wRes] = await Promise.allSettled([
          fetch('/api/delivery-methods'),
          fetch('/api/warehouses'),
        ])
        if (cancelled) return

        let sawSuccess = false
        if (mRes.status === 'fulfilled' && mRes.value.ok) {
          const json = await mRes.value.json().catch(() => null)
          if (json?.success && Array.isArray(json.data)) {
            sawSuccess = true
            setMethods(json.data)
          }
        }
        if (wRes.status === 'fulfilled' && wRes.value.ok) {
          const json = await wRes.value.json().catch(() => null)
          if (json?.success && Array.isArray(json.data)) {
            sawSuccess = true
            setWarehouses(json.data)
            if (Array.isArray(json.districts)) setDistricts(json.districts)
          }
        }
        if (!sawSuccess) setLoadError('Logistics data is unavailable right now. Please try again later.')
      } catch {
        if (!cancelled) setLoadError('Network error while loading logistics data.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Warehouse search hits the real API with the query param (debounced).
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/warehouses?q=${encodeURIComponent(warehouseQuery.trim())}`)
        const json = await res.json().catch(() => null)
        if (json?.success && Array.isArray(json.data)) setWarehouses(json.data)
      } catch { /* keep last known list */ }
    }, 300)
    return () => clearTimeout(t)
  }, [warehouseQuery])

  const fetchQuote = useCallback(async () => {
    const w = Number(weightKg)
    const s = Number(subtotal)
    if (!district.trim()) { setQuoteError('Enter a delivery district first.'); return }
    if (!Number.isFinite(w) || w < 0) { setQuoteError('Weight must be a number (kg).'); return }
    if (!Number.isFinite(s) || s < 0) { setQuoteError('Order value must be a number.'); return }

    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const qs = new URLSearchParams({
        district: district.trim(),
        weightKg: String(w),
        subtotal: String(s),
      })
      const res = await fetch(`/api/shipping/quote?${qs.toString()}`)
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setQuoteError(json?.error || 'Quote request failed. Adjust the inputs and try again.')
        setQuoteOptions(null)
      } else {
        // The engine returns an honest empty list for uncovered districts —
        // show exactly that, never a fabricated rate.
        setQuoteOptions(Array.isArray(json.data) ? json.data : [])
      }
    } catch {
      setQuoteError('Network error while requesting the quote.')
      setQuoteOptions(null)
    } finally {
      setQuoteLoading(false)
    }
  }, [district, weightKg, subtotal])

  const quickLinks = [
    { label: 'Track an Order', page: 'track-order', desc: 'Live consignment status', icon: PackageCheck },
    { label: 'Freight Tracking', page: 'freight-tracking', desc: 'Containers & cargo', icon: Ship },
    { label: 'Import / Export', page: 'import-export-tracker', desc: 'Cross-border shipments', icon: Globe },
    { label: 'Customs Clearance', page: 'customs-clearance', desc: 'Customs status', icon: PackageOpen },
  ]

  return (
    <div className="min-h-screen bg-muted pb-20 md:pb-8">
      {/* ─── Header banner ─── */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Truck className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black">Logistics &amp; Freight</h1>
          </div>
          <p className="text-white/85 text-sm md:text-base max-w-2xl">
            Nationwide freight rates, live delivery methods, and the real ship-from warehouse
            directory — all sourced from the platform&apos;s live logistics configuration.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">
        {isLoading && <PageLoader label="Loading logistics data…" />}

        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Truck className="w-8 h-8 text-primary" />
            <p className="text-sm text-foreground">{loadError}</p>
          </div>
        )}

        {/* ─── Quick tools — all real pages ─── */}
        {!isLoading && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map((l) => (
              <button
                key={l.page}
                onClick={() => navigate(l.page)}
                className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <l.icon className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm font-bold text-foreground">{l.label}</p>
                <p className="text-[11px] text-muted-foreground">{l.desc}</p>
              </button>
            ))}
          </section>
        )}

        {/* ─── Delivery methods (admin-configured, real) ─── */}
        {!isLoading && (
          <section className="space-y-3">
            <h2 className="text-base md:text-lg font-bold text-foreground">Delivery Methods</h2>
            {methods.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <Truck className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No delivery methods have been published yet. Check the shipping quote below —
                  zone rates are configured separately and may still be available for your district.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {methods.map((m) => (
                  <div key={m.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm">{m.name}</p>
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>
                        )}
                      </div>
                      {m.badge && (
                        <span className="shrink-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {m.estimated_delivery || 'Timeline set by courier'}
                      </span>
                      <span className="text-sm font-black text-foreground">
                        {m.price > 0 ? formatPrice(m.price) : 'Free'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── Shipping quote calculator (real rate engine) ─── */}
        {!isLoading && (
          <section className="space-y-3">
            <h2 className="text-base md:text-lg font-bold text-foreground">Shipping Rate Calculator</h2>
            <div className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Delivery district</span>
                  <input
                    list="logistics-districts"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Dhaka"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <datalist id="logistics-districts">
                    {districts.map((d) => <option key={d} value={d} />)}
                  </datalist>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Shipment weight (kg)</span>
                  <input
                    type="number"
                    min="0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Order value ({'\u09F3'})</span>
                  <input
                    type="number"
                    min="0"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              </div>
              <button
                onClick={fetchQuote}
                disabled={quoteLoading}
                className="h-10 px-5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-sm font-bold rounded-lg flex items-center gap-2"
              >
                {quoteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Get Shipping Rates
              </button>

              {quoteError && (
                <p className="text-xs text-destructive">{quoteError}</p>
              )}

              {quoteOptions && (
                quoteOptions.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-5 text-center">
                    <MapPin className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-foreground font-semibold">No rates cover that district yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Shipping zones are configured per district — this district has no active zone/rate combination for the given weight.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quoteOptions.map((o, i) => (
                      <motion.div
                        key={o.rateId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between gap-3 border border-border rounded-xl px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">
                            {o.methodName}
                            {i === 0 && (
                              <span className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded">Cheapest</span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {o.zoneName}
                            {o.estimatedDays != null && ` · ~${o.estimatedDays} day${o.estimatedDays === 1 ? '' : 's'}`}
                            {o.freeShipping && o.freeAbove != null && ` · free above ${formatPrice(o.freeAbove)}`}
                          </p>
                        </div>
                        <span className={`text-sm font-black shrink-0 ${o.freeShipping ? 'text-emerald-600' : 'text-foreground'}`}>
                          {o.freeShipping ? 'FREE' : formatPrice(o.price)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* ─── Warehouse directory (real rows) ─── */}
        {!isLoading && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-base md:text-lg font-bold text-foreground">Ship-From Warehouses</h2>
              <span className="text-xs text-muted-foreground">{warehouses.length} location{warehouses.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={warehouseQuery}
                onChange={(e) => setWarehouseQuery(e.target.value)}
                placeholder="Search warehouses by name, city, district, or company…"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {warehouses.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <Warehouse className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No warehouses match yet. Suppliers publish their ship-from locations as they are
                  verified — new facilities appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {warehouses.map((w) => (
                  <div key={w.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{w.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[w.addressLine1, w.addressLine2, w.city, w.district].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      {w.verificationStatus === 'approved' && (
                        <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <button
                        onClick={() => navigate('supplier-storefront', { supplierId: w.supplierId })}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 min-w-0"
                      >
                        <span className="truncate max-w-[180px]">{w.companyName}</span>
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      </button>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        {w.ratingAvg > 0 ? w.ratingAvg.toFixed(1) : 'New'}
                        {w.ratingCount > 0 && ` (${w.ratingCount})`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default LogisticsPage
