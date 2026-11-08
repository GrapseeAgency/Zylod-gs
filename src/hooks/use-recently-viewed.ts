'use client'

/* ══════════════════════════════════════════════════════════════════════
   Recently Viewed store (t291) — a real, persisted browsing-history
   feature for the marketplace. Every product-detail page records its
   product here on load; Home + PDP render the "Recently Viewed" rail
   from the same store, so a buyer who compared five supplier lots
   today can hop straight back to any of them.

   Design:
   • localStorage `zylod:recently-viewed:v1` — newest first, deduped by
     product id, capped at MAX_ITEMS (12). No backend round-trip: the
     buyer's own device holds their own history (privacy-positive, and
     it works for guests — the majority of first-session buyers).
   • Cross-component sync via a window CustomEvent + the `storage`
     event, so recording a view on the PDP updates the Home rail live
     without any global state library.
   • SSR-safe: reads happen inside effects only; the server render sees
     an empty list and the rail renders nothing (its hideIfEmpty
     contract) — zero hydration mismatch surface.
   • Every persisted row is validated on read; malformed or fabricated
     entries are dropped, never rendered.
   ══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import type { HomeProduct } from '@/components/home/product-card'

const STORAGE_KEY = 'zylod:recently-viewed:v1'
const CHANGE_EVENT = 'zylod:recently-viewed-changed'
export const MAX_RECENTLY_VIEWED = 12

export interface RecentlyViewedItem extends HomeProduct {
  viewedAt: number
}

/** Narrow validator — one bad row (or a hand-edited localStorage) must
 *  never break the rail. Required: string id/name, finite price/moq. */
function isValidItem(v: unknown): v is RecentlyViewedItem {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    typeof r.name === 'string' &&
    r.name.length > 0 &&
    typeof r.price === 'number' &&
    Number.isFinite(r.price) &&
    typeof r.moq === 'number' &&
    Number.isFinite(r.moq) &&
    typeof r.viewedAt === 'number' &&
    Number.isFinite(r.viewedAt)
  )
}

function readStore(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidItem)
  } catch {
    return []
  }
}

function writeStore(items: RecentlyViewedItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Quota errors / private-mode restrictions: history is best-effort
    // by design — the rail just stays empty rather than erroring.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

/** Record one product view. Called from the PDP once its product row
 *  resolves; re-recording the same product bumps it to the front (and
 *  refreshes its viewedAt) instead of duplicating the row. */
export function recordProductView(p: HomeProduct) {
  if (typeof window === 'undefined') return
  if (!p || typeof p.id !== 'string' || p.id.length === 0) return
  const rest = readStore().filter((i) => i.id !== p.id)
  writeStore([{ ...p, viewedAt: Date.now() }, ...rest].slice(0, MAX_RECENTLY_VIEWED))
}

/** Subscribe to the history. `items` is [] during SSR and the first
 *  client render, then hydrates from localStorage inside an effect. */
export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([])

  useEffect(() => {
    const sync = () => setItems(readStore())
    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const clear = useCallback(() => {
    writeStore([])
  }, [])

  const remove = useCallback((id: string) => {
    writeStore(readStore().filter((i) => i.id !== id))
  }, [])

  return { items, clear, remove }
}
