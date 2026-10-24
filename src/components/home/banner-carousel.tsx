'use client'

/**
 * BannerCarousel — the storefront READ half of the admin content rail
 * (Task 89). Serves REAL rows from GET /api/banners?position=home_top —
 * rows admins created in the admin content console (banners table), never
 * hardcoded or invented slides.
 *
 * Behavior:
 * - Fetches on mount + a 30s background poll (banners change rarely; the
 *   poll is the honest degradation path — there is no banner room in the
 *   realtime vocabulary).
 * - Auto-rotates every 5s, pauses while hovered or while a dialog/tab is
 *   hidden, wraps around; dots + prev/next arrows + touch swipe.
 * - A slide with a linkPageId navigates through the platform's in-memory
 *   navigation store (linkParams appended verbatim as the ?page= deep link
 *   the platform already accepts); a slide without one is display-only.
 * - Renders NOTHING while loading or when there are zero scheduled banners
 *   — an empty rail never becomes fake content.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'

export interface PublicBanner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  linkPageId: string | null
  linkParams: string | null
  position: string
  sortOrder: number
}

const ROTATE_MS = 5_000
const POLL_MS = 30_000

export function BannerCarousel() {
  const navigate = useNavigationStore((s) => s.navigate)
  const [banners, setBanners] = useState<PublicBanner[]>([])
  const [loaded, setLoaded] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const swipeStartX = useRef<number | null>(null)

  const load = useCallback(async (background: boolean) => {
    try {
      const res = await fetch('/api/banners?position=home_top', { credentials: 'include' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        const rows: PublicBanner[] = Array.isArray(json.data?.banners) ? json.data.banners : []
        setBanners(rows)
        setIndex((i) => (rows.length ? Math.min(i, rows.length - 1) : 0))
      }
    } catch {
      // Network hiccup: keep the last good rows on background refreshes.
      if (!background) setBanners([])
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load(false)
    const id = setInterval(() => {
      if (!document.hidden) load(true)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (paused || banners.length < 2 || document.hidden) return
    const id = setInterval(() => setIndex((i) => (i + 1) % banners.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [paused, banners.length])

  if (!loaded) {
    return (
      <div className="relative w-full h-32 sm:h-44 rounded-xl overflow-hidden bg-muted animate-pulse" aria-hidden />
    )
  }

  if (banners.length === 0) return null

  const current = banners[index]
  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + banners.length) % banners.length)

  const open = () => {
    if (!current.linkPageId) return
    // linkParams is a raw query string from the admin; parse it into the
    // navigation store's params object (invalid pairs are dropped, honest).
    const params: Record<string, string> = {}
    if (current.linkParams) {
      for (const pair of current.linkParams.replace(/^\?/, '').split('&')) {
        const [k, v] = pair.split('=')
        if (k) params[k] = v ?? ''
      }
    }
    navigate(current.linkPageId, params)
  }

  return (
    <section
      aria-label="Promotional banners"
      className="relative w-full h-32 sm:h-44 rounded-xl overflow-hidden group bg-neutral-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        swipeStartX.current = e.touches[0].clientX
        setPaused(true)
      }}
      onTouchEnd={(e) => {
        const start = swipeStartX.current
        swipeStartX.current = null
        setPaused(false)
        if (start === null) return
        const dx = e.changedTouches[0].clientX - start
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0"
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${banners.length}: ${current.title}`}
        >
          {/* Plain <img>: banner URLs are admin-supplied arbitrary hosts —
              next/image remote-pattern whitelisting would reject them. */}
          <img
            src={current.imageUrl}
            alt={current.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <button
            type="button"
            onClick={open}
            className={`absolute inset-0 flex flex-col justify-end p-4 text-left ${current.linkPageId ? 'cursor-pointer' : 'cursor-default'}`}
            aria-label={current.linkPageId ? `${current.title} — open` : current.title}
          >
            <h3 className="text-white font-bold text-base sm:text-xl drop-shadow line-clamp-1">{current.title}</h3>
            {current.subtitle && (
              <p className="text-white/85 text-xs sm:text-sm line-clamp-1 drop-shadow">{current.subtitle}</p>
            )}
          </button>
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous banner"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next banner"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 right-3 flex gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50 dark:bg-gray-900/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** Compact skeleton used where the carousel has not loaded yet. */
export function BannerCarouselSkeleton() {
  return <div className="w-full h-24 rounded-xl bg-muted animate-pulse" aria-hidden />
}
