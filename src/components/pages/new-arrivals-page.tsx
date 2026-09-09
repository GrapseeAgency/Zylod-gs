'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  ArrowLeft,
  HelpCircle,
  Bookmark,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'

interface ArrivalProduct {
  id: string
  name: string
  basePrice: number
  unit: string | null
  moq: number
  createdAt: string
  thumbnailUrl: string | null
  images?: { imageUrl: string }[]
  category?: { name: string; slug: string } | null
  supplier?: { id: string; companyName: string; verificationStatus: string } | null
}

interface CategoryTab {
  slug: string
  label: string
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'Just added'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NewArrivalsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { isInWishlist, toggleItem } = useWishlistStore()

  const [activeTab, setActiveTab] = useState('all')
  const [products, setProducts] = useState<ArrivalProduct[]>([])
  const [categories, setCategories] = useState<CategoryTab[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load real category tabs once
  useEffect(() => {
    let cancelled = false
    fetch('/api/categories/tree')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success && Array.isArray(json.data)) {
          setCategories(
            json.data.slice(0, 5).map((c: { slug: string; name: string }) => ({
              slug: c.slug,
              label: c.name.replace(/ & .*/, ''),
            }))
          )
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load arrivals for the active tab
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const qs = activeTab === 'all' ? '' : `&category=${encodeURIComponent(activeTab)}`
        const res = await fetch(`/api/products?sortBy=createdAt&limit=9${qs}`)
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setProducts(json.data)
        } else if (!cancelled) {
          setLoadError('New arrivals are unavailable right now.')
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [activeTab])

  const heroArrival = products[0]
  const gridArrivals = useMemo(() => products.slice(1, 7), [products])
  const latestAdded = useMemo(() => products.slice(0, 4), [products])

  const toggleWishlist = (e: React.MouseEvent, p: ArrivalProduct) => {
    e.stopPropagation()
    toggleItem({
      id: p.id,
      name: p.name,
      price: p.basePrice,
      originalPrice: p.basePrice,
      moq: p.moq,
      unit: p.unit || 'unit',
      supplier: p.supplier?.companyName || 'Verified Supplier',
      location: p.supplier?.verificationStatus === 'approved' ? 'Verified Supplier' : 'New Supplier',
      category: p.category?.name || '',
      customizable: false,
    })
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 md:pb-8">
      {/* ─── Top Nav Bar ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E0E0E0] h-14 flex items-center justify-between px-4 md:hidden">
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

      <div className="max-w-md mx-auto lg:max-w-5xl px-4 pt-4 md:px-6 md:pt-6 space-y-5 md:space-y-6">
        {/* ─── Hero Factory Banner ─── */}
        <div className="relative rounded-2xl overflow-hidden shadow-md bg-black">
          <div className="relative aspect-[16/9] md:aspect-[16/7] w-full">
            { }
            <img
              src={heroArrival?.images?.[0]?.imageUrl || heroArrival?.thumbnailUrl || '/placeholder-product.svg'}
              alt="Latest arrival"
              className="w-full h-full object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            <div className="absolute top-4 left-4">
              <span className="bg-[#C8102E] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                Fresh from Factory
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h1 className="text-xl md:text-2xl font-bold leading-tight mb-1 line-clamp-1">
                {heroArrival ? heroArrival.name : 'New Arrivals'}
              </h1>
              <p className="text-xs text-white/80 leading-relaxed line-clamp-2">
                Direct sourcing from our top-tier manufacturing partners. Verified quality, immediate dispatch.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Category Filter Pills ─── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[{ slug: 'all', label: 'All New' }, ...categories].map((tab) => {
            const isActive = activeTab === tab.slug
            return (
              <button
                key={tab.slug}
                onClick={() => setActiveTab(tab.slug)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#C8102E] text-white shadow-sm'
                    : 'bg-[#EAEAEA] text-[#4B5563] hover:bg-[#E0E0E0]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ─── Loading / Error / Empty States ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Loading fresh listings...</p>
          </div>
        )}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-14">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}

        {!isLoading && !loadError && products.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Sparkles className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              No arrivals in this category yet — check another tab or come back soon.
            </p>
          </div>
        )}

        {/* ─── Section: Featured Arrivals ─── */}
        {!isLoading && heroArrival && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base md:text-lg font-bold text-[#1A1A1A]">Featured Arrivals</h2>
              <button
                onClick={() => navigate('category-products', { filter: 'new' })}
                className="text-xs font-bold text-[#C8102E] flex items-center gap-1 hover:underline"
              >
                See All <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Hero Arrival Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate('product-detail', { productId: heroArrival.id })}
              className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer mb-3"
            >
              <div className="relative aspect-[16/10] md:aspect-[16/6] w-full bg-gray-50 flex items-center justify-center">
                { }
                <img
                  src={heroArrival.images?.[0]?.imageUrl || heroArrival.thumbnailUrl || '/placeholder-product.svg'}
                  alt={heroArrival.name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 bg-white/95 text-[#C8102E] font-serif italic text-xs font-bold px-2 py-0.5 rounded shadow-sm">
                  New
                </span>
                <button
                  onClick={(e) => toggleWishlist(e, heroArrival)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-[#C8102E]"
                  aria-label="Save for later"
                >
                  <Bookmark
                    className={`h-4 w-4 ${isInWishlist(heroArrival.id) ? 'fill-[#C8102E] text-[#C8102E]' : ''}`}
                  />
                </button>
              </div>

              <div className="p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                  {heroArrival.category?.name || 'Wholesale'} · {timeAgo(heroArrival.createdAt)}
                </span>
                <h3 className="font-bold text-[#1A1A1A] text-sm leading-snug mt-0.5">
                  {heroArrival.name}
                </h3>

                <div className="text-base font-bold text-[#C8102E] mt-1">
                  {formatPrice(heroArrival.basePrice)}
                  <span className="text-xs font-normal text-[#6B7280]"> / {heroArrival.unit || 'unit'}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#6B7280] mt-2 pt-2 border-t border-gray-100">
                  <span>MOQ: {heroArrival.moq} {heroArrival.unit || 'units'}</span>
                  {heroArrival.supplier?.verificationStatus === 'approved' && (
                    <span className="text-[#059669] font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified Supplier
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gridArrivals.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate('product-detail', { productId: item.id })}
                  className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-square w-full bg-gray-100">
                    { }
                    <img
                      src={item.images?.[0]?.imageUrl || item.thumbnailUrl || '/placeholder-product.svg'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 bg-white/95 text-[#C8102E] font-serif italic text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      New
                    </span>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-2 leading-tight">
                      {item.name}
                    </h4>
                    <div className="mt-2">
                      <div className="text-sm font-bold text-[#C8102E]">
                        {formatPrice(item.basePrice)}
                        <span className="text-[10px] font-normal text-[#6B7280]"> / {item.unit || 'unit'}</span>
                      </div>
                      <div className="text-[10px] text-[#6B7280] mt-0.5">MOQ: {item.moq}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Section: Just Added Timeline ─── */}
        {!isLoading && latestAdded.length > 0 && (
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#1A1A1A] mb-3">Just Added to Catalog</h2>

            <div className="bg-white rounded-2xl border border-[#E0E0E0] p-4 space-y-4 shadow-sm">
              {latestAdded.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => navigate('product-detail', { productId: item.id })}
                  className="relative pl-6 cursor-pointer group"
                >
                  {/* Timeline connector line */}
                  {idx < latestAdded.length - 1 && (
                    <div className="absolute left-[7px] top-3 bottom-[-16px] w-[2px] bg-gray-200" />
                  )}

                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      idx === 0 ? 'bg-[#C8102E]' : 'bg-gray-300'
                    }`}
                  />

                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-1 group-hover:text-[#C8102E] transition-colors">
                      {item.name}
                    </h4>
                    <span className="text-[10px] font-semibold bg-gray-100 text-[#4B5563] px-2 py-0.5 rounded whitespace-nowrap">
                      {timeAgo(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-[#6B7280] mt-1 leading-relaxed line-clamp-1">
                    {item.category?.name || 'Wholesale'} · {formatPrice(item.basePrice)} / {item.unit || 'unit'} · MOQ {item.moq}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NewArrivalsPage
