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
      <div className="mx-auto w-full max-w-[1800px] 2xl:max-w-[1920px] px-2 sm:px-3 lg:px-4 xl:px-6 py-4 lg:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)_205px] xl:grid-cols-[185px_minmax(0,1fr)_215px] 2xl:grid-cols-[200px_minmax(0,1fr)_230px] gap-3 lg:gap-3.5 xl:gap-4 items-start">

          {/* LEFT — categories + supplier onboarding */}
          <LeftRail />

          {/* CENTER — hero + featured grid */}
          <div className="min-w-0 space-y-5 lg:space-y-6">
            <Hero />
            <FeaturedSection />
            {/* Inline CTAs only on mobile / small-tablet screens (<1024px) */}
            <div className="block lg:hidden pt-2">
              <RightRail variant="inline" />
            </div>
          </div>

          {/* RIGHT — CTA rail on desktop (lg+) */}
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
