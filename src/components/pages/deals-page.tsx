'use client'

/**
 * Deals & Sales hub (pageId 'deals') — the page behind the header search
 * "Deals & Sales" shortcut and the sitemap. Previously this id fell through
 * to the generic-info placeholder; this page is REAL data only:
 *   - /api/deals       → active flash + daily deals (window-checked server side)
 *   - /api/promotions  → active platform campaigns with pinned products
 * Add-to-cart uses the same store contract and account wall as the
 * flash-deals page, so cart rows are identical everywhere.
 */

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'
import {
  ArrowLeft, BadgePercent, Flame, CalendarDays, Megaphone, ShoppingCart,
  Package, Clock, ChevronRight, AlertTriangle, ImageOff, ShieldCheck,
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

interface DealItem {
  id: string
  type: string
  productId: string
  productName: string
  productSlug: string
  productThumbnail: string | null
  originalPrice: number
  dealPrice: number
  discountPercent: number
  moq: number
  unit: string
  rating: number
  soldCount: number
  totalStock: number
  remainingStock: number
  supplierName: string
  supplierId: string
  supplierVerified: boolean
  categoryName: string
  endAt: string
}

interface CampaignItem {
  id: string
  name: string
  description: string | null
  type: string
  value: number
  minOrderAmount: number | null
  maxDiscount: number | null
  validUntil: string
  products: Array<{ id: string; name: string; unitPrice: number; unit: string; inStock: boolean; image: string | null }>
}

/** Human label for a campaign discount — only from real fields. */
function campaignDiscountLabel(c: CampaignItem): string | null {
  const t = (c.type || '').toLowerCase()
  if (t.includes('percent') || t.includes('percentage')) return `${c.value}% OFF`
  if (t.includes('fixed') || t.includes('flat') || t.includes('amount')) {
    const { formatPrice } = useCurrencyStore.getState()
    return `${formatPrice(c.value)} OFF`
  }
  return null
}

export function DealsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const [flashDeals, setFlashDeals] = useState<DealItem[]>([])
  const [dailyDeals, setDailyDeals] = useState<DealItem[]>([])
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        // Deals and campaigns are independent rails — one failing deals API
        // must not blank the campaigns section (and vice versa).
        const [dealsRes, promoRes] = await Promise.allSettled([
          fetch('/api/deals?limit=12'),
          fetch('/api/promotions'),
        ])

        if (cancelled) return

        let sawSuccess = false
        if (dealsRes.status === 'fulfilled' && dealsRes.value.ok) {
          const json = await dealsRes.value.json().catch(() => null)
          if (json?.success && json.data) {
            sawSuccess = true
            setFlashDeals(json.data.flashDeals || [])
            setDailyDeals(json.data.dailyDeals || [])
          }
        }
        if (promoRes.status === 'fulfilled' && promoRes.value.ok) {
          const json = await promoRes.value.json().catch(() => null)
          if (json?.success && Array.isArray(json.data)) {
            sawSuccess = true
            setCampaigns(json.data)
          }
        }
        if (!sawSuccess) setLoadError('Deals are unavailable right now. Please try again later.')
      } catch {
        if (!cancelled) setLoadError('Network error while loading deals.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Countdown ticks only while at least one deal is live — the target is the
  // soonest REAL expiry across flash + daily rails.
  const endsAt = useMemo(() => {
    const all = [...flashDeals, ...dailyDeals]
    if (all.length === 0) return null
    return all.reduce<Date>(
      (min, d) => (new Date(d.endAt) < min ? new Date(d.endAt) : min),
      new Date(all[0].endAt),
    )
  }, [flashDeals, dailyDeals])

  useEffect(() => {
    if (!endsAt) return
    const timer = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [endsAt])

  const timeLeft = useMemo(() => {
    if (!endsAt) return null
    const diff = Math.max(0, Math.floor((endsAt.getTime() - nowTs) / 1000))
    return {
      hours: Math.floor(diff / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
    }
  }, [endsAt, nowTs])

  const handleAddToCart = (e: React.MouseEvent, deal: DealItem) => {
    e.stopPropagation()
    // Same account wall as the PDP and flash deals — a guest never grows a cart.
    if (!useAuthStore.getState().isAuthenticated) {
      toast.error('Sign in to add products to your cart')
      navigate('login')
      return
    }
    addItem({
      id: deal.productId,
      productId: deal.productId,
      productName: deal.productName,
      productSlug: deal.productSlug,
      productImage: deal.productThumbnail,
      variantId: null,
      variantName: null,
      variantValue: null,
      unitPrice: deal.dealPrice,
      totalPrice: deal.dealPrice * deal.moq,
      quantity: deal.moq,
      moq: deal.moq,
      maxOrderQty: null,
      supplierId: deal.supplierId,
      supplierName: deal.supplierName,
      supplierSlug: deal.supplierId,
      unit: deal.unit,
      priceTiers: [],
    })
    toast.success(`Added ${deal.productName} to cart!`, {
      description: `Deal price applied — MOQ ${deal.moq} ${deal.unit}.`,
    })
  }

  const formatDigit = (num: number) => num.toString().padStart(2, '0')

  const renderDealCard = (deal: DealItem, idx: number, tag: 'flash' | 'daily') => {
    const claimedPercent = deal.totalStock > 0
      ? Math.min(100, Math.round(((deal.totalStock - deal.remainingStock) / deal.totalStock) * 100))
      : 100
    const stockText = claimedPercent >= 85
      ? 'Almost Gone'
      : claimedPercent >= 40
        ? `${claimedPercent}% Claimed`
        : `${deal.remainingStock} left`

    return (
      <motion.div
        key={deal.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.04, 0.4) }}
        onClick={() => navigate('product-detail', { productId: deal.productId })}
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
      >
        <div className="relative aspect-[16/9] w-full bg-muted">
          {deal.productThumbnail ? (
            <img src={deal.productThumbnail} alt={deal.productName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          <span className="absolute top-3 left-3 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
            {tag === 'flash' ? 'Flash' : 'Daily'}
          </span>
          <span className="absolute top-3 right-3 bg-primary text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded shadow">
            -{deal.discountPercent}%
          </span>
        </div>

        <div className="p-4">
          <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">{deal.productName}</h3>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            <span className="truncate max-w-[140px]">{deal.supplierName}</span>
            {deal.supplierVerified && <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />}
            <span className="shrink-0">· {deal.categoryName}</span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-black text-foreground">{formatPrice(deal.dealPrice)}</span>
            <span className="text-xs text-muted-foreground line-through">{formatPrice(deal.originalPrice)}</span>
            <span className="text-[11px] text-muted-foreground">/ {deal.unit}</span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>Stock Level</span>
              <span className="text-foreground font-semibold">{stockText}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${claimedPercent}%` }} />
            </div>
          </div>

          <button
            onClick={(e) => handleAddToCart(e, deal)}
            className="w-full mt-4 h-10 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart · MOQ {deal.moq} {deal.unit}
          </button>
        </div>
      </motion.div>
    )
  }

  const sectionHeader = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    onViewAll?: () => void,
  ) => (
    <div className="flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">{icon}</div>
        <div>
          <h2 className="text-base md:text-lg font-bold text-foreground leading-tight">{title}</h2>
          <p className="text-[11px] md:text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="shrink-0 text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )

  const isEmpty = !isLoading && !loadError && flashDeals.length === 0 && dailyDeals.length === 0 && campaigns.length === 0

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
              <BadgePercent className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black">Deals &amp; Sales</h1>
          </div>
          <p className="text-white/85 text-sm md:text-base max-w-2xl">
            Every live discount on Zylod in one place — flash deals, today&apos;s daily deals, and
            platform campaigns. Prices and stock come straight from the marketplace.
          </p>

          {timeLeft && (
            <div className="inline-flex items-center gap-2 mt-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2">
              <Clock className="h-4 w-4 text-white/80" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Soonest deal ends in</span>
              <span className="font-black tabular-nums text-white">
                {formatDigit(timeLeft.hours)}:{formatDigit(timeLeft.minutes)}:{formatDigit(timeLeft.seconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">
        {isLoading && <PageLoader label="Loading live deals…" />}

        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="w-8 h-8 text-primary" />
            <p className="text-sm text-foreground">{loadError}</p>
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <BadgePercent className="w-10 h-10 text-muted-foreground/60" />
            <h2 className="font-semibold text-foreground">No active deals right now</h2>
            <p className="text-sm text-muted-foreground max-w-[320px]">
              Nothing is on sale at this moment. New flash deals and campaigns go live regularly — check back soon.
            </p>
            <button
              onClick={() => navigate('all-products')}
              className="mt-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg"
            >
              Browse the full catalog
            </button>
          </div>
        )}

        {/* ─── Flash Deals ─── */}
        {!isLoading && flashDeals.length > 0 && (
          <section className="space-y-4">
            {sectionHeader(
              <Flame className="h-5 w-5" />,
              'Flash Deals',
              'Limited-time price drops — stock bars show real remaining inventory',
              () => navigate('flash-sale'),
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {flashDeals.map((d, i) => renderDealCard(d, i, 'flash'))}
            </div>
          </section>
        )}

        {/* ─── Daily Deals ─── */}
        {!isLoading && dailyDeals.length > 0 && (
          <section className="space-y-4">
            {sectionHeader(
              <CalendarDays className="h-5 w-5" />,
              "Today's Daily Deals",
              'Refreshed every day — active until midnight',
              () => navigate('daily-deals'),
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyDeals.map((d, i) => renderDealCard(d, i, 'daily'))}
            </div>
          </section>
        )}

        {/* ─── Platform Campaigns ─── */}
        {!isLoading && campaigns.length > 0 && (
          <section className="space-y-4">
            {sectionHeader(
              <Megaphone className="h-5 w-5" />,
              'Platform Campaigns',
              'Promotions currently running across the marketplace',
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((c, i) => {
                const label = campaignDiscountLabel(c)
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-sm md:text-base truncate">{c.name}</h3>
                        {c.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>
                        )}
                      </div>
                      {label && (
                        <span className="shrink-0 bg-primary/10 text-primary text-xs font-extrabold px-2.5 py-1 rounded-lg">
                          {label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Ends {new Date(c.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      {c.minOrderAmount != null && c.minOrderAmount > 0 && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> Min order {formatPrice(c.minOrderAmount)}
                        </span>
                      )}
                    </div>
                    {c.products.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {c.products.slice(0, 6).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => navigate('product-detail', { productId: p.id })}
                            className="shrink-0 w-24 text-left group"
                          >
                            <div className="aspect-square w-full rounded-lg bg-muted overflow-hidden border border-border">
                              {p.image ? (
                                <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageOff className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] font-medium text-foreground truncate mt-1">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatPrice(p.unitPrice)} / {p.unit}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        {/* ─── Deal destinations — all real pages ─── */}
        {!isLoading && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">More ways to save</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: 'Clearance & Liquidation', page: 'clearance' },
                { label: 'Seasonal Offers', page: 'seasonal-offers' },
                { label: 'Best Sellers', page: 'best-sellers' },
                { label: 'Coupons', page: 'coupons' },
                { label: 'New Arrivals', page: 'new-arrivals' },
              ].map((s) => (
                <button
                  key={s.page}
                  onClick={() => navigate(s.page)}
                  className="bg-card border border-border rounded-xl px-4 py-3 text-left text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {s.label}
                  <ChevronRight className="h-3.5 w-3.5 ml-1 inline" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default DealsPage
