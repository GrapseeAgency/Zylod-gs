'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft,
  HelpCircle,
  Award,
  Star,
  ChevronRight,
  Building2,
  Loader2,
  AlertTriangle,
  Package,
} from 'lucide-react'

interface BrandEntry {
  name: string
  productCount: number
  avgRating: number | null
  startingPrice: number | null
  representativeProduct: {
    id: string
    name: string
    slug: string
    image: string | null
    categoryName: string | null
  } | null
}

export function BrandShowcasePage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [brands, setBrands] = useState<BrandEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Deep-link support: ?brand=Name shows that brand's products via category-products
  const focusBrand = pageParams.brand || null

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/brands?limit=60')
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setBrands(json.data)
        } else if (!cancelled) {
          setLoadError('Brand directory is unavailable right now.')
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

  const openBrand = (brandName: string) => {
    navigate('category-products', { brand: brandName })
  }

  const hero = brands[0]
  const spotlight = useMemo(() => brands.slice(1, 4), [brands])
  const rest = useMemo(() => brands.slice(4), [brands])

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 md:pb-8">
      {/* ─── Top Header ─── */}
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

      <div className="max-w-md mx-auto px-4 pt-4 space-y-5 md:max-w-3xl lg:max-w-6xl md:pt-6 md:space-y-8">
        {/* ─── Top Hero Card with Glassmorphic Overlay ─── */}
        <div className="relative rounded-3xl overflow-hidden shadow-md min-h-[340px] md:min-h-[420px] flex items-center justify-center p-4">
          {/* Background image from the top brand's flagship product */}
          { }
          <img
            src={hero?.representativeProduct?.image || '/placeholder-product.svg'}
            alt="Featured manufacturer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />

          {/* Frosted Glass Card */}
          <div className="relative z-10 w-full bg-white/85 backdrop-blur-md rounded-2xl p-6 border border-white/40 shadow-xl text-center">
            <span className="text-[10px] font-black tracking-widest text-[#C8102E] uppercase block mb-1">
              Top-Tier Manufacturers
            </span>
            <h1 className="text-xl md:text-3xl font-bold text-[#1A1A1A] tracking-tight">
              Elite Brand Showcase
            </h1>
            <p className="text-xs text-[#4B5563] mt-2.5 leading-relaxed">
              {brands.length > 0
                ? `${brands.length} verified brands with ${brands.reduce((s, b) => s + b.productCount, 0)} active listings on the marketplace.`
                : 'Discover verified manufacturers offering premium quality for your B2B sourcing needs.'}
            </p>
            {hero && (
              <button
                onClick={() => openBrand(hero.name)}
                className="mt-5 w-full py-3 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                Explore {hero.name}
              </button>
            )}
          </div>
        </div>

        {/* ─── Loading / Error / Empty States ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Loading brand directory...</p>
          </div>
        )}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-14">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && brands.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Building2 className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              No branded listings yet — brands appear here as suppliers add them.
            </p>
          </div>
        )}

        {/* ─── Featured Brands Section ─── */}
        {!isLoading && hero && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1A1A1A]">Featured Brands</h2>
              <button
                onClick={() => navigate('suppliers')}
                className="text-xs font-bold text-[#C8102E] hover:underline"
              >
                All Suppliers
              </button>
            </div>

            {/* Hero Brand Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => openBrand(hero.name)}
              className="relative rounded-2xl overflow-hidden border border-[#E0E0E0] shadow-sm bg-[#1E293B] text-white cursor-pointer group"
            >
              <div className="relative aspect-[16/9] w-full">
                { }
                <img
                  src={hero.representativeProduct?.image || '/placeholder-product.svg'}
                  alt={hero.name}
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                <div className="absolute top-3 left-3 text-[9px] font-bold tracking-widest text-white/70 uppercase">
                  {hero.representativeProduct?.categoryName || 'Wholesale'} Leader
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-white/95 text-[#1A1A1A] rounded-xl p-2.5 flex items-center justify-between shadow-md mb-2">
                    <span className="font-bold text-xs">{hero.name}</span>
                    <span className="bg-[#FFF1F2] text-[#C8102E] border border-[#FECDD3] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Package className="h-3 w-3" /> {hero.productCount} products
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 leading-snug line-clamp-2">
                    Flagship: {hero.representativeProduct?.name}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Spotlight Brand Cards */}
            <div className="space-y-3 md:grid md:grid-cols-3 md:gap-3 md:space-y-0">
            {spotlight.map((brand) => (
              <motion.div
                key={brand.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openBrand(brand.name)}
                className="bg-white rounded-2xl border border-[#E0E0E0] p-3 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    { }
                    <img
                      src={brand.representativeProduct?.image || '/placeholder-product.svg'}
                      alt={brand.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-[#1A1A1A] truncate">{brand.name}</h4>
                    <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug line-clamp-1">
                      {brand.representativeProduct?.categoryName || 'Wholesale'} · {brand.productCount} products
                    </p>
                    {brand.avgRating !== null && brand.avgRating > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-[#C8102E]">
                        <Star className="h-3 w-3 fill-[#C8102E]" />
                        <span className="text-[11px] font-semibold">{brand.avgRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button className="px-3 py-1.5 bg-[#F3F4F6] hover:bg-gray-200 text-[#1A1A1A] text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 transition-colors">
                  <span>View</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
            </div>

            {/* Remaining Brand Grid */}
            {rest.length > 0 && (
              <>
                <h3 className="text-sm font-bold text-[#1A1A1A] pt-2">More Brands</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {rest.map((brand, idx) => (
                    <motion.button
                      key={brand.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => openBrand(brand.name)}
                      className="bg-white rounded-xl border border-[#E0E0E0] p-3 text-left shadow-sm hover:border-[#C8102E]/40 transition-all cursor-pointer"
                    >
                      <div className="w-full aspect-[16/10] rounded-lg bg-gray-100 overflow-hidden mb-2">
                        { }
                        <img
                          src={brand.representativeProduct?.image || '/placeholder-product.svg'}
                          alt={brand.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h4 className="font-bold text-xs text-[#1A1A1A] truncate">{brand.name}</h4>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">
                        {brand.productCount} products
                        {brand.startingPrice !== null && ` · from ${formatPrice(brand.startingPrice)}`}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BrandShowcasePage
