'use client'

/**
 * ══════════════════════════════════════════════════════════════
 *  SKELETON LOADING SYSTEM — pixel-mirrors of the real components
 *  Every skeleton below is modeled 1:1 on the actual JSX of the
 *  component it stands in for, using design tokens only so it is
 *  correct in light mode AND the Hot Deals dark palette.
 * ══════════════════════════════════════════════════════════════
 */

/* ─── Base shimmer block ─── */
function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />
}

/* ─── Desktop product card skeleton ───
   1:1 mirror of MainProductCard:
   rounded-lg card · h-[150px] image · 2-line title ·
   price + strikethrough · MOQ / sold row */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Image — h-[150px] like the real card */}
      <div className="h-[150px] bg-muted flex items-center justify-center">
        <Shimmer className="h-14 w-14 !rounded-2xl" />
      </div>
      <div className="p-3">
        {/* Name — 2 lines, text-xs */}
        <div className="space-y-1 mb-1.5">
          <Shimmer className="h-3 w-11/12" />
          <Shimmer className="h-3 w-3/5" />
        </div>
        {/* Price + original price */}
        <div className="flex items-baseline gap-1.5 mb-1">
          <Shimmer className="h-3.5 w-1/3 rounded" />
          <Shimmer className="h-2.5 w-1/5 rounded" />
        </div>
        {/* MOQ + sold */}
        <div className="flex items-center justify-between">
          <Shimmer className="h-2.5 w-1/4 rounded" />
          <Shimmer className="h-2.5 w-1/5 rounded" />
        </div>
      </div>
    </div>
  )
}

/* ─── Mobile product card skeleton ───
   1:1 mirror of MobileProductCard:
   bg-card rounded-md (no border) · 5:6 image · compact text:
   2-line name · red price + "sold" */
export function ProductCardSkeletonCompact() {
  return (
    <div className="w-full bg-card rounded-md overflow-hidden">
      <div className="bg-muted" style={{ aspectRatio: '5/6' }} />
      <div className="px-1.5 pt-1 pb-1.5">
        <div className="space-y-1">
          <Shimmer className="h-2.5 w-11/12" />
          <Shimmer className="h-2.5 w-2/3" />
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <Shimmer className="h-3 w-1/3 rounded" />
          <Shimmer className="h-2 w-1/6 rounded" />
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   DESKTOP HOME LOADING SCREEN — mirrors the real 3-column layout:
   Left: CategorySidebar (red header + category rows)
   Center: tabbed search card → category tab pills → product grid
   Right: widget cards
   ══════════════════════════════════════════════════════════════ */
export function HomeLoadingScreen() {
  return (
    <div className="w-full bg-background">
      <div className="max-w-[1440px] mx-auto px-4 py-4">
        <div className="flex gap-4">

          {/* ── Column A: Category sidebar ── */}
          <aside className="hidden lg:block w-[220px] shrink-0 space-y-3">
            <div className="border border-border/60 bg-card rounded-lg overflow-hidden">
              {/* Red "All Categories" header */}
              <div className="px-4 py-3 bg-primary">
                <Shimmer className="h-4 w-[120px] bg-white/30" />
              </div>
              {/* Category rows */}
              <div className="py-0.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-3.5 py-2">
                    <Shimmer className="h-4 w-4 !rounded" />
                    <Shimmer className="h-3.5 flex-1" />
                    <Shimmer className="h-3 w-3 !rounded-sm" />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Column B: Center content ── */}
          <main className="flex-1 min-w-0 space-y-3">

            {/* SECTION 1: Tabbed search card (mirrors CategoryTabsAndProducts §1) */}
            <div className="border border-border/60 bg-card rounded-lg overflow-hidden">
              {/* Search tabs row with active red underline */}
              <div className="flex items-center border-b border-border/60">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2 px-5 py-3 relative">
                    <Shimmer className={`h-4 w-4 !rounded ${i === 0 ? 'bg-primary/40' : ''}`} />
                    <Shimmer className={`h-3.5 w-14 ${i === 0 ? 'bg-primary/30' : ''}`} />
                    {i === 0 && (
                      <div className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-primary" />
                    )}
                  </div>
                ))}
              </div>
              {/* Search input + red button row */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 flex items-center">
                  <div className="flex-1 h-11 skeleton-shimmer !rounded-l-md border-2 border-primary border-r-0" />
                  <div className="h-11 w-24 bg-primary rounded-r-md" />
                </div>
                <Shimmer className="h-11 w-11 !rounded-md" />
                <Shimmer className="h-11 w-11 !rounded-md" />
              </div>
            </div>

            {/* SECTION 2: Category tab pills + product grid */}
            <div className="border border-border/60 bg-card rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 overflow-hidden">
                <Shimmer className="h-7 w-24 !rounded-full bg-primary/30" />
                {[0, 1, 2, 3, 4].map((i) => (
                  <Shimmer key={i} className="h-7 w-20 !rounded-full" />
                ))}
              </div>

              <div className="p-4 pt-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </main>

          {/* ── Column C: Right widgets ── */}
          <aside className="hidden xl:block w-[280px] shrink-0 space-y-3">
            {[0, 1, 2, 3].map((w) => (
              <div key={w} className="border border-border/60 bg-card rounded-lg p-4 space-y-2.5">
                <Shimmer className="h-4 w-24" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Shimmer className="h-8 w-8 !rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <Shimmer className="h-3 w-4/5" />
                      <Shimmer className="h-2.5 w-3/5" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </aside>

        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MOBILE HOME LOADING SCREEN — mirrors the real section stack:
   TopNav → MobileSearchBar (card + tool chips) → CategoryPills →
   PromoIconGrid (card w/ header + h-11 icons) → SubsidySection
   (58px square tiles) → ProductGrid (compact cards)
   ══════════════════════════════════════════════════════════════ */
export function MobileHomeLoading() {
  return (
    <div className="min-h-screen bg-background pb-[calc(64px+env(safe-area-inset-bottom)+16px)]">
      {/* ── Top nav bar (h-12, like MobileTopNav) ── */}
      <div className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-4 h-12 bg-background border-b border-border/50">
        <div className="flex items-center gap-2">
          <Shimmer className="w-[18px] h-[18px] !rounded" />
          <Shimmer className="h-5 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="w-[18px] h-[18px] !rounded-lg" />
          <Shimmer className="w-[18px] h-[18px] !rounded-lg" />
        </div>
      </div>

      <main className="pt-12 px-3">
        {/* ── Search bar (bg-card rounded-xl border h-10 + camera divider) ── */}
        <section className="mt-2">
          <div className="flex items-center bg-card rounded-xl border border-border/60 px-3 h-10">
            <Shimmer className="w-4 h-4 !rounded-full" />
            <div className="flex-1 ml-2">&nbsp;</div>
            <div className="flex items-center ml-1 border-l border-border/60 pl-2">
              <Shimmer className="w-4 h-4 !rounded-sm" />
            </div>
          </div>
          {/* Search tools chips row */}
          <div className="flex gap-1.5 mt-2 overflow-hidden">
            {['w-[74px]', 'w-[62px]', 'w-[86px]', 'w-[60px]', 'w-[44px]', 'w-[78px]'].map((w, i) => (
              <Shimmer key={i} className={`h-6 ${w} !rounded-full flex-none`} />
            ))}
          </div>
        </section>

        {/* ── Category pills (first active red) ── */}
        <section className="mt-3">
          <div className="flex gap-1.5 overflow-hidden py-1">
            <Shimmer className="h-7 w-20 !rounded-full bg-primary/40 flex-none" />
            {['w-16', 'w-20', 'w-14', 'w-24', 'w-16', 'w-20'].map((w, i) => (
              <Shimmer key={i} className={`h-7 ${w} !rounded-full flex-none`} />
            ))}
          </div>
        </section>

        {/* ── Quick Access card (header + icon row, mirrors MobilePromoIconGrid) ── */}
        <section className="mt-4">
          <div className="bg-card rounded-xl border border-border/50 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-2.5 w-8 bg-primary/30 rounded" />
            </div>
            <div className="flex gap-1 overflow-hidden pb-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]">
                  <Shimmer className="h-11 w-11 !rounded-2xl" />
                  <Shimmer className="h-2 w-12" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Deals row (58px square tiles + price, mirrors MobileSubsidySection) ── */}
        <section className="mt-3">
          <div className="flex gap-1.5 overflow-hidden pb-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-none w-[58px]">
                <div className="skeleton-shimmer aspect-square rounded-md" />
                <Shimmer className="h-2 w-10 mt-0.5 rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* ── Product grid heading + grid (mirrors MobileProductGrid) ── */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-4">
            <Shimmer className="h-6 w-36" />
            <div className="flex items-center gap-2">
              <Shimmer className="h-7 w-16 !rounded-lg" />
              <Shimmer className="h-7 w-16 !rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeletonCompact key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
