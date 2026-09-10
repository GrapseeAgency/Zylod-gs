'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft,
  HelpCircle,
  Smartphone,
  Shirt,
  HeartPulse,
  Wrench,
  Armchair,
  Package,
  Car,
  Sprout,
  HardHat,
  Sparkles,
  Search,
  Loader2,
  AlertTriangle,
  Layers,
} from 'lucide-react'

interface CategoryNode {
  id: string
  name: string
  slug: string
  iconUrl: string | null
  _count?: { products: number }
  children?: CategoryNode[]
}

/** Icon matched from the category slug — presentational only. */
function categoryIcon(slug: string) {
  const map: Record<string, typeof Smartphone> = {
    electronics: Smartphone,
    'mobile-accessories': Smartphone,
    garments: Shirt,
    'garments-apparel': Shirt,
    textiles: Shirt,
    'textiles-fabrics': Shirt,
    'health-medical': HeartPulse,
    'medical-supplies': HeartPulse,
    construction: HardHat,
    'construction-hardware': HardHat,
    'home-garden': Armchair,
    packaging: Package,
    'packaging-printing': Package,
    automotive: Car,
    'automotive-transport': Car,
    agriculture: Sprout,
    'agriculture-food': Sprout,
    beauty: Sparkles,
    'beauty-personal-care': Sparkles,
  }
  return map[slug] || Layers
}

export function CategoryBrowserPage() {
  const { navigate, goBack } = useNavigationStore()
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/categories/tree')
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setCategories(json.data)
        } else if (!cancelled) {
          setLoadError('Categories are unavailable right now.')
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

  // Subcategory names come from the real tree children
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.children ?? []).some((s) => s.name.toLowerCase().includes(q))
    )
  }, [categories, search])

  const totalProducts = useMemo(
    () => categories.reduce((s, c) => s + (c._count?.products ?? 0), 0),
    [categories]
  )

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

      <div className="max-w-md mx-auto px-4 pt-5 md:px-6 md:pt-6 space-y-4 md:space-y-6 lg:max-w-5xl">
        {/* ─── Title & Subtitle ─── */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">
            Explore Categories
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            {categories.length > 0
              ? `${categories.length} industries · ${totalProducts.toLocaleString()} wholesale products.`
              : 'Discover premium wholesale products across industries.'}
          </p>
        </div>

        {/* ─── Search Bar ─── */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search wholesale categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white border border-[#E0E0E0] rounded-xl text-xs text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] shadow-sm"
          />
        </div>

        {/* ─── Loading / Error / Empty States ─── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
            <p className="text-sm text-[#6B7280]">Loading categories...</p>
          </div>
        )}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center gap-3 py-14">
            <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}
        {!isLoading && !loadError && filteredCategories.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Layers className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-[#6B7280] max-w-[260px]">
              No categories match &ldquo;{search}&rdquo;.
            </p>
          </div>
        )}

        {/* ─── 2-Column Category Grid with Visual Backgrounds ─── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
          {filteredCategories.map((cat, idx) => {
            const Icon = categoryIcon(cat.slug)
            const subNames = (cat.children ?? []).slice(0, 2).map((c) => c.name)
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                onClick={() => navigate('category-products', { category: cat.slug })}
                className="relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group min-h-[160px] md:min-h-[180px] flex flex-col justify-end p-3 border border-black/5 bg-gradient-to-br from-[#3B3B44] to-[#17171C]"
              >
                {/* Decorative pattern backdrop */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <Icon className="absolute -right-3 -top-3 h-24 w-24 text-white/20 rotate-12" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

                {/* Content */}
                <div className="relative z-10 text-white">
                  <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center mb-1.5 border border-white/20">
                    <Icon className="h-4 w-4 text-white" />
                  </div>

                  <h3 className="font-bold text-xs leading-snug line-clamp-1 text-white">
                    {cat.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {(subNames.length > 0 ? subNames : [`${cat._count?.products ?? 0} products`]).slice(0, 2).map((sub, i) => (
                      <span
                        key={i}
                        className="bg-black/50 backdrop-blur-sm text-white/90 text-[9px] font-medium px-1.5 py-0.5 rounded border border-white/10"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CategoryBrowserPage
