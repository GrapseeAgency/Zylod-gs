'use client'

import React, { useState, useEffect } from 'react'
import { useProductStore } from '@/store/product-store'
import { PageLoader } from '@/components/ui/page-loader'
import { Hero } from '@/components/home/hero'
import { LeftRail } from '@/components/home/left-rail'
import { FeaturedSection } from '@/components/home/featured-section'
import { RightRail } from '@/components/home/right-rail'

/* ════════════════════════════════════════════════════════════════════
   HomePage — t211 full rebuild against the owner's mockup.

   One responsive layout (no separate "old" mobile home, no legacy
   sections below the fold — the t210 "old design at the bottom" bug):

   ┌──────────┬──────────────────────────────┬───────────────┐
   │ 240px    │  Hero (pale-pink card)       │ 300px right   │
   │ left     │  Featured Products grid      │ rail (xl+)    │
   │ rail     │                              │               │
   └──────────┴──────────────────────────────┴───────────────┘

   • lg (1024+): left rail joins.  xl (1280+): right rail joins.
   • <xl the right-rail cards flow under the grid (nothing dropped).
   • Every element is real: real products, real categories, real
     navigation, real wishlist, real registration/contact targets.
   ════════════════════════════════════════════════════════════════════ */

function DesktopHomePage() {
  const { isInitialized, isLoading, initialize } = useProductStore()
  const [showSkeleton, setShowSkeleton] = useState(true)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isInitialized && !isLoading) {
      const timer = setTimeout(() => setShowSkeleton(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isInitialized, isLoading])

  if (showSkeleton) {
    return <PageLoader />
  }

  return (
    <div className="w-full bg-white dark:bg-background">
      <div className="mx-auto w-full max-w-[1536px] px-3 sm:px-4 lg:px-6 py-4 lg:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_300px] gap-4 xl:gap-5 items-start">

          {/* LEFT — categories + supplier onboarding (240px, mockup) */}
          <LeftRail />

          {/* CENTER — hero + featured grid (+ inline CTAs below xl) */}
          <div className="min-w-0 space-y-6 lg:space-y-7">
            <Hero />
            <FeaturedSection />
            <RightRail variant="inline" />
          </div>

          {/* RIGHT — CTA rail (300px, mockup) */}
          <RightRail variant="rail" />

        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  return <DesktopHomePage />
}

export default HomePage
