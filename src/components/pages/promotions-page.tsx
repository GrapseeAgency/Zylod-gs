'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft,
  BadgePercent,
  AlertTriangle,
  Timer,
} from 'lucide-react'

/**
 * Task 100: THE PUBLIC PROMOTIONS RAIL (buyer side). Platform promotions
 * are automatic — no code, no opt-in — so this page states exactly what a
 * buyer GETS without inventing a number: the discount rule (X% off / ৳X
 * off), the window, the floor, and the pinned products. Cards open the PDP
 * (where the real add-to-cart contract lives). The REAL ৳ a buyer saves
 * appears on the order receipt, computed by the server pricing engine —
 * this page never fakes a price.
 */

interface PromoProduct {
  id: string
  name: string
  unitPrice: number
  unit: string
  bundleSize: number | null
  inStock: boolean
  image: string | null
}

interface Campaign {
  id: string
  name: string
  description: string | null
  type: string
  value: number
  minOrderAmount: number | null
  maxDiscount: number | null
  validFrom: string
  validUntil: string
  products: PromoProduct[]
}

function discountLabel(c: Campaign): string {
  if (c.type === 'percentage') return `${c.value}% off`
  if (c.type === 'fixed') return `৳${c.value.toLocaleString()} off`
  return c.type
}

function daysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'ended'
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''} left`
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''} left`
  return 'ending soon'
}

export function PromotionsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/promotions')
        const json = await res.json().catch(() => null)
        if (!cancelled && res.ok && json?.success) {
          setCampaigns(json.data ?? [])
        } else if (!cancelled) {
          setLoadError('Promotions are unavailable right now.')
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900/95 backdrop-blur border-b">
        <div className="max-w-[1280px] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('home')}
            className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Platform Promotions</h1>
            <p className="text-[11px] text-muted-foreground">Automatic discounts — applied at checkout, no code needed</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-6">
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label="Loading promotions">
            {[0, 1].map((i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : loadError ? (
          <div className="text-center py-16">
            <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <BadgePercent className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <h2 className="text-base font-semibold">No promotions running right now</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              When the platform launches a campaign, it appears here and applies automatically to the pinned products at checkout.
            </p>
          </div>
        ) : (
          campaigns.map((c) => (
            <section key={c.id} aria-labelledby={`promo-${c.id}`} className="rounded-2xl border overflow-hidden">
              {/* Campaign header */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 id={`promo-${c.id}`} className="text-base sm:text-lg font-black tracking-tight">{c.name}</h2>
                      <span className="text-[11px] font-bold bg-white dark:bg-gray-900/20 px-2 py-0.5 rounded-full">{discountLabel(c)}</span>
                    </div>
                    {c.description && <p className="text-xs text-white/85 mt-1 max-w-xl">{c.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/80 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> {daysLeft(c.validUntil)}</span>
                      <span>Ends {new Date(c.validUntil).toLocaleDateString('en-GB')}</span>
                      {c.minOrderAmount != null && <span>Min ৳{c.minOrderAmount.toLocaleString()} on pinned items</span>}
                      {c.maxDiscount != null && <span>Capped at ৳{c.maxDiscount.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinned products */}
              {c.products.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Every pinned product is currently unavailable — the discount waits for stock.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3 sm:p-4">
                  {c.products.map((p) => (
                    <div key={p.id} className="rounded-xl border overflow-hidden flex flex-col">
                      <button
                        className="block aspect-square bg-muted cursor-pointer"
                        onClick={() => navigate('product-detail', { productId: p.id })}
                        aria-label={`View ${p.name}`}
                      >
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <BadgePercent className="h-8 w-8" />
                          </div>
                        )}
                      </button>
                      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
                        <button
                          className="text-left text-xs font-semibold leading-snug line-clamp-2 hover:text-primary"
                          onClick={() => navigate('product-detail', { productId: p.id })}
                        >
                          {p.name}
                        </button>
                        <div className="text-[11px] text-muted-foreground">
                          {formatPrice(p.unitPrice)} / {p.unit}
                          {p.bundleSize != null && p.bundleSize > 1 ? ` · bundle of ${p.bundleSize}` : ''}
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.inStock ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                            {p.inStock ? 'In stock' : 'Out of stock'}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700">View &amp; buy →</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))
        )}

        <p className="text-[11px] text-muted-foreground text-center pb-4 max-w-md mx-auto leading-relaxed">
          How it works: add pinned products, and the best qualifying campaign applies automatically at checkout — before any coupon code. The receipt shows the exact ৳ the promotion saved you.
        </p>
      </div>
    </div>
  )
}

export default PromotionsPage
