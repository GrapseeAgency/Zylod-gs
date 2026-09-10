'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft,
  HelpCircle,
  Sun,
  Snowflake,
  Leaf,
  Flower2,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface SeasonalProduct {
  id: string
  name: string
  basePrice: number
  unit: string | null
  moq: number
  ratingAvg: number
  soldCount: number
  thumbnailUrl: string | null
  images?: { imageUrl: string }[]
  category?: { name: string; slug: string } | null
}

/** Current meteorological season — derived from the real calendar. */
function currentSeason(): { label: string; icon: 'sun' | 'leaf' | 'flower' | 'snow' } {
  const m = new Date().getMonth()
  if (m >= 2 && m <= 4) return { label: 'Spring Collection', icon: 'flower' }
  if (m >= 5 && m <= 7) return { label: 'Summer Collection', icon: 'sun' }
  if (m >= 8 && m <= 10) return { label: 'Autumn Collection', icon: 'leaf' }
  return { label: 'Winter Collection', icon: 'snow' }
}

export function SeasonalSalePage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [products, setProducts] = useState<SeasonalProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/products?seasonal=true&limit=40')
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setProducts(json.data)
        } else if (!cancelled) {
          setLoadError('Seasonal picks are unavailable right now.')
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Group the seasonal catalog into curated kits by category
  const kits = useMemo(() => {
    const byCategory = new Map<string, { name: string; slug: string; items: SeasonalProduct[] }>()
    products.forEach((p) => {
      const slug = p.category?.slug || 'misc'
      if (!byCategory.has(slug)) {
        byCategory.set(slug, { name: p.category?.name || 'Curated Picks', slug, items: [] })
      }
      byCategory.get(slug)!.items.push(p)
    })
    return Array.from(byCategory.values())
      .map((g) => ({
        ...g,
        count: g.items.length,
        hero: g.items.reduce((a, b) => (b.ratingAvg > a.ratingAvg ? b : a), g.items[0]),
        startingPrice: Math.min(...g.items.map((i) => i.basePrice)),
      }))
      .sort((a, b) => b.count - a.count)
  }, [products])

  const season = currentSeason()
  const heroProduct = useMemo(
    () => [...products].sort((a, b) => b.soldCount - a.soldCount)[0],
    [products]
  )

  const seasonIcon = (size = 'h-5 w-5') => {
    switch (season.icon) {
      case 'snow': return <Snowflake className={size} />
      case 'leaf': return <Leaf className={size} />
      case 'flower': return <Flower2 className={size} />
      default: return <Sun className={size} />
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 md:pb-10">
      {/* ─── Top Header ─── */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#E0E0E0] h-14 flex items-center justify-between px-4">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-[#C8102E]" />
        </button>
        <span className="text-lg font-bold text-[#C8102E]">Zylod</span>
        <button
          onClick={() => navigate('help-center')}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5 text-[#6B7280]" />
        </button>
      </header>

      {/* ─── Top Seasonal Festival Hero ─── */}
      <div className="relative aspect-[16/10] w-full bg-gray-100 overflow-hidden flex items-center justify-center text-center px-6">
        {/* Background Image */}
        { }
        <img
          src={heroProduct?.images?.[0]?.imageUrl || heroProduct?.thumbnailUrl || '/placeholder-product.svg'}
          alt={season.label}
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" />

        <div className="relative z-10 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center mx-auto mb-3">
            {seasonIcon('h-6 w-6')}
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
            {season.label}
          </h1>
          <p className="text-xs text-[#4B5563] mt-2 leading-relaxed">
            Exclusive wholesale pricing on curated seasonal collections to stock your inventory.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4 md:max-w-5xl md:px-6">
        <h1 className="hidden md:block text-2xl font-black text-[#1A1A1A] tracking-tight">Seasonal Sale</h1>
        {/* ─── Loading / Error / Empty States ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Gathering seasonal picks...</p>
          </div>
        )}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-14">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && kits.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Sparkles className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              The seasonal collection is being curated. Check back soon.
            </p>
          </div>
        )}

        {/* ─── Curated Kits Section ─── */}
        {kits.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Curated Kits</h2>
              <button
                onClick={() => navigate('category-products', { filter: 'seasonal' })}
                className="text-xs font-bold text-[#C8102E] hover:underline"
              >
                See All
              </button>
            </div>

            <div className="space-y-3">
              {kits.map((kit, idx) => (
                <motion.div
                  key={kit.slug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate('category-products', { category: kit.slug })}
                  className="bg-white rounded-2xl border border-[#E0E0E0] p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    { }
                    <img
                      src={kit.hero?.images?.[0]?.imageUrl || kit.hero?.thumbnailUrl || '/placeholder-product.svg'}
                      alt={kit.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-[#1A1A1A] leading-snug line-clamp-1">
                      {kit.name}
                    </h3>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {kit.count} SKUs • <span className="text-[#059669] font-medium">Season Pick</span>
                    </p>

                    <div className="flex items-center justify-between mt-3">
                      <span className="font-bold text-base text-[#1A1A1A]">
                        {formatPrice(kit.startingPrice)}
                        <span className="text-[10px] font-normal text-[#6B7280]"> starting</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('category-products', { category: kit.slug })
                        }}
                        className="px-4 py-1.5 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                      >
                        View Kit
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SeasonalSalePage
