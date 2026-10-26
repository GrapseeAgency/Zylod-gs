'use client'

import React, { useState, useCallback } from 'react'
import { Search, MapPin, Camera, QrCode, Mic, ShieldCheck, CreditCard, Truck } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useToast } from '@/hooks/use-toast'

/* ════════════════════════════════════════════════════════════════════
   Hero — hand-built to the owner's mockup (t211).

   Layout contract (from the mockup, 1536px design):
   • Pale-pink rounded card, ~420px tall, photo bleeds into the right 44%.
   • Left column: pill badge → two-tone headline → subcopy → search bar
     with attached red button → Trending pills → scan-tool pills
     (Photo Scan / Scan Code / Voice Search — owner mandate).
   • Trust-badge white card overlaps the photo's bottom edge.
   The left column owns 56% so the headline NEVER wraps to more than
   two lines and the photo never collapses (t210 regression, fixed).
   ════════════════════════════════════════════════════════════════════ */

const RED = '#E31C3D'

const TRENDING_TAGS = ['Cotton Fabric', 'Jute Bag', 'Rice', 'Towel', 'Smartphone', 'Packaging']

const SCAN_TOOLS = [
  { icon: Camera, label: 'Photo Scan', page: 'image-search' as const },
  { icon: QrCode, label: 'Scan Code', page: 'barcode-scanner' as const },
  { icon: Mic, label: 'Voice Search', page: 'voice-search' as const },
]

const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'Verified Suppliers', subtitle: 'Trade with confidence' },
  { icon: CreditCard, title: 'Secure Payments', subtitle: 'Multiple methods' },
  { icon: Truck, title: 'Nationwide Delivery', subtitle: 'Across Bangladesh' },
]

export function Hero() {
  const { navigate } = useNavigationStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const q = query.trim()
      if (!q) {
        toast({ title: 'Enter a search term', description: 'Search for products, suppliers, or categories.' })
        return
      }
      navigate('search-results', { query: q })
    },
    [query, navigate, toast]
  )

  return (
    <section
      aria-label="Zylod wholesale marketplace"
      data-theme-lock="light"
      className="relative overflow-hidden rounded-2xl"
      style={{ background: 'linear-gradient(100deg, #FFF7F7 0%, #FDF0F1 55%, #FBE9EC 100%)' }}
    >
      <div className="relative flex min-h-[380px] md:min-h-[400px] xl:min-h-[420px]">

        {/* ── Left column: badge, headline, search, trending, scan tools ── */}
        <div className="relative z-10 flex flex-col justify-center w-full md:w-[58%] 2xl:w-[60%] max-w-[600px] py-8 md:py-9 pl-5 sm:pl-7 lg:pl-10 pr-5 sm:pr-8">
          <p className="inline-flex items-center gap-1.5 self-start bg-white rounded-full pl-2.5 pr-3.5 py-1.5 shadow-[0_1px_4px_rgba(227,28,61,0.12)] mb-4">
            <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: RED }} aria-hidden />
            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: RED }}>
              Bangladesh Wholesale Marketplace
            </span>
          </p>

          <h1 className="text-[clamp(30px,2.8vw,42px)] font-extrabold leading-[1.16] tracking-tight text-gray-900 mb-3">
            Quality Products.
            <span className="block" style={{ color: RED }}>
              Trusted Suppliers.
            </span>
          </h1>

          <p className="text-sm lg:text-[15px] leading-relaxed text-gray-600 max-w-[430px] mb-5">
            Find the best wholesale products from verified suppliers across Bangladesh. Easy,
            secure and reliable.
          </p>

          {/* Search bar — white field with attached red button (mockup) */}
          <form
            role="search"
            onSubmit={handleSearch}
            className="flex items-stretch w-full max-w-[520px] h-12 bg-white rounded-xl shadow-[0_2px_10px_rgba(227,28,61,0.10)] ring-1 ring-black/[0.04] focus-within:ring-2 focus-within:ring-red-300/70 transition-shadow mb-3"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products, suppliers, or categories..."
                aria-label="Search for products, suppliers, or categories"
                className="w-full h-full pl-11 pr-3 rounded-l-xl bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-full px-6 lg:px-9 rounded-r-xl text-white text-sm font-semibold hover:brightness-95 active:brightness-90 transition-all"
              style={{ background: RED }}
            >
              Search
            </button>
          </form>

          {/* Trending pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Trending:</span>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => navigate('search-results', { query: tag })}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-gray-700 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-md hover:text-gray-900 active:scale-95 transition-all whitespace-nowrap"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Scan tools — owner mandate on the design; routes to the real scan pages */}
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            {SCAN_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.label}
                  onClick={() => navigate(tool.page)}
                  className="group inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3.5 rounded-full bg-white/70 border border-[#F3CBD1] hover:bg-white hover:border-[#E8A4AE] hover:shadow-sm active:scale-95 transition-all"
                >
                  <Icon className="h-3.5 w-3.5 transition-transform group-hover:scale-110" style={{ color: RED }} aria-hidden />
                  <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900">
                    {tool.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right column: photo melting into the pink card ── */}
        <div className="relative hidden md:block flex-1">
          <img
            src="/artwork/hero-products.png"
            alt="Wholesale products: folded cotton fabrics, a jute tote bag and a potted plant"
            className="absolute inset-y-0 right-0 h-full w-full object-cover object-[65%_center] mix-blend-multiply"
            loading="eager"
            fetchPriority="high"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          {/* Soft blend so the photo melts into the pink background */}
          <div
            className="absolute inset-y-0 left-0 w-28 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, #FDF0F1 0%, rgba(253,240,241,0) 100%)' }}
            aria-hidden
          />
        </div>
      </div>

      {/* Trust badges — white card overlapping the hero's bottom-right corner
          (mockup: it spans wider than the photo, so it lives on the section,
          sized to content and anchored right — it can never clip). */}
      <div className="absolute bottom-5 right-5 z-10 hidden md:flex items-stretch w-fit bg-white rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.10)] ring-1 ring-black/[0.03] overflow-hidden">
        {TRUST_BADGES.map((badge, i) => {
          const Icon = badge.icon
          return (
            <div
              key={badge.title}
              className={`flex items-center gap-1.5 px-3 py-2.5 ${i > 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: RED }} aria-hidden />
              <div className="min-w-0">
                <p className="text-[10px] font-bold leading-tight text-gray-900 whitespace-nowrap">
                  {badge.title}
                </p>
                <p className="text-[9px] leading-tight text-gray-400 whitespace-nowrap">
                  {badge.subtitle}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Trust badges — in-flow on <md where the photo is hidden */}
      <div className="md:hidden px-5 pb-6 -mt-1">
        <div className="flex items-stretch bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] overflow-hidden">
          {TRUST_BADGES.map((badge, i) => {
            const Icon = badge.icon
            return (
              <div
                key={badge.title}
                className={`flex-1 flex items-start gap-1.5 px-2.5 py-2.5 ${i > 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: RED }} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold leading-tight text-gray-900">{badge.title}</p>
                  <p className="text-[9px] leading-tight text-gray-400">{badge.subtitle}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
