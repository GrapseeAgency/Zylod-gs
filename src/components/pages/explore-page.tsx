'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useWishlistStore } from '@/store/wishlist-store'
import {
  ArrowLeft,
  HelpCircle,
  Search,
  QrCode,
  Heart,
  Star,
  Loader2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'

interface ExploreProduct {
  id: string
  name: string
  basePrice: number
  unit: string | null
  moq: number
  thumbnailUrl: string | null
  images?: { imageUrl: string }[]
  category?: { name: string; slug: string } | null
  supplier?: { id: string; companyName: string } | null
}

interface SpotlightSupplier {
  id: string
  companyName: string
  ratingAvg: number | null
  verificationStatus: string
}

export function ExplorePage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { isInWishlist, toggleItem } = useWishlistStore()

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<ExploreProduct[]>([])
  const [categories, setCategories] = useState<{ slug: string; label: string }[]>([])
  const [suppliers, setSuppliers] = useState<SpotlightSupplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Real category pills from the category tree
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

  // Products refresh when the active category changes
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const qs = activeCategory ? `&category=${encodeURIComponent(activeCategory)}` : ''
        const res = await fetch(`/api/products?limit=6${qs}`)
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setProducts(json.data)
        } else if (!cancelled) {
          setLoadError('Recommendations are unavailable right now.')
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Please try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [activeCategory])

  // Supplier spotlight from the real supplier directory
  useEffect(() => {
    let cancelled = false
    fetch('/api/suppliers?verificationStatus=approved&sort=rating&limit=4')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success && Array.isArray(json.data)) {
          setSuppliers(
            json.data.map((s: { id: string; companyName: string; ratingAvg: number | null; verificationStatus: string }) => ({
              id: s.id,
              companyName: s.companyName,
              ratingAvg: s.ratingAvg,
              verificationStatus: s.verificationStatus,
            }))
          )
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const heroProduct = products[0]
  const compactProducts = useMemo(() => products.slice(1, 5), [products])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate('search-results', { q: searchQuery.trim() })
    }
  }

  const toggleWishlist = (e: React.MouseEvent, p: ExploreProduct) => {
    e.stopPropagation()
    toggleItem({
      id: p.id,
      name: p.name,
      price: p.basePrice,
      originalPrice: p.basePrice,
      moq: p.moq,
      unit: p.unit || 'unit',
      supplier: p.supplier?.companyName || 'Zylod Supplier',
      location: 'Marketplace',
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
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors md:hidden"
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

      {/* ─── Header Gradient Hero ─── */}
      <div className="bg-gradient-to-b from-[#8B0018] via-[#B30E26] to-[#1C1C1E] text-white px-5 pt-7 pb-6 rounded-b-[24px] shadow-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-5 tracking-tight text-white">
          Discover Premium Goods
        </h1>

        {/* Search Bar with QR Scanner */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-md mx-auto md:max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search categories, suppliers, ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-12 rounded-full bg-white/95 text-[#1A1A1A] placeholder:text-[#9CA3AF] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] shadow-md"
          />
          <button
            type="button"
            onClick={() => navigate('barcode-scanner')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 p-1"
            title="Scan QR / Barcode"
          >
            <QrCode className="h-5 w-5" />
          </button>
        </form>
      </div>

      <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-6xl px-4 md:px-6 mt-5 md:mt-8">
        {/* ─── Category Filter Pills ─── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === null
                ? 'bg-[#C8102E] text-white shadow-sm'
                : 'bg-[#EAEAEA] text-[#4B5563] hover:bg-[#E0E0E0]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setActiveCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.slug
                  ? 'bg-[#C8102E] text-white shadow-sm'
                  : 'bg-[#EAEAEA] text-[#4B5563] hover:bg-[#E0E0E0]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* ─── Section: Personalized for You ─── */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">
        <div className="mt-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Personalized for You</h2>
            <button
              onClick={() => navigate('recommended')}
              className="text-xs font-bold text-[#C8102E] hover:underline"
            >
              See All
            </button>
          </div>

          {/* Loading / Error / Empty States */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-14">
              <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
              <p className="text-sm text-[#6B7280]">Finding picks for you...</p>
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
              <Search className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-[#6B7280] max-w-[260px]">
                Nothing listed in this category yet — try another one.
              </p>
            </div>
          )}

          {/* Hero Featured Card */}
          {!isLoading && heroProduct && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate('product-detail', { productId: heroProduct.id })}
              >
                <div className="relative aspect-[16/10] bg-gray-100">
                  { }
                  <img
                    src={heroProduct.images?.[0]?.imageUrl || heroProduct.thumbnailUrl || '/placeholder-product.svg'}
                    alt={heroProduct.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => toggleWishlist(e, heroProduct)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-105 transition-transform"
                    aria-label="Save to wishlist"
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        isInWishlist(heroProduct.id) ? 'fill-[#C8102E] text-[#C8102E]' : 'text-gray-400'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-[#1A1A1A] text-base leading-snug mb-1 line-clamp-2">
                    {heroProduct.name}
                  </h3>
                  <div className="flex items-baseline gap-1 text-[#C8102E] font-bold text-lg">
                    {formatPrice(heroProduct.basePrice)}
                    <span className="text-xs font-normal text-[#6B7280]">/ {heroProduct.unit || 'unit'}</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2">
                    <span className="text-xs font-medium text-[#6B7280]">
                      MOQ: {heroProduct.moq} {heroProduct.unit || 'units'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate('product-detail', { productId: heroProduct.id })
                      }}
                      className="px-4 py-2 bg-[#C8102E] hover:bg-[#A50D24] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      View & Contact Supplier
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Compact Product Rows */}
              <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {compactProducts.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate('product-detail', { productId: item.id })}
                    className="bg-white rounded-xl border border-[#E0E0E0] p-3 flex items-center gap-3 hover:border-gray-300 transition-colors cursor-pointer shadow-sm"
                  >
                    <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      { }
                      <img
                        src={item.images?.[0]?.imageUrl || item.thumbnailUrl || '/placeholder-product.svg'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[#1A1A1A] truncate">{item.name}</h4>
                      <p className="text-sm font-bold text-[#C8102E] mt-0.5">
                        {formatPrice(item.basePrice)}
                        <span className="text-xs font-normal text-[#6B7280]"> / {item.unit || 'unit'}</span>
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                        {item.supplier?.companyName || item.category?.name || 'Wholesale'}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── Section: Supplier Spotlight ─── */}
        {suppliers.length > 0 && (
          <div className="mt-8 lg:col-span-1">
            <div className="bg-[#F3F4F6] rounded-2xl p-4 border border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-[#1A1A1A]">Supplier Spotlight</h2>
                <button
                  onClick={() => navigate('suppliers')}
                  className="text-xs font-bold text-[#C8102E] hover:underline"
                >
                  See All
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {suppliers.map((sup) => (
                  <div
                    key={sup.id}
                    onClick={() => navigate('seller-storefront', { supplierId: sup.id })}
                    className="bg-white rounded-xl p-3 flex flex-col items-center text-center border border-[#E0E0E0] shadow-sm hover:border-[#C8102E]/40 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-red-100 flex items-center justify-center mb-2 bg-gray-50 group-hover:scale-105 transition-transform">
                      <span className="text-sm font-black text-[#C8102E]">
                        {sup.companyName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#1A1A1A] line-clamp-1 group-hover:text-[#C8102E] transition-colors">
                      {sup.companyName}
                    </span>
                    <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-[#C8102E]">
                      {sup.ratingAvg !== null && sup.ratingAvg > 0 ? (
                        <>
                          <Star className="h-3 w-3 fill-[#C8102E]" />
                          <span>{sup.ratingAvg.toFixed(1)}</span>
                        </>
                      ) : sup.verificationStatus === 'approved' ? (
                        <>
                          <ShieldCheck className="h-3 w-3" />
                          <span>Verified</span>
                        </>
                      ) : (
                        <span>New</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default ExplorePage
