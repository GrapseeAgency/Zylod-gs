'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search,
  Camera,
  QrCode,
  Mic,
  X,
  Sparkles,
  Clock,
  TrendingUp,
  Package,
  ShieldCheck,
  Star,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react'
import Image from 'next/image'
import { useNavigationStore } from '@/store/navigation-store'
import { useToast } from '@/hooks/use-toast'

const RED = '#E31C3D'
const RECENT_SEARCHES_KEY = 'zylod_recent_product_searches'

export interface ParsedProductQuery {
  raw: string
  cleanQuery: string
  minPrice?: number
  maxPrice?: number
  moq?: number
  sortBy?: 'basePrice' | 'ratingAvg' | 'createdAt' | 'soldCount'
  sortOrder?: 'asc' | 'desc'
  badges: Array<{ label: string; type: 'price' | 'moq' | 'sort' }>
}

/**
 * Intelligent wholesale natural language query parser.
 * Extracts constraints like 'under 500', 'moq 50', 'cheapest', 'top rated', '200 to 800 tk'.
 */
export function parseWholesaleProductQuery(raw: string): ParsedProductQuery {
  let text = raw.trim()
  let maxPrice: number | undefined
  let minPrice: number | undefined
  let moq: number | undefined
  let sortBy: 'basePrice' | 'ratingAvg' | 'createdAt' | 'soldCount' | undefined
  let sortOrder: 'asc' | 'desc' | undefined
  const badges: Array<{ label: string; type: 'price' | 'moq' | 'sort' }> = []

  // 1. Price range: 'between 500 and 2000' or '500-2000' or '500 to 2000'
  const rangeMatch = text.match(/(?:between\s+)?(\d+)\s*(?:-|to|and)\s*(\d+)(?:\s*(?:tk|bdt|৳))?/i)
  if (rangeMatch) {
    minPrice = parseInt(rangeMatch[1], 10)
    maxPrice = parseInt(rangeMatch[2], 10)
    text = text.replace(rangeMatch[0], ' ')
    badges.push({ label: `৳${minPrice} - ৳${maxPrice}`, type: 'price' })
  }

  // 2. Max price: 'under 500', 'below 1000', '< 500', 'max 500', 'upto 500', '500 tk max'
  const maxPriceMatch = text.match(
    /(?:under|below|<|max|upto|up\s+to)\s*(\d+)(?:\s*(?:tk|bdt|৳))?|(\d+)\s*(?:tk|bdt|৳)?\s*(?:max|or\s+less)/i
  )
  if (maxPriceMatch && maxPrice === undefined) {
    const val = parseInt(maxPriceMatch[1] || maxPriceMatch[2], 10)
    maxPrice = val
    text = text.replace(maxPriceMatch[0], ' ')
    badges.push({ label: `≤ ৳${val}`, type: 'price' })
  }

  // 3. Min price: 'above 500', 'over 1000', '> 500', 'min 500'
  const minPriceMatch = text.match(
    /(?:above|over|>|min\s*price|from)\s*(\d+)(?:\s*(?:tk|bdt|৳))?|(\d+)\s*(?:tk|bdt|৳)?\s*(?:\+|or\s+more)/i
  )
  if (minPriceMatch && minPrice === undefined) {
    const val = parseInt(minPriceMatch[1] || minPriceMatch[2], 10)
    minPrice = val
    text = text.replace(minPriceMatch[0], ' ')
    badges.push({ label: `≥ ৳${val}`, type: 'price' })
  }

  // 4. MOQ: 'moq 50', 'moq < 100', 'min order 20', 'min 50 pcs', 'bulk 100'
  const moqMatch = text.match(
    /(?:moq|min\s*order|bulk|min)\s*<?=?\s*(\d+)(?:\s*(?:pcs|pieces|units|kg|yard|bag|set))?|(\d+)\s*(?:pcs|pieces|units)\s*moq/i
  )
  if (moqMatch) {
    const val = parseInt(moqMatch[1] || moqMatch[2], 10)
    moq = val
    text = text.replace(moqMatch[0], ' ')
    badges.push({ label: `MOQ ≤ ${val}`, type: 'moq' })
  }

  // 5. Sort intent with word boundaries
  if (/\b(?:cheapest|cheap|lowest\s*price|low\s*price|budget|affordable)\b/i.test(text)) {
    sortBy = 'basePrice'
    sortOrder = 'asc'
    text = text.replace(/\b(?:cheapest|cheap|lowest\s*price|low\s*price|budget|affordable)\b/gi, ' ')
    badges.push({ label: 'Price: Low to High', type: 'sort' })
  } else if (/\b(?:premium|luxury|highest\s*price)\b/i.test(text)) {
    sortBy = 'basePrice'
    sortOrder = 'desc'
    text = text.replace(/\b(?:premium|luxury|highest\s*price)\b/gi, ' ')
    badges.push({ label: 'Premium Tier', type: 'sort' })
  } else if (/\b(?:best\s*rated|top\s*rated|top\s*quality|highest\s*rated|5\s*star|best)\b/i.test(text)) {
    sortBy = 'ratingAvg'
    sortOrder = 'desc'
    text = text.replace(/\b(?:best\s*rated|top\s*rated|top\s*quality|highest\s*rated|5\s*star|best)\b/gi, ' ')
    badges.push({ label: 'Top Rated', type: 'sort' })
  } else if (/\b(?:latest|newest|new\s*arrivals?|recent)\b/i.test(text)) {
    sortBy = 'createdAt'
    sortOrder = 'desc'
    text = text.replace(/\b(?:latest|newest|new\s*arrivals?|recent)\b/gi, ' ')
    badges.push({ label: 'Newest', type: 'sort' })
  }

  const cleanQuery = text.replace(/\s+/g, ' ').trim()

  return {
    raw,
    cleanQuery,
    minPrice,
    maxPrice,
    moq,
    sortBy,
    sortOrder,
    badges,
  }
}

// Canonical wholesale catalog for instant zero-latency suggestions
interface SuggestedProduct {
  id: string
  name: string
  basePrice: number
  moq: number
  unit: string
  thumbnailUrl: string | null
  ratingAvg: number
  supplierName?: string
  supplierVerified?: boolean
}

const CANONICAL_CATALOG: SuggestedProduct[] = [
  {
    id: 'cmvprj0mh002tporadr0f7af7',
    name: 'Premium Cotton Fabric — Dyed 44"',
    basePrice: 320,
    moq: 100,
    unit: 'yard',
    thumbnailUrl: '/images/products/cotton-fabric.png',
    ratingAvg: 4.8,
    supplierName: 'Dhaka Textile Mills Ltd',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0nj0031poraav2wv31u',
    name: 'Export Quality Denim Fabric 12oz',
    basePrice: 480,
    moq: 200,
    unit: 'yard',
    thumbnailUrl: '/images/products/denim-fabric.png',
    ratingAvg: 4.7,
    supplierName: 'Dhaka Textile Mills Ltd',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0pr0039porah6kpavfc',
    name: 'Pure Silk Fabric — Handloom',
    basePrice: 1250,
    moq: 50,
    unit: 'yard',
    thumbnailUrl: '/images/products/silk-fabric.png',
    ratingAvg: 4.9,
    supplierName: 'Dhaka Textile Mills Ltd',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0rj003hporasnaps58t',
    name: 'Cotton Bath Towels — 6pc Bundle',
    basePrice: 850,
    moq: 20,
    unit: 'set',
    thumbnailUrl: '/images/products/towels.png',
    ratingAvg: 4.6,
    supplierName: 'Dhaka Agro Foods Ltd',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0t6003pporage35ehz1',
    name: 'Premium Basmati Rice — 50kg Bag',
    basePrice: 4200,
    moq: 10,
    unit: 'bag',
    thumbnailUrl: '/images/products/basmati-rice.png',
    ratingAvg: 4.8,
    supplierName: 'Bengal Agro Ltd',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0uv003xporaacdr4545',
    name: 'Natural Jute Tote Bags — 100pcs Bale',
    basePrice: 18,
    moq: 1000,
    unit: 'piece',
    thumbnailUrl: '/images/products/jute-shopping-bags.png',
    ratingAvg: 4.5,
    supplierName: 'GreenLife Packaging',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0wl0045poran2v14q11',
    name: 'Aromatic Kataribhog Rice — 25kg',
    basePrice: 2600,
    moq: 20,
    unit: 'bag',
    thumbnailUrl: '/images/products/kataribhog-rice-sacks.png',
    ratingAvg: 4.7,
    supplierName: 'Bengal Agro Ltd',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0ya004dpora3s2a4b88',
    name: 'Smartphone Galaxy S24 — Wholesale Lot',
    basePrice: 92000,
    moq: 5,
    unit: 'piece',
    thumbnailUrl: '/images/products/s24-box.png',
    ratingAvg: 4.6,
    supplierName: 'SmartTech Distribution',
    supplierVerified: true,
  },
  {
    id: 'cmvprj0zz004lpora9k2j5c12',
    name: 'iPhone 15 — Bulk Import Carton',
    basePrice: 118000,
    moq: 5,
    unit: 'piece',
    thumbnailUrl: '/images/products/iphone15-box.png',
    ratingAvg: 4.8,
    supplierName: 'SmartTech Distribution',
    supplierVerified: true,
  },
  {
    id: 'cmvprj11r004tporac8v93d44',
    name: 'Solar Power Bank 20000mAh',
    basePrice: 2350,
    moq: 50,
    unit: 'piece',
    thumbnailUrl: '/images/products/power-bank.png',
    ratingAvg: 4.8,
    supplierName: 'GreenTech Solutions',
    supplierVerified: true,
  },
  {
    id: 'cmvprj13j0051pora5m8n7e23',
    name: 'LED Bulb 9W — Energy Saving',
    basePrice: 45,
    moq: 100,
    unit: 'piece',
    thumbnailUrl: '/images/products/led-bulb-9w.png',
    ratingAvg: 4.7,
    supplierName: 'LightHub Bangladesh',
    supplierVerified: true,
  },
]

const SMART_PROMPTS = [
  'Cotton fabric under 500',
  'Denim fabric min 50 pcs',
  'Basmati rice 50kg bag',
  'Top rated solar power bank',
  'Cheapest jute tote bags',
]

const POPULAR_SEARCHES = [
  'Cotton Fabric 44"',
  'Export Denim 12oz',
  'Basmati Rice 50kg',
  'Natural Jute Bags',
  'LED Bulb 9W',
]

export function HeroIntelligentSearch() {
  const { navigate } = useNavigationStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<SuggestedProduct[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 5))
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }, [])

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5)
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const clearRecentSearches = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setRecentSearches([])
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {}
  }, [])

  const removeRecentSearch = useCallback((termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== termToRemove)
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  // Parse natural language wholesale query in real-time
  const parsedQuery = useMemo(() => {
    return parseWholesaleProductQuery(query)
  }, [query])

  // Debounced product suggestions fetch
  useEffect(() => {
    const clean = parsedQuery.cleanQuery.trim().toLowerCase()
    if (!clean && parsedQuery.badges.length === 0) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        // Query local canonical catalog first for instant response
        const localMatches = CANONICAL_CATALOG.filter((p) => {
          const matchName = clean ? p.name.toLowerCase().includes(clean) : true
          const matchMaxPrice = parsedQuery.maxPrice ? p.basePrice <= parsedQuery.maxPrice : true
          const matchMinPrice = parsedQuery.minPrice ? p.basePrice >= parsedQuery.minPrice : true
          const matchMoq = parsedQuery.moq ? p.moq <= parsedQuery.moq : true
          return matchName && matchMaxPrice && matchMinPrice && matchMoq
        })

        // Also fetch from API to get any fresh DB products
        let apiProducts: SuggestedProduct[] = []
        try {
          const urlParams = new URLSearchParams()
          if (clean) urlParams.set('search', clean)
          if (parsedQuery.minPrice) urlParams.set('minPrice', String(parsedQuery.minPrice))
          if (parsedQuery.maxPrice) urlParams.set('maxPrice', String(parsedQuery.maxPrice))
          if (parsedQuery.moq) urlParams.set('moq', String(parsedQuery.moq))
          urlParams.set('limit', '6')

          const res = await fetch(`/api/products?${urlParams.toString()}`)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data?.data)) {
              apiProducts = data.data.map((p: any) => ({
                id: p.id,
                name: p.name,
                basePrice: p.basePrice,
                moq: p.moq,
                unit: p.unit || 'piece',
                thumbnailUrl: p.thumbnailUrl || p.imageUrls?.[0] || null,
                ratingAvg: p.ratingAvg || 4.8,
                supplierName: p.supplier?.companyName || p.supplierName,
                supplierVerified: true,
              }))
            }
          }
        } catch {
          // If API fails, localMatches will take over seamlessly
        }

        // Merge results prioritizing API, falling back to local
        const seenIds = new Set<string>()
        const merged: SuggestedProduct[] = []
        for (const p of [...apiProducts, ...localMatches]) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id)
            merged.push(p)
          }
        }

        setSuggestions(merged.slice(0, 6))
      } finally {
        setIsLoading(false)
      }
    }, 120)

    return () => clearTimeout(timer)
  }, [parsedQuery])

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Execute intelligent search
  const executeSearch = useCallback(
    (searchRaw: string) => {
      const trimmed = searchRaw.trim()
      if (!trimmed) {
        toast({
          title: 'Enter a product name or spec',
          description: "Try typing 'cotton fabric under 500' or 'rice moq 20'.",
        })
        return
      }

      const parsed = parseWholesaleProductQuery(trimmed)
      saveRecentSearch(trimmed)
      setIsOpen(false)
      setActiveIndex(-1)

      const navParams: Record<string, string> = {
        query: parsed.cleanQuery || trimmed,
      }
      if (parsed.minPrice) navParams.minPrice = String(parsed.minPrice)
      if (parsed.maxPrice) navParams.maxPrice = String(parsed.maxPrice)
      if (parsed.moq) navParams.moq = String(parsed.moq)
      if (parsed.sortBy) navParams.sortBy = parsed.sortBy
      if (parsed.sortOrder) navParams.sortOrder = parsed.sortOrder

      navigate('search-results', navParams)
    },
    [navigate, saveRecentSearch, toast]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      const selected = suggestions[activeIndex]
      saveRecentSearch(selected.name)
      setIsOpen(false)
      navigate('product-detail', { id: selected.id, productId: selected.id })
      return
    }
    executeSearch(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > -1 ? prev - 1 : -1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  // Highlight matching query terms
  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim()) return text
    const words = highlight.trim().split(/\s+/).filter(Boolean)
    const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="text-[#E31C3D] font-bold">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-[540px] mb-2.5">
      {/* Search Input Container */}
      <form
        role="search"
        onSubmit={handleSubmit}
        className="relative flex items-stretch w-full h-11 bg-white rounded-xl shadow-[0_2px_10px_rgba(227,28,61,0.10)] ring-1 ring-black/[0.04] focus-within:ring-2 focus-within:ring-red-300/70 transition-shadow"
      >
        <div className="relative flex-1 min-w-0 flex items-center">
          <Search
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            aria-hidden
          />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search products (e.g. 'cotton under 500')..."
            aria-label="Search wholesale products"
            className="w-full h-full pl-9 sm:pl-11 pr-24 sm:pr-32 rounded-l-xl bg-transparent text-[12.5px] sm:text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />

          {/* Action Icons inside input (Clear, Photo Scan, QR Code, Voice Search) */}
          <div className="absolute right-1.5 sm:right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1 text-gray-400">
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setIsOpen(true)
                  inputRef.current?.focus()
                }}
                title="Clear search"
                aria-label="Clear search"
                className="p-1 rounded-full hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('image-search')}
              title="Photo Scan"
              aria-label="Photo Scan"
              className="p-1 sm:p-1.5 rounded-lg hover:text-[#E31C3D] hover:bg-red-50 transition-colors"
            >
              <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate('barcode-scanner')}
              title="Scan QR Code"
              aria-label="Scan QR Code"
              className="p-1 sm:p-1.5 rounded-lg hover:text-[#E31C3D] hover:bg-red-50 transition-colors"
            >
              <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate('voice-search')}
              title="Voice Search"
              aria-label="Voice Search"
              className="p-1 sm:p-1.5 rounded-lg hover:text-[#E31C3D] hover:bg-red-50 transition-colors"
            >
              <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>

        {/* Attached Red Search Button */}
        <button
          type="submit"
          className="h-full px-4 sm:px-7 lg:px-9 rounded-r-xl text-white text-xs sm:text-sm font-semibold hover:brightness-95 active:brightness-90 transition-all shrink-0 flex items-center justify-center gap-1.5"
          style={{ background: RED }}
        >
          <span>Search</span>
        </button>
      </form>

      {/* Real-time Parsed Intent Preview Pills (Under input when user types constraints) */}
      {parsedQuery.badges.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
            <Sparkles className="h-3 w-3" />
            Smart Filter
          </span>
          {parsedQuery.badges.map((badge, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 bg-white/90 shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-2.5 py-0.5 rounded-full border border-gray-200/80"
            >
              <SlidersHorizontal className="h-2.5 w-2.5 text-gray-500" />
              {badge.label}
            </span>
          ))}
          {parsedQuery.cleanQuery && (
            <span className="text-[11px] text-gray-500 font-medium ml-1">
              Keyword: &quot;<span className="text-gray-800 font-semibold">{parsedQuery.cleanQuery}</span>&quot;
            </span>
          )}
        </div>
      )}

      {/* Floating Intelligent Typeahead Dropdown (Dedicated to PRODUCTS ONLY) */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[70vh] overflow-y-auto">
          {/* STATE 1: Query Typed — Live Product Results (Strictly Products Only) */}
          {query.trim().length > 0 ? (
            <div className="p-2 sm:p-2.5">
              {/* Header with match count & smart filter indication */}
              <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Wholesale Products {suggestions.length > 0 && `(${suggestions.length})`}
                </span>
                {isLoading && (
                  <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                    Searching catalog...
                  </span>
                )}
              </div>

              {/* Product Suggestions List */}
              {suggestions.length > 0 ? (
                <div className="space-y-1">
                  {suggestions.map((product, index) => {
                    const isActive = index === activeIndex
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          saveRecentSearch(product.name.replace(/\n/g, ' '))
                          setIsOpen(false)
                          navigate('product-detail', { id: product.id, productId: product.id })
                        }}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                          isActive
                            ? 'bg-rose-50/80 dark:bg-rose-950/30 ring-1 ring-rose-200 dark:ring-rose-900/50'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-11 w-11 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {product.thumbnailUrl ? (
                            <Image
                              src={product.thumbnailUrl}
                              alt={product.name}
                              width={44}
                              height={44}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-gray-400" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100 truncate leading-snug">
                            {highlightMatch(product.name.replace(/\n/g, ' '), parsedQuery.cleanQuery || query)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[12px] font-bold text-[#E31C3D]">
                              ৳{product.basePrice.toLocaleString()}{' '}
                              <span className="text-[10px] text-gray-500 font-normal">/ {product.unit}</span>
                            </span>
                            <span className="text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                              MOQ: {product.moq} {product.unit}
                            </span>
                            {product.ratingAvg && (
                              <span className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-amber-600">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {product.ratingAvg.toFixed(1)}
                              </span>
                            )}
                            {product.supplierVerified && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                                <ShieldCheck className="h-3 w-3" />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>

                        <ArrowRight className="h-3.5 w-3.5 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100" />
                      </button>
                    )
                  })}
                </div>
              ) : !isLoading ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-gray-500">
                    No exact products matching &quot;<span className="font-semibold text-gray-800">{query}</span>&quot;
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">Try searching by category, material, or specifications.</p>
                </div>
              ) : null}

              {/* Footer: Search all matching products */}
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => executeSearch(query)}
                  className="text-xs font-semibold text-[#E31C3D] hover:underline flex items-center gap-1 py-1"
                >
                  <span>Search all wholesale products for &quot;{parsedQuery.cleanQuery || query}&quot;</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
                <span className="text-[10px] text-gray-400 hidden sm:inline">Press Enter ↵</span>
              </div>
            </div>
          ) : (
            /* STATE 2: Empty Input Zero-State (Recent Searches, Trending, AI Prompts) */
            <div className="p-3 sm:p-4 space-y-3">
              {/* Recent Product Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Recent Product Searches
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => {
                          setQuery(term)
                          executeSearch(term)
                        }}
                        className="group inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-rose-50 hover:text-rose-600 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700 cursor-pointer transition-colors"
                      >
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(term, e)}
                          className="text-gray-400 group-hover:text-rose-600 hover:bg-rose-100/60 rounded-full p-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Wholesale Searches */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="h-3 w-3 text-rose-500" />
                  Top Wholesale Searches
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setQuery(item)
                        executeSearch(item)
                      }}
                      className="px-3 py-1 bg-white dark:bg-gray-800 hover:bg-rose-50 hover:border-rose-300 hover:text-[#E31C3D] rounded-full text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Natural Language Wholesale Query Prompts */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3 w-3 text-rose-500" />
                  Intelligent Natural Language Search (Try typing)
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {SMART_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setQuery(prompt)
                        executeSearch(prompt)
                      }}
                      className="px-2.5 py-1 bg-rose-50/70 hover:bg-rose-100 text-rose-700 rounded-lg text-[11.5px] font-medium border border-rose-100 transition-colors"
                    >
                      💡 &quot;{prompt}&quot;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
