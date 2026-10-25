'use client'

/**
 * STORE THEME CUSTOMIZER — Task 176-c. The previous page rendered a color
 * input (`<input type="color" defaultValue="#C8102E">`) and an "Apply Theme"
 * button with NO onClick handler — pure showcase. No storefront brand-color
 * writer rail exists on Zylod (the storefront customization API stores
 * bannerUrl / featuredProductIds / customSections but NOT a brand color).
 *
 * This rewrite is an honest empty state. The page also shipped a bare
 * `<button>← Back</button>` with no shadcn styling and a hardcoded
 * `bg-white dark:bg-gray-900` block — kept consistent with the rest of the
 * seller console. The three real storefront-customization surfaces (banner,
 * featured products, company story) are linked as the honest "what you CAN
 * customize today" path.
 */
import React from 'react'
import { ArrowLeft, Palette, Image as ImageIcon, Star, Building2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useNavigationStore } from '@/store/navigation-store'

const REAL_SURFACES = [
  {
    id: 'store-banner-editor',
    title: 'Storefront hero banner',
    desc: 'Upload and arrange your promotional carousel slides — image URL, title, subtitle and target link.',
    icon: ImageIcon,
  },
  {
    id: 'store-featured-products',
    title: 'Featured products',
    desc: 'Pin up to 8 of your top SKUs to the storefront spotlight and reorder them by priority.',
    icon: Star,
  },
  {
    id: 'store-story-about',
    title: 'Company story & factory profile',
    desc: 'Edit your factory specs, export markets, certifications and machinery list — the trust story buyers read.',
    icon: Building2,
  },
] as const

export function StoreThemeCustomizerPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} aria-label="Go back" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="font-bold text-base">Theme Options</h1>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 py-6 md:py-8 md:px-6 space-y-5 pb-24 md:pb-8">
        <div className="hidden md:block">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-2 text-xs font-semibold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-black mt-2">Theme Options</h1>
          <p className="text-xs text-muted-foreground mt-0.5">What you can and cannot customize on your storefront</p>
        </div>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Palette className="h-4 w-4" />
              </div>
              <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <p className="font-bold text-slate-900 dark:text-slate-100">Brand color customization isn&apos;t available yet</p>
                <p>
                  Zylod storefronts share a single brand identity (the rose-red Zylod palette). There is no
                  per-supplier brand-color writer rail today, so an &quot;Apply Theme&quot; button here would
                  pretend to save a setting that does nothing. When brand-color customization ships, the color
                  picker will be wired to a real writer and your choice will appear on the public storefront.
                </p>
                <p>
                  In the meantime, the three surfaces below ARE customizable today and live on your storefront.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            What you can customize today
          </h2>
          {REAL_SURFACES.map(s => {
            const Icon = s.icon
            return (
              <Card
                key={s.id}
                onClick={() => navigate(s.id)}
                className="cursor-pointer rounded-2xl border shadow-sm hover:border-primary transition-colors"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
export default StoreThemeCustomizerPage
