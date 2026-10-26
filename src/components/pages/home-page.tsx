'use client'

import React, { useState, useEffect, Suspense, lazy } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileHomePage } from '@/components/mobile/mobile-home-page'
import { useProductStore } from '@/store/product-store'
import { PageLoader } from '@/components/ui/page-loader'
import { CategorySidebar } from '@/components/home/category-sidebar'
import { HomeHero } from '@/components/home/home-hero'
import { FeaturedProducts } from '@/components/home/featured-products'

/* ─── Lazy-loaded secondary sections (below the fold, function preserved) ─── */
const BannerCarousel = lazy(() =>
  import('@/components/home/banner-carousel').then((m) => ({ default: m.BannerCarousel }))
)
const CategoryTabsAndProducts = lazy(() =>
  import('@/components/home/category-tabs-products').then((m) => ({ default: m.CategoryTabsAndProducts }))
)
const RightSidebar = lazy(() =>
  import('@/components/home/right-sidebar').then((m) => ({ default: m.RightSidebar }))
)

function SectionFallback() {
  return <PageLoader className="min-h-0 py-12" />
}

/* ─── t210-r2: Desktop home rebuilt 1:1 against the user's mockup ───
   [240px categories rail] [hero + featured grid] [300px CTA rail],
   crimson #E31C3D, off-white page bg. The banner carousel and the
   search-tabs section are preserved BELOW the fold (function, not noise). */
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
    <div className="w-full bg-[#F7F8FA] dark:bg-background min-h-screen">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-5 py-5">
        <div className="flex gap-5 items-start">

          {/* ═══════════ LEFT: categories rail ═══════════ */}
          <CategorySidebar />

          {/* ═══════════ CENTER: hero + featured grid ═══════════ */}
          <main className="flex-1 min-w-0 space-y-8">
            <HomeHero />

            <Suspense fallback={<SectionFallback />}>
              <FeaturedProducts />
            </Suspense>

            {/* Below the fold — real marketplace function */}
            <Suspense fallback={<SectionFallback />}>
              <BannerCarousel />
            </Suspense>
            <Suspense fallback={<SectionFallback />}>
              <CategoryTabsAndProducts />
            </Suspense>
          </main>

          {/* ═══════════ RIGHT: CTA rail ═══════════ */}
          <Suspense fallback={<SectionFallback />}>
            <RightSidebar />
          </Suspense>

        </div>
      </div>
    </div>
  )
}

/* ─── Main HomePage — switches between mobile and desktop ─── */
export function HomePage() {
  const isMobile = useIsMobile()

  if (isMobile === undefined) {
    return <PageLoader />
  }

  if (isMobile) {
    return <MobileHomePage />
  }

  return <DesktopHomePage />
}

export default HomePage
