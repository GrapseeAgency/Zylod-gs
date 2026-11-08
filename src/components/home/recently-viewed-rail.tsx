'use client'

/* ══════════════════════════════════════════════════════════════════════
   Recently Viewed rail (t291) — ONE component, TWO honest sources.

   • Signed-in buyers → GET /api/products/recently-viewed (Task 104's
     real `browsingHistory` table — the SAME source the dedicated
     Recently Viewed page reads; no second source of truth, per that
     route's doctrine). Clear/remove call the API and update optimistically.
   • Guests → the device-local store (use-recently-viewed.ts). The API
     is buyer-scoped by design (401 for guests), so a device-local
     history is the ONLY recently-viewed experience a guest can honestly
     have. It never syncs anywhere — privacy-positive, and it exists
     purely on the visitor's own browser.

   Honesty contract: the rail shows ONLY products this visitor actually
   opened. When the history is empty it renders NOTHING (the
   RelatedProductsRail precedent — an honest no-op, not an empty shell).
   No fabricated rows, no "popular now" masquerading as history.

   Detail polish (the mandate):
   • horizontal snap-scroll with the app's scrollbar-thin utility
   • per-card attached recency pill — "Viewed 3m ago" — real timestamps
   • Clear button with toast feedback; per-item remove on hover (desktop)
   • "View all" (buyers) → the full Recently Viewed page
   • excludeId lets the PDP embed the rail without showing the product
     currently open
   ══════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useState } from 'react'
import { History, Trash2, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  useRecentlyViewed,
  type RecentlyViewedItem,
} from '@/hooks/use-recently-viewed'
import { useAuthStore } from '@/store/auth-store'
import { useNavigationStore } from '@/store/navigation-store'
import { ProductCard } from '@/components/home/product-card'
import { cn } from '@/lib/utils'

/** Compact real recency label — buckets: <60s just now, <60m minutes,
 *  <24h hours, otherwise days. Single fixed vocabulary, no Intl churn. */
function viewedAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/** API row (Task 104 shapeRow: { id, viewedAt, product }) → card model. */
function mapServerRow(row: {
  id: string
  viewedAt: string
  product: {
    id: string
    name: string
    basePrice: number
    moq: number
    unit: string
    ratingAvg: number
    reviewCount: number
    thumbnailUrl: string | null
    supplier: { companyName: string; verificationStatus: string }
  }
}): RecentlyViewedItem {
  const p = row.product
  return {
    id: p.id,
    name: p.name,
    price: p.basePrice,
    moq: p.moq,
    unit: p.unit,
    ratingAvg: p.ratingAvg,
    reviewCount: p.reviewCount,
    thumbnailUrl: p.thumbnailUrl,
    supplierName: p.supplier?.companyName ?? null,
    supplierVerified:
      p.supplier?.verificationStatus === 'approved' ||
      p.supplier?.verificationStatus === 'verified',
    viewedAt: Date.parse(row.viewedAt) || Date.now(),
  }
}

interface RecentlyViewedRailProps {
  className?: string
  /** Product id to hide (the PDP passes its own product). */
  excludeId?: string | null
  /** Render nothing when history is empty (default true). */
  hideIfEmpty?: boolean
  maxItems?: number
}

export function RecentlyViewedRail({
  className,
  excludeId = null,
  hideIfEmpty = true,
  maxItems = 8,
}: RecentlyViewedRailProps) {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigationStore((s) => s.navigate)
  const { toast } = useToast()
  const { items: localItems, clear: clearLocal, remove: removeLocal } = useRecentlyViewed()

  // ── Server history (buyers only; null = not loaded yet) ──
  const [serverItems, setServerItems] = useState<RecentlyViewedItem[] | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setServerItems(null)
      return
    }
    let cancelled = false
    fetch('/api/products/recently-viewed?limit=8', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const rows = json?.success && Array.isArray(json.data) ? json.data : []
        setServerItems(rows.map(mapServerRow).filter(Boolean))
      })
      .catch(() => {
        if (!cancelled) setServerItems([])
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  // While a signed-in buyer's history is still loading, render nothing —
  // never flash the device-local list over the account's real history.
  const items = isAuthenticated ? serverItems ?? [] : localItems
  const visible = items.filter((i) => i.id !== excludeId).slice(0, maxItems)
  const loading = isAuthenticated && serverItems === null

  if (loading) return null
  if (visible.length === 0 && hideIfEmpty) return null

  const handleClear = async () => {
    const n = visible.length
    clearLocal()
    if (isAuthenticated) {
      // No productId param → the API clears ALL of the caller's rows.
      setServerItems([])
      try {
        await fetch('/api/products/recently-viewed', {
          method: 'DELETE',
          credentials: 'include',
        })
      } catch {
        toast({
          title: 'Could not clear server history',
          description: 'Check your connection and try again.',
          variant: 'destructive',
        })
        return
      }
    }
    toast({
      title: 'History cleared',
      description: `${n} item${n === 1 ? '' : 's'} removed from Recently Viewed.`,
    })
  }

  const handleRemove = async (item: RecentlyViewedItem) => {
    removeLocal(item.id)
    if (isAuthenticated) {
      setServerItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev))
      try {
        await fetch(`/api/products/recently-viewed?productId=${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      } catch {
        // Optimistic removal stays; the full page shows server truth on next load.
      }
    }
  }

  return (
    <section
      aria-label="Recently viewed products"
      className={cn('w-full', className)}
    >
      {/* ── Header ── */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-muted">
          <History className="h-4 w-4 text-gray-600 dark:text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-foreground">
          Recently Viewed
        </h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-muted dark:text-muted-foreground">
          {visible.length}
        </span>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => navigate('recently-viewed')}
            className="ml-auto flex h-8 items-center gap-1 px-2 text-[12px] font-semibold text-gray-600 hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className={cn(
            'h-8 gap-1.5 px-2 text-[12px] font-medium text-gray-500 hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground',
            isAuthenticated ? '' : 'ml-auto'
          )}
          aria-label="Clear recently viewed history"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </Button>
      </div>

      {/* ── Snap-scroll rail ── */}
      <div
        className="scrollbar-thin -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
        role="list"
      >
        {visible.map((item) => (
          <div
            key={item.id}
            role="listitem"
            className="group relative w-[46%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[18.5%] xl:w-[15.5%]"
          >
            <ProductCard product={item} />

            {/* per-item remove — desktop hover affordance */}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              aria-label={`Remove ${item.name} from recently viewed`}
              className="absolute right-1.5 top-11 hidden h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-500 opacity-0 shadow-sm transition-opacity hover:text-gray-900 focus:opacity-100 group-hover:opacity-100 md:flex dark:bg-background/90"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {/* recency caption — filled pill hugging the card's base */}
            <p className="-mt-0.5 inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-[3px] text-[10.5px] font-semibold text-gray-500 dark:bg-muted dark:text-muted-foreground">
              <History className="h-3 w-3 shrink-0" aria-hidden="true" />
              Viewed {viewedAgo(item.viewedAt)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
