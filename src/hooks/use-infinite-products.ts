'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/* ════════════════════════════════════════════════════════════════════
   Shared social-media-style infinite scroll.

   Ported from the proven featured-section.tsx implementation (t228/t229):
   - IntersectionObserver on a sentinel div with rootMargin '400px 0px'
   - passive scroll fallback for fast scrolls that skip the sentinel's
     intersection transitions (jump-proofing, t229f)
   - id-dedupe append (t228b: the FINAL page is appended too; hasMore is
     computed independently from the API's pagination)
   - loadingRef guard against concurrent sentinel/button double-fetches
   ════════════════════════════════════════════════════════════════════ */

/** One page of results from a paginated list endpoint. */
export interface InfinitePage<T> {
  data: T[]
  pagination: {
    page: number
    total: number
    totalPages: number
    limit?: number
  }
}

/** Fetches one page; should throw on HTTP/network failure. */
export type InfinitePageFetcher<T> = (page: number) => Promise<InfinitePage<T>>

export interface UseInfiniteProductsResult<T> {
  /** All rows loaded so far (first page + every appended page). */
  items: T[]
  /** Escape hatch for pages that need to seed/patch rows (e.g. wishlist state). */
  setItems: React.Dispatch<React.SetStateAction<T[]>>
  /** True while the FIRST page is loading. */
  loading: boolean
  /** True while an appended page is loading. */
  loadingMore: boolean
  /** True when the API says more pages exist. */
  hasMore: boolean
  /** Attach to a div rendered at the end of the list (while hasMore is true). */
  sentinelRef: React.RefObject<HTMLDivElement | null>
  /** Fetches the next page and appends it (deduped). Safe to call repeatedly. */
  loadMore: () => Promise<void>
  /** True when the first page failed to load. */
  failed: boolean
  /** Re-runs the first-page fetch. */
  reload: () => void
}

/** Default row identity for the append dedupe: the `id` field. */
function defaultKeyOf<T>(item: T): string {
  const id = (item as { id?: unknown } | null)?.id
  return id === undefined || id === null ? '' : String(id)
}

/**
 * Observer-only infinite scroll: attach the returned ref to a sentinel div
 * at the end of your list; `onVisible` fires whenever the sentinel enters
 * the 400px pre-fetch margin (IntersectionObserver) or the user scrolls
 * within 400px of it (passive fallback for fast scrolls).
 *
 * `active` should be true exactly when the sentinel is rendered and more
 * content can be loaded. `onVisible` should be a `useCallback` whose
 * identity changes when the list grows, so the observer re-arms and keeps
 * loading while the sentinel stays on screen.
 */
export function useInfiniteScrollSentinel(
  onVisible: () => void,
  active: boolean,
): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!active) return
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible()
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(el)

    // Jump-proofing (t229f): a fast scroll (End key, scrollbar drag) can
    // skip the sentinel's intersection transitions and land below it where
    // the observer never fires, silently ending the feed. A passive scroll
    // listener recomputes the geometric condition on every scroll event;
    // the load callback's own guard prevents duplicate fetches.
    const onScroll = () => {
      if (el.getBoundingClientRect().top <= window.innerHeight + 400) onVisible()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [active, onVisible])

  return sentinelRef
}

/**
 * Full infinite-scroll state machine: loads the first page on mount (and
 * on `reload()`), then appends further pages — deduped by `keyOf` (the
 * `id` field by default) — via `loadMore()`, which is driven automatically
 * by the sentinel observer and can also be wired to a manual "Load more"
 * button fallback.
 *
 * The fetcher is captured by ref, so callers may pass an inline closure
 * without triggering refetch loops; it should be stable if you expect a
 * changed fetcher (e.g. new query params) to restart the feed — or call
 * `reload()` after remounting with a `key`.
 */
export function useInfiniteProducts<T>(
  fetcher: InfinitePageFetcher<T>,
  initialPage = 1,
  keyOf: (item: T) => string = defaultKeyOf,
): UseInfiniteProductsResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const pageRef = useRef(initialPage)
  const loadingRef = useRef(false) // guards against concurrent double-fetches

  // Keep the latest fetcher/keyOf without making the first-page effect
  // re-run on every render (callers may pass inline closures).
  const fetcherRef = useRef(fetcher)
  const keyOfRef = useRef(keyOf)
  useEffect(() => {
    fetcherRef.current = fetcher
    keyOfRef.current = keyOf
  })

  // First page — replaces the list (also the reload path).
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setFailed(false)
      setHasMore(false)
      try {
        const res = await fetcherRef.current(initialPage)
        if (cancelled) return
        const rows = Array.isArray(res?.data) ? res.data : []
        const pag = res?.pagination
        setItems(rows)
        pageRef.current = initialPage
        setHasMore(Boolean(pag && pag.page < pag.totalPages))
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadTick, initialPage])

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return
    if (loading || !hasMore) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      const res = await fetcherRef.current(nextPage)
      const rows = Array.isArray(res?.data) ? res.data : []
      const key = keyOfRef.current
      const seen = new Set(items.map(key).filter(Boolean))
      // t228b: append whatever is NEW — including the FINAL page (a
      // `page < totalPages` gate would discard the last page's rows).
      // hasMore is computed independently: true only if the API says more
      // pages exist after the one just consumed.
      const fresh = rows.filter((row) => {
        const k = key(row)
        return k === '' || !seen.has(k)
      })
      const pag = res?.pagination
      if (fresh.length > 0) {
        setItems((prev) => [...prev, ...fresh])
        pageRef.current = nextPage
      }
      setHasMore(Boolean(pag && pag.page < pag.totalPages))
    } catch {
      // best-effort — keep what we have; the sentinel can retry on re-entry
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [hasMore, items, loading])

  const onVisible = useCallback(() => {
    void loadMore()
  }, [loadMore])

  const sentinelRef = useInfiniteScrollSentinel(onVisible, hasMore && !loading && !failed)

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1)
  }, [])

  return { items, setItems, loading, loadingMore, hasMore, sentinelRef, loadMore, failed, reload }
}
