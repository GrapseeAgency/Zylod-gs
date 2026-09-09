'use client'

import React, { useState, useEffect, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CategorySidebar } from '@/components/home/category-sidebar'
import { HomeLoadingScreen } from '@/components/shared/loading-skeletons'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileHomePage } from '@/components/mobile/mobile-home-page'
import { useProductStore } from '@/store/product-store'

/* ─── Lazy-loaded heavy sub-components ─── */
const CategoryTabsAndProducts = lazy(() =>
  import('@/components/home/category-tabs-products').then((m) => ({ default: m.CategoryTabsAndProducts }))
)
const RightSidebar = lazy(() =>
  import('@/components/home/right-sidebar').then((m) => ({ default: m.RightSidebar }))
)

/* ─── Loading fallback ─── */
function SectionFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
    </div>
  )
}

/* ─── Stagger configuration ─── */
// Each column reveals with a staggered delay
const STAGGER_CONFIG = {
  left: { delay: 0, duration: 0.5 },
  center: { delay: 0.2, duration: 0.5 },
  right: { delay: 0.4, duration: 0.5 },
}

// Fade-in + subtle slide-up animation variants
const fadeInVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (custom: { delay: number; duration: number }) => ({
    opacity: 1,
    y: 0,
    transition: {
      opacity: { duration: custom.duration, delay: custom.delay, ease: 'easeOut' as const },
      y: { duration: custom.duration, delay: custom.delay, ease: 'easeOut' as const },
    },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

/* ─── Desktop Home Page (3-column layout) ─── */
function DesktopHomePage() {
  const { isInitialized, isLoading, initialize } = useProductStore()
  const [showSkeleton, setShowSkeleton] = useState(true)

  /* ─── Initialize product store from API on mount ─── */
  useEffect(() => {
    initialize()
  }, [initialize])

  /* ─── Hide skeleton once initialized ─── */
  useEffect(() => {
    if (isInitialized && !isLoading) {
      // Small delay for smooth transition
      const timer = setTimeout(() => setShowSkeleton(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isInitialized, isLoading])

  return (
    <div className="w-full bg-background">
      {showSkeleton ? (
        /* ─── NEW loading screen while products initialize ─── */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <HomeLoadingScreen />
        </motion.div>
      ) : (
        <div className="max-w-[1440px] mx-auto px-4 py-4">
          <div className="flex gap-4">

            {/* ═══════════ COLUMN A: LEFT SIDEBAR ═══════════ */}
            <AnimatePresence mode="wait">
              <motion.div
                key="left-content"
                initial="hidden"
                animate="visible"
                exit="exit"
                custom={STAGGER_CONFIG.left}
                variants={fadeInVariants}
              >
                <CategorySidebar />
              </motion.div>
            </AnimatePresence>

            {/* ═══════════ COLUMN B: CENTER CONTENT ═══════════ */}
            <AnimatePresence mode="wait">
              <motion.div
                key="center-content"
                initial="hidden"
                animate="visible"
                exit="exit"
                custom={STAGGER_CONFIG.center}
                variants={fadeInVariants}
                className="flex-1 min-w-0"
              >
                <Suspense fallback={<SectionFallback />}>
                  <CategoryTabsAndProducts />
                </Suspense>
              </motion.div>
            </AnimatePresence>

            {/* ═══════════ COLUMN C: RIGHT SIDEBAR ═══════════ */}
            <AnimatePresence mode="wait">
              <motion.div
                key="right-content"
                initial="hidden"
                animate="visible"
                exit="exit"
                custom={STAGGER_CONFIG.right}
                variants={fadeInVariants}
              >
                <Suspense fallback={<SectionFallback />}>
                  <RightSidebar />
                </Suspense>
              </motion.div>
            </AnimatePresence>

          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main HomePage — switches between mobile and desktop ─── */
export function HomePage() {
  const isMobile = useIsMobile()

  // During SSR / initial hydration, isMobile is undefined
  // Show a loading state to avoid layout shift
  if (isMobile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (isMobile) {
    return <MobileHomePage />
  }

  return <DesktopHomePage />
}

export default HomePage
