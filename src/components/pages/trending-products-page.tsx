'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft,
  HelpCircle,
  TrendingUp,
  Users,
  Package,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface TrendingProduct {
  id: string
  name: string
  basePrice: number
  unit: string | null
  moq: number
  soldCount: number
  ratingAvg: number
  thumbnailUrl: string | null
  images?: { imageUrl: string }[]
  category?: { name: string; slug: string } | null
  supplier?: { companyName: string } | null
}

export function TrendingProductsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [products, setProducts] = useState<TrendingProduct[]>([])
  const [totalTrending, setTotalTrending] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/products?sortBy=soldCount&limit=8')
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setProducts(json.data)
          setTotalTrending(json.pagination?.total ?? null)
        } else if (!cancelled) {
          setLoadError('Trending data is unavailable right now.')
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

  const hero = products[0]
  const ranked = products.slice(1)

  /** Volume tier derived from the real soldCount — no invented percentages. */
  const volumeLabel = (p: TrendingProduct): { text: string; icon: 'users' | 'package' | 'sold' } => {
    if (p.soldCount >= 1000) return { text: `${(p.soldCount / 1000).toFixed(1)}k sold`, icon: 'sold' }
    if (p.soldCount > 0) return { text: `${p.soldCount} sold`, icon: 'sold' }
    return { text: 'Ready to ship', icon: 'package' }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 md:pb-10">
      {/* ─── Top Nav Bar ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E0E0E0] h-14 flex items-center justify-between px-4">
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

      {/* ─── Top Live Market Data Banner ─── */}
      <div className="bg-[#F8ECEE] px-5 py-6 border-b border-[#F0D5D8]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8102E] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C8102E]"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
            Live Market Data
          </span>
        </div>
        <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">
          The World is Buying
        </h1>
        <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
          Ranked by real procurement volume across {totalTrending !== null ? totalTrending.toLocaleString() : 'all'} active listings.
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 mt-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* ─── Loading State ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Ranking top movers...</p>
          </div>
        )}

        {/* ─── Error / Empty States ─── */}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}

        {!isLoading && !loadError && products.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <TrendingUp className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              No sales recorded yet — rankings will appear as orders come in.
            </p>
          </div>
        )}

        {/* ─── #1 Hero Trending Card ─── */}
        {hero && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('product-detail', { productId: hero.id })}
            className="relative rounded-2xl overflow-hidden shadow-md cursor-pointer group bg-black"
          >
            <div className="relative aspect-[16/11] w-full">
              { }
              <img
                src={hero.images?.[0]?.imageUrl || hero.thumbnailUrl || '/placeholder-product.svg'}
                alt={hero.name}
                className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              {/* Badge #1 Trending Global */}
              <div className="absolute top-3.5 left-3.5 bg-[#FFC107] text-[#1A1A1A] text-[11px] font-black px-2.5 py-1 rounded-md shadow-md flex items-center gap-1">
                <span>🔥</span> #1 Trending Now
              </div>

              {/* Content overlay */}
              <div className="absolute bottom-3.5 left-3.5 right-3.5 text-white">
                <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">
                  {hero.category?.name || 'Wholesale'}
                </span>
                <h3 className="font-bold text-base leading-tight mt-0.5 mb-2 line-clamp-2">
                  {hero.name}
                </h3>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-[#4CAF50] text-xs font-bold mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>{volumeLabel(hero).text}</span>
                    </div>
                    <div className="text-xl font-extrabold text-white">
                      {formatPrice(hero.basePrice)}
                    </div>
                    <div className="text-[11px] text-white/70">MOQ: {hero.moq} {hero.unit || 'units'}</div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate('product-detail', { productId: hero.id })
                    }}
                    className="px-4 py-2 bg-white hover:bg-gray-100 text-[#1A1A1A] font-bold text-xs rounded-lg shadow-md transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Ranked Trending Cards (#2 onwards) ─── */}
        {ranked.map((item, idx) => {
          const metric = volumeLabel(item)
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate('product-detail', { productId: item.id })}
              className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Top image with optional badge */}
              <div className="relative aspect-[16/8] w-full bg-gray-100">
                { }
                <img
                  src={item.images?.[0]?.imageUrl || item.thumbnailUrl || '/placeholder-product.svg'}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-white/95 text-[#1A1A1A] text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                  <span>⭐</span> #{idx + 2} Top Mover
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-[#1A1A1A] text-sm leading-snug line-clamp-1">
                  {item.name}
                </h3>
                <div className="text-base font-bold text-[#C8102E] mt-1">
                  {formatPrice(item.basePrice)}
                  <span className="text-xs font-normal text-[#6B7280]"> / {item.unit || 'unit'}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#6B7280] mt-2 pt-2 border-t border-gray-100">
                  <span>MOQ: {item.moq} {item.unit || 'units'}</span>
                  <span className="font-medium text-[#4B5563] flex items-center gap-1">
                    {metric.icon === 'users' && <Users className="h-3 w-3 text-[#6B7280]" />}
                    {metric.icon === 'package' && <Package className="h-3 w-3 text-[#6B7280]" />}
                    {metric.text}
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}

        {/* ─── Bottom View All Trending Card ─── */}
        {products.length > 0 && (
          <div
            onClick={() => navigate('category-products', { filter: 'trending' })}
            className="bg-white rounded-2xl border border-[#E0E0E0] p-6 text-center shadow-sm hover:border-[#C8102E]/40 transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-[#FFE4E6] text-[#C8102E] flex items-center justify-center mx-auto mb-3">
              <ArrowRight className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-[#1A1A1A]">View All Trending</h3>
            <p className="text-xs text-[#6B7280] mt-1">
              Browse every active listing ranked by sales volume
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrendingProductsPage
