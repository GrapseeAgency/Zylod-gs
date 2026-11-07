'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Gem, Flame, CalendarDays, ShieldCheck, ShoppingCart,
  Clock, ImageOff, AlertTriangle, Package, ChevronRight, BadgePercent,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'
import { PageLoader } from '@/components/ui/page-loader'

/**
 * exclusive-deal-detail renders a REAL deal from the live deals rail by id.
 *
 * HONESTY HISTORY: this page previously staged a fully fabricated "VIP Mill
 * Direct Deal" (invented cotton yarn lot, fake 480→360 BDT pricing, fake
 * Narayanganj mill origin) with fake "Lock VIP Allocation with SafePay
 * Escrow" purchase buttons. It was then de-faked into a static "No exclusive
 * deals published yet" wall — honest, but blind: the /dl/deal/<id> deep-link
 * route (t283) forwards REAL flash/daily deal ids here, and every one of them
 * landed on that empty wall while the deals page happily rendered the same
 * id (the t281 empty-surface class: surface exists, data exists, wiring
 * misses it — found live this round via /dl/deal/<real flash deal id>).
 *
 * The page now fetches /api/deals and renders the deal whose id matches the
 * pageParam (flash and daily rails both), with every number server-computed:
 * deal price, discount, stock bar, MOQ, rating, live end-time countdown.
 * No id → honest no-deal-selected wall; id not in the live rail → honest
 * not-found wall (deals are time-boxed — an expired deal is gone); network
 * failure → honest retry. The only fabricated string on this page is none.
 */

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
  categorySlug: string
  startAt: string
  endAt: string
}

type LoadState =
  | { phase: 'no-id' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'not-found'; id: string }
  | { phase: 'found'; deal: DealItem }

export function ExclusiveDealDetailPage() {
  const { goBack, navigate, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { addItem } = useCartStore()

  const dealId = pageParams.id || pageParams.dealId || pageParams.offerId || ''

  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    if (!dealId) {
      setState({ phase: 'no-id' })
      return
    }
    let cancelled = false
    setState({ phase: 'loading' })

    const load = async () => {
      try {
        // The rail caps at 50/page — one generous fetch covers the live window
        // (flash + daily rails are time-boxed; the live set is small by design).
        const res = await fetch('/api/deals?limit=50')
        if (cancelled) return
        if (!res.ok) {
          setState({ phase: 'error', message: `Deals service returned ${res.status}.` })
          return
        }
        const json = await res.json().catch(() => null)
        if (!json?.success || !json.data) {
          setState({ phase: 'error', message: 'Deals service returned an unreadable response.' })
          return
        }
        const all: DealItem[] = [
          ...(json.data.flashDeals || []),
          ...(json.data.dailyDeals || []),
        ]
        const deal = all.find((d) => d.id === dealId)
        if (!deal) {
          setState({ phase: 'not-found', id: dealId })
          return
        }
        setState({ phase: 'found', deal })
      } catch {
        if (!cancelled) setState({ phase: 'error', message: 'Network error while loading the deal.' })
      }
    }

    load()
    return () => { cancelled = true }
  }, [dealId, reloadToken])

  // Live clock only while a deal is on screen — the countdown and the honest
  // "ended" flip are the reason this tick exists.
  useEffect(() => {
    if (state.phase !== 'found') return
    const timer = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [state.phase])

  const countdown = useMemo(() => {
    if (state.phase !== 'found') return null
    const end = new Date(state.deal.endAt).getTime()
    const diff = end - nowTs
    if (diff <= 0) return { ended: true as const, label: 'Deal ended' }
    const totalSec = Math.floor(diff / 1000)
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    const label = hours >= 24
      ? `${Math.floor(hours / 24)}d ${hours % 24}h ${minutes.toString().padStart(2, '0')}m`
      : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    return { ended: false as const, label }
  }, [state, nowTs])

  const handleAddToCart = (deal: DealItem) => {
    if (!useAuthStore.getState().isAuthenticated) {
      toast.error('Sign in to add products to your cart')
      navigate('login')
      return
    }
    // Same payload shape as the deals page — the deal price and MOQ ride the
    // cart line exactly as they do on the deals grid.
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

  const renderFound = (deal: DealItem) => {
    const isFlash = deal.type === 'flash'
    const claimedPercent = deal.totalStock > 0
      ? Math.min(100, Math.round(((deal.totalStock - deal.remainingStock) / deal.totalStock) * 100))
      : 100
    // Availability gauge: the fill shows remaining stock (full bar = plenty
    // left, draining as the deal sells out) — reads instantly on a detail
    // view, unlike the grid's claimed% bar which starts at 0 and looks broken
    // on a fresh deal. The label still carries the claimed semantics.
    const remainingPercent = deal.totalStock > 0
      ? Math.max(0, Math.min(100, Math.round((deal.remainingStock / deal.totalStock) * 100)))
      : 0
    const stockText = claimedPercent >= 85
      ? 'Almost Gone'
      : claimedPercent >= 40
        ? `${claimedPercent}% Claimed`
        : `${deal.remainingStock} left`
    const savings = Math.max(0, deal.originalPrice - deal.dealPrice)
    const ended = countdown?.ended ?? false

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm"
      >
        <div className="relative aspect-[16/9] w-full bg-muted">
          {deal.productThumbnail ? (
            <img src={deal.productThumbnail} alt={deal.productName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
          <span className="absolute top-3 left-3 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1">
            {isFlash ? <Flame className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
            {isFlash ? 'Flash Deal' : 'Daily Deal'}
          </span>
          <span className="absolute top-3 right-3 bg-primary text-white text-xs font-extrabold px-2.5 py-0.5 rounded shadow flex items-center gap-1">
            <BadgePercent className="h-3.5 w-3.5" />
            -{deal.discountPercent}%
          </span>
          {ended && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="bg-white/95 dark:bg-card text-foreground text-sm font-bold px-4 py-2 rounded-xl shadow">
                This deal has ended
              </span>
            </div>
          )}
        </div>

        <div className="p-5 md:p-6 space-y-4">
          <div>
            <h2 className="font-black text-foreground text-base sm:text-lg md:text-xl leading-snug">{deal.productName}</h2>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span className="truncate max-w-[180px]">{deal.supplierName}</span>
              {deal.supplierVerified && (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
              <span className="shrink-0">· {deal.categoryName}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-2xl font-black text-foreground">{formatPrice(deal.dealPrice)}</span>
            <span className="text-sm text-muted-foreground line-through">{formatPrice(deal.originalPrice)}</span>
            <span className="text-xs text-muted-foreground">/ {deal.unit}</span>
            {savings > 0 && (
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Save {formatPrice(savings)} per {deal.unit}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border p-3.5 space-y-3 bg-background/60">
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>Stock Level</span>
                <span className="text-foreground font-semibold">{stockText}</span>
              </div>
              {/* Availability gauge — fill = remaining% (see comment above). */}
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${remainingPercent}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> MOQ {deal.moq} {deal.unit}
              </span>
              {deal.rating > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  ★ {deal.rating.toFixed(1)}
                  {deal.soldCount > 0 && <span className="text-muted-foreground/70">· {deal.soldCount} sold</span>}
                </span>
              )}
              <span className={'inline-flex items-center gap-1.5 font-semibold ' + (ended ? 'text-muted-foreground' : 'text-foreground')}>
                <Clock className="h-3.5 w-3.5" />
                {ended ? 'Deal ended' : `Ends in ${countdown?.label}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => navigate('product-detail', { productId: deal.productId })}
              className="h-11 border border-border hover:border-primary/40 active:scale-[0.98] text-foreground font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              View Product <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleAddToCart(deal)}
              disabled={ended}
              className="h-11 bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-primary-foreground font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart · MOQ {deal.moq} {deal.unit}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-neutral-400 pt-3 border-t border-border">
            Payments on Zylod are made by bank transfer or mobile banking (bKash/Nagad) — an order only advances once payment is verified.
          </p>
        </div>
      </motion.div>
    )
  }

  const renderEmpty = (title: string, body: string, showDealsCta: boolean) => (
    <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-4 text-center shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
        <Gem className="w-7 h-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-base sm:text-lg md:text-xl font-black text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">{body}</p>
      </div>
      {showDealsCta && (
        <button
          onClick={() => navigate('deals')}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-sm transition-all"
        >
          Browse live deals <ChevronRight className="h-4 w-4" />
        </button>
      )}
      <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
        Payments on Zylod are made by bank transfer or mobile banking (bKash/Nagad) — an order only advances once payment is verified.
      </p>
    </div>
  )

  let body: React.ReactNode
  if (state.phase === 'loading') {
    body = <PageLoader />
  } else if (state.phase === 'no-id') {
    body = renderEmpty(
      'No deal selected',
      'This screen shows one live deal when opened from a real deal link. Zylod does not stage demo deals or invented allocations.',
      true,
    )
  } else if (state.phase === 'error') {
    body = (
      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-4 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-base sm:text-lg font-black text-foreground">Could not load the deal</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{state.message}</p>
        <button
          onClick={() => setReloadToken((t) => t + 1)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-sm transition-all"
        >
          Try again
        </button>
      </div>
    )
  } else if (state.phase === 'not-found') {
    body = renderEmpty(
      'This deal is not live anymore',
      'Deals on Zylod are time-boxed — when a flash or daily deal ends, its link stops resolving. Browse the live deals grid for current price drops.',
      true,
    )
  } else {
    body = renderFound(state.deal)
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-gray-900 dark:text-white">
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-muted transition" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="font-bold text-base">Deal Detail</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto md:max-w-2xl w-full pb-24 md:pb-8 space-y-4">
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={goBack} className="inline-flex items-center gap-1 hover:text-foreground transition">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        {body}
      </div>
    </div>
  )
}

export default ExclusiveDealDetailPage
