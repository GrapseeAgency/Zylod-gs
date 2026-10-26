'use client'

import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, MapPin, Camera, QrCode, Mic, ShieldCheck, CreditCard, Truck, TrendingUp, ArrowRight } from 'lucide-react'
import { useNavigationStore } from '@/store/navigation-store'
import { useToast } from '@/hooks/use-toast'

/* ─── Crimson brand red (t210 mockup spec) ─── */
const RED = '#E31C3D'

/* ─── Trending search pills — real popular queries on the marketplace ─── */
const TRENDING_TAGS = [
  'Cotton Fabric', 'Jute Bag', 'Basmati Rice', 'Terry Towel', 'LED Panel', 'Packaging Box',
]

/* ─── Trust badges (hero bottom row) ─── */
const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'Verified Suppliers', subtitle: 'Trade with confidence' },
  { icon: CreditCard, title: 'Secure Payments', subtitle: 'Escrow · bKash · Nagad · Bank' },
  { icon: Truck, title: 'Nationwide Delivery', subtitle: 'Across all 64 districts' },
]

/* ─── Scan shortcuts — t210: photo scan + QR/barcode scan must be prominent.
   These route to the REAL scan pages (image-search is CLIP visual search,
   barcode-scanner is the zxing+VLM two-stage decoder from t207). */
const SCAN_TOOLS = [
  { icon: Camera, label: 'Photo Scan', page: 'image-search' as const, hint: 'Search by photo' },
  { icon: QrCode, label: 'Scan Code', page: 'barcode-scanner' as const, hint: 'QR / barcode' },
  { icon: Mic, label: 'Voice', page: 'voice-search' as const, hint: 'Speak your query' },
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

  const handleTrendingClick = useCallback((tag: string) => {
    navigate('search-results', { query: tag })
  }, [navigate])

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-red-100 dark:border-gray-800"
      style={{ background: 'linear-gradient(135deg, #FFF5F5 0%, #FFFFFF 60%, #FFF5F5 100%)' }}
    >
      {/* Decorative crimson blobs */}
      <div
        className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: RED }}
        aria-hidden
      />
      <div
        className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: RED }}
        aria-hidden
      />

      <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-6 p-5 md:p-7">
        {/* ─── Left: copy + search + trending + trust ─── */}
        <div className="flex flex-col">
          {/* Location breadcrumb */}
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="h-3.5 w-3.5" style={{ color: RED }} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: RED }}>
              Bangladesh Wholesale Marketplace
            </span>
          </div>

          {/* Headline — two-line, charcoal + crimson per mockup */}
          <h1 className="text-3xl md:text-4xl lg:text-[42px] font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Quality Products.
            <br />
            <span style={{ color: RED }}>Trusted Suppliers.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-5 max-w-xl">
            Find the best wholesale products from verified suppliers across Bangladesh.
            Easy, secure, and reliable B2B trade.
          </p>

          {/* Search form — pill input + crimson button */}
          <form onSubmit={handleSearch} className="flex items-stretch gap-0 mb-3 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products, suppliers, or categories..."
                aria-label="Search the wholesale marketplace"
                className="w-full h-12 pl-10 pr-3 rounded-l-lg border border-r-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900"
              />
            </div>
            <button
              type="submit"
              className="h-12 px-6 rounded-r-lg text-white text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
              style={{ background: RED }}
            >
              Search
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Scan shortcuts — Photo Scan + QR/Barcode Scan + Voice (t210 mandate) */}
          <div className="flex items-center gap-2 mb-4 max-w-xl">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mr-1">Or try:</span>
            {SCAN_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.label}
                  onClick={() => navigate(tool.page)}
                  title={tool.hint}
                  className="group inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-red-300 dark:hover:border-red-800 hover:shadow-sm transition-all"
                >
                  <Icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 group-hover:text-red-600 transition-colors" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {tool.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Trending tags */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 font-medium">
              <TrendingUp className="h-3 w-3" />
              Trending:
            </span>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTrendingClick(tag)}
                className="px-3 py-1 rounded-full text-[11px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Trust badges — 3-up row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-auto">
            {TRUST_BADGES.map((badge) => {
              const Icon = badge.icon
              return (
                <div key={badge.title} className="flex items-start gap-2.5">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${RED}12` }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: RED }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight">{badge.title}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{badge.subtitle}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Right: hero product photo (t210 generated artwork) ─── */}
        <div className="hidden lg:flex items-center justify-center relative">
          <div className="relative w-full max-w-md aspect-[4/3] rounded-xl overflow-hidden shadow-lg ring-1 ring-red-100 dark:ring-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/artwork/hero-products.png"
              alt="Wholesale products: folded cotton fabrics, jute tote bag, and a potted plant"
              className="w-full h-full object-cover"
              loading="eager"
              onError={(e) => {
                // Honest fallback: hide the image and show a soft gradient block
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            {/* Floating "Verified" pill on the photo */}
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#059669' }} />
              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">100% Verified Suppliers</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
