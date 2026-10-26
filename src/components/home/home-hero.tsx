'use client'

import React, { useState, useCallback } from 'react'
import { Search, MapPin, Camera, QrCode, Mic, ShieldCheck, CreditCard, Truck, ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useToast } from '@/hooks/use-toast'

/* ─── t210-r2: rebuilt 1:1 against the user's mockup ───
   Crimson #E31C3D, pale-pink hero, headline two-tone, pill badge,
   white input + attached red Search button, Trending pills,
   trust-badge WHITE CARD overlapping the photo bottom-right,
   photo blending into the pink background (no frame). */

export const Z_RED = '#E31C3D'

const TRENDING_TAGS = ['Cotton Fabric', 'Jute Bag', 'Rice', 'Towel', 'Smartphone', 'Packaging']

const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'Verified Suppliers', subtitle: 'Trade with confidence' },
  { icon: CreditCard, title: 'Secure Payments', subtitle: 'Multiple methods' },
  { icon: Truck, title: 'Nationwide Delivery', subtitle: 'Across Bangladesh' },
]

/* Scan tools mandated by the owner — placed under the search bar,
   routed to the REAL scan pages (CLIP image search / zxing+VLM decoder / voice). */
const SCAN_TOOLS = [
  { icon: Camera, label: 'Photo Scan', page: 'image-search' as const },
  { icon: QrCode, label: 'Scan Code', page: 'barcode-scanner' as const },
  { icon: Mic, label: 'Voice Search', page: 'voice-search' as const },
]

export function HomeHero() {
  const { navigate } = useNavigationStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      toast({ title: 'Enter a search term', description: 'Search for products, suppliers, or categories.' })
      return
    }
    navigate('search-results', { query: q })
  }, [query, navigate, toast])

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{ background: 'linear-gradient(100deg, #FFF7F7 0%, #FDF0F1 55%, #FBEAEC 100%)' }}
    >
      <div className="relative flex min-h-[380px]">
        {/* ═══════════ LEFT: copy + search + trending ═══════════ */}
        <div className="relative z-10 flex flex-col justify-center flex-1 px-6 md:px-9 py-8 max-w-[640px]">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-1.5 self-start bg-white rounded-full px-3 py-1.5 shadow-sm mb-4">
            <MapPin className="h-3.5 w-3.5" style={{ color: Z_RED }} />
            <span className="text-xs font-semibold" style={{ color: Z_RED }}>
              Bangladesh Wholesale Marketplace
            </span>
          </div>

          {/* Two-tone headline */}
          <h1 className="text-[32px] md:text-[40px] font-black leading-[1.15] tracking-tight mb-3">
            <span className="text-gray-900 dark:text-gray-100">Quality Products.</span>
            <br />
            <span style={{ color: Z_RED }}>Trusted Suppliers.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-sm md:text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed mb-5 max-w-[440px]">
            Find the best wholesale products from verified suppliers across
            Bangladesh. Easy, secure and reliable.
          </p>

          {/* Search: white input + attached red button */}
          <form onSubmit={handleSearch} className="flex items-stretch max-w-[520px] mb-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products, suppliers, or categories..."
                aria-label="Search the wholesale marketplace"
                className="w-full h-11 pl-10 pr-3 rounded-l-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 shadow-[0_1px_3px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900"
              />
            </div>
            <button
              type="submit"
              className="h-11 px-7 rounded-r-lg text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_1px_3px_rgba(227,28,61,0.35)]"
              style={{ background: Z_RED }}
            >
              Search
            </button>
          </form>


          {/* Trending pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0">Trending:</span>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => navigate('search-results', { query: tag })}
                className="px-3 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 bg-white/90 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:bg-white hover:shadow-sm hover:text-gray-900 dark:hover:text-gray-200 transition-all whitespace-nowrap"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Scan tools — owner mandate: Photo Scan + QR/Barcode Scan on the design.
              Kept visually light so the hero still reads like the mockup. */}
          <div className="flex items-center gap-1.5 mb-4">
            {SCAN_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.label}
                  onClick={() => navigate(tool.page)}
                  className="group inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-transparent border border-gray-200/80 dark:border-gray-700 hover:bg-white hover:border-red-200 dark:hover:border-red-800 hover:shadow-sm transition-all"
                >
                  <Icon className="h-3 w-3" style={{ color: Z_RED }} />
                  <span className="text-[10.5px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">{tool.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ═══════════ RIGHT: product photo blending into the pale bg ═══════════ */}
        <div className="relative hidden md:block flex-1">
          <img
            src="/artwork/hero-products.png"
            alt="Wholesale products: folded cotton fabrics, jute tote bag, and a potted plant"
            className="absolute inset-y-0 right-0 h-full w-full object-contain object-center mix-blend-multiply"
            loading="eager"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {/* Soft blend edge so the photo melts into the pink card */}
          <div
            className="absolute inset-y-0 left-0 w-24 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, #FDF1F2 0%, rgba(253,241,242,0) 100%)' }}
            aria-hidden
          />

          {/* ═══════════ Trust badge WHITE CARD overlapping photo bottom-right ═══════════ */}
          <div className="absolute bottom-4 right-4 z-10">
            <div className="flex items-stretch bg-white dark:bg-gray-900 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.10)] border border-gray-100 dark:border-gray-800 overflow-hidden">
              {TRUST_BADGES.map((badge, i) => {
                const Icon = badge.icon
                return (
                  <div
                    key={badge.title}
                    className={`flex items-center gap-1.5 px-3 py-2.5 ${i > 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: Z_RED }} />
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-gray-900 dark:text-gray-100 leading-tight whitespace-nowrap">{badge.title}</p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight whitespace-nowrap">{badge.subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Trust card fallback on <md (photo hidden): show in-flow */}
      <div className="md:hidden px-6 pb-6 -mt-1">
        <div className="flex items-stretch bg-white dark:bg-gray-900 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-gray-800 overflow-hidden">
          {TRUST_BADGES.map((badge, i) => {
            const Icon = badge.icon
            return (
              <div
                key={badge.title}
                className={`flex-1 flex items-start gap-1.5 px-2.5 py-2.5 ${i > 0 ? 'border-l border-gray-100 dark:border-gray-800' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: Z_RED }} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-900 dark:text-gray-100 leading-tight">{badge.title}</p>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight">{badge.subtitle}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
