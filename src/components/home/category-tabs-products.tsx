'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProductCardSkeleton } from '@/components/shared/loading-skeletons'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Package,
  Search,
  Factory,
  Wrench,
  Camera,
  QrCode,
  X,
  Loader2,
  Building2,
  Tag,
} from 'lucide-react'
import { MainProductCard } from './main-product-card'
import type { MainProduct } from './main-product-card'

/* ─── Color Constants ─── */
const RED = '#E53935'
const BG_CARD = '#FFFFFF'

/* ─── Search Tab Data ─── */
const SEARCH_TABS = [
  { id: 'products', label: 'Choose good products', icon: Package, placeholder: 'Search for hot selling products...', categories: ['textiles', 'food', 'electronics', 'construction', 'packaging', 'home-garden', 'gifts', 'beauty', 'promo'] },
  { id: 'factory', label: 'Looking for a factory', icon: Factory, placeholder: 'Search for verified factories...', categories: ['textiles', 'food', 'electronics', 'construction', 'packaging'] },
  { id: 'industrial', label: 'Industrial products', icon: Wrench, placeholder: 'Search for industrial products...', categories: ['construction', 'electronics', 'packaging'] },
]

const CATEGORY_TABS = ['All Products', 'Textiles', 'Agriculture', 'Electronics', 'Construction', 'Packaging', 'Garments', 'Spices', 'Mobile Accessories', 'LED & Lighting']

/* ─── API product → MainProduct mapping ─── */
interface ApiProduct {
  id: string
  name: string
  basePrice: number
  moq: number
  soldCount: number
  isCustomizable: boolean
  slug: string
  thumbnailUrl?: string | null
  currency?: string
  category?: { slug: string; name: string }
  supplier?: { companyName: string }
}

function mapApiProduct(p: ApiProduct): MainProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.basePrice,
    originalPrice: p.basePrice,
    moq: p.moq,
    sold: p.soldCount,
    customizable: p.isCustomizable,
    location: p.supplier?.companyName ?? 'Bangladesh',
    category: p.category?.slug ?? 'other',
  }
}

/* ─── Suggestion types ─── */
interface Suggestion {
  type: 'product' | 'category' | 'supplier' | 'fallback'
  id: string
  name: string
  subtitle?: string
  category?: string
  price?: number
  slug?: string
}

export function CategoryTabsAndProducts() {
  const { setCurrentPage, navigate } = useNavigationStore()
  const { formatPrice, currentCurrency } = useCurrencyStore()
  const [activeSearchTab, setActiveSearchTab] = useState('products')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MainProduct[] | null>(null)
  const [activeCategoryTab, setActiveCategoryTab] = useState('All Products')
  const [visibleProducts, setVisibleProducts] = useState(10)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isFetching, setIsFetching] = useState(false) // prevents duplicate triggers
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [lastCategory, setLastCategory] = useState(activeCategoryTab)
  const [lastSearchResults, setLastSearchResults] = useState(searchResults)

  /* ─── Real products from API ─── */
  const [products, setProducts] = useState<MainProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)

  // Reset visible products when category or search changes (React-recommended pattern)
  if (activeCategoryTab !== lastCategory) {
    setLastCategory(activeCategoryTab)
    setVisibleProducts(10)
    setIsFetching(false)
  }
  if (searchResults !== lastSearchResults) {
    setLastSearchResults(searchResults)
    setVisibleProducts(10)
    setIsFetching(false)
  }

  /* ─── Suggestions state ─── */
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const suggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  /* Get the active search tab config */
  const activeTabConfig = SEARCH_TABS.find(t => t.id === activeSearchTab)!

  /* ─── Close suggestions on outside click ─── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* ─── Load real products from API ─── */
  useEffect(() => {
    let cancelled = false
    async function loadProducts() {
      try {
        setProductsLoading(true)
        const res = await fetch('/api/products?limit=100&sortBy=soldCount&sortOrder=desc')
        if (!res.ok) throw new Error('Failed to load products')
        const body = await res.json()
        if (cancelled) return
        const items = Array.isArray(body.data) ? body.data : (body.data?.products ?? [])
        setProducts(items.map(mapApiProduct))
        setProductsError(null)
      } catch {
        if (!cancelled) setProductsError('Failed to load products')
      } finally {
        if (!cancelled) setProductsLoading(false)
      }
    }
    loadProducts()
    return () => { cancelled = true }
  }, [])

  /* ─── Fetch suggestions (debounced) ─── */
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setSuggestionsLoading(true)
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&mode=${activeSearchTab}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        const result: Suggestion[] = []

        // Add fallback suggestions first (always available)
        if (data.data?.fallbackSuggestions?.length > 0) {
          data.data.fallbackSuggestions.forEach((name: string, i: number) => {
            result.push({ type: 'fallback', id: `fb-${i}`, name })
          })
        }

        // Add DB product suggestions
        if (data.data?.products?.length > 0) {
          data.data.products.forEach((p: any) => {
            result.push({
              type: 'product',
              id: p.id,
              name: p.name,
              subtitle: p.category?.name,
              price: p.basePrice,
              slug: p.slug,
            })
          })
        }

        // Add category suggestions
        if (data.data?.categories?.length > 0) {
          data.data.categories.forEach((c: any) => {
            result.push({
              type: 'category',
              id: c.id,
              name: c.name,
              slug: c.slug,
            })
          })
        }

        // Add supplier suggestions
        if (data.data?.suppliers?.length > 0) {
          data.data.suppliers.forEach((s: any) => {
            result.push({
              type: 'supplier',
              id: s.id,
              name: s.companyName,
              subtitle: `Rating: ${s.ratingAvg?.toFixed(1) || 'N/A'}`,
            })
          })
        }

        // If no suggestions from API, do local matching
        if (result.length === 0) {
          const q = query.toLowerCase()
          const localMatches = products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.location.toLowerCase().includes(q)
          ).slice(0, 5)
          localMatches.forEach(p => {
            result.push({
              type: 'product',
              id: p.id,
              name: p.name,
              subtitle: p.category,
              price: p.price,
            })
          })
        }

        setSuggestions(result)
        setShowSuggestions(result.length > 0)
      }
    } catch {
      // On error, do local matching
      const q = query.toLowerCase()
      const localMatches = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      ).slice(0, 5)
      const result: Suggestion[] = localMatches.map(p => ({
        type: 'product' as const,
        id: p.id,
        name: p.name,
        subtitle: p.category,
        price: p.price,
      }))
      setSuggestions(result)
      setShowSuggestions(result.length > 0)
    }
    setSuggestionsLoading(false)
  }, [activeSearchTab, products])

  /* ─── Handle search input change with debounce ─── */
  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value)
    setSelectedSuggestionIndex(-1)

    // Clear previous timer
    if (suggestionsTimerRef.current) {
      clearTimeout(suggestionsTimerRef.current)
    }

    if (!value.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      setSearchResults(null)
      return
    }

    // Debounce: 300ms for suggestions
    suggestionsTimerRef.current = setTimeout(() => {
      fetchSuggestions(value.trim())
    }, 300)
  }

  /* ─── Handle suggestion click ─── */
  const handleSuggestionClick = (suggestion: Suggestion) => {
    setShowSuggestions(false)
    setSearchQuery(suggestion.name)

    if (suggestion.type === 'product' && suggestion.id) {
      // Navigate to product detail
      setCurrentPage('product-detail', { productId: suggestion.id })
      return
    }

    if (suggestion.type === 'category' && suggestion.slug) {
      // Navigate to category page
      setCurrentPage('category-products', { category: suggestion.slug })
      return
    }

    if (suggestion.type === 'supplier') {
      // Navigate to supplier
      setCurrentPage('suppliers', { supplierId: suggestion.id })
      return
    }

    // For fallback suggestions, search directly
    performSearch(suggestion.name)
  }

  /* ─── Perform search against API ─── */
  const performSearch = useCallback(async (query: string) => {
    const q = query.trim()
    if (!q) return
    setShowSuggestions(false)
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=50&sortBy=soldCount&sortOrder=desc`)
      if (!res.ok) throw new Error('Search failed')
      const body = await res.json()
      const items = Array.isArray(body.data) ? body.data : (body.data?.products ?? [])
      setSearchResults(items.map(mapApiProduct))
    } catch {
      const ql = q.toLowerCase()
      const local = products.filter(p =>
        p.name.toLowerCase().includes(ql) ||
        p.category.toLowerCase().includes(ql)
      )
      setSearchResults(local)
    }
  }, [products])

  /* ─── Handle search form submit ─── */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    performSearch(searchQuery)
    searchInputRef.current?.blur()
  }

  /* ─── Handle keyboard navigation in suggestions ─── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
        e.preventDefault()
        handleSuggestionClick(suggestions[selectedSuggestionIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  /* ─── Clear search results ─── */
  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
    setSuggestions([])
    setShowSuggestions(false)
  }

  /* ─── Filter products by search tab + category tab + search query ─── */
  const filteredProducts = (() => {
    let list = products

    // Filter by search tab (different product scopes)
    if (activeSearchTab !== 'products') {
      list = list.filter(p => activeTabConfig.categories.includes(p.category))
    }

    // Filter by category tab
    if (activeCategoryTab !== 'All Products') {
      const tabMap: Record<string, string[]> = {
        'Textiles': ['textiles'],
        'Agriculture': ['food'],
        'Electronics': ['electronics'],
        'Construction': ['construction'],
        'Packaging': ['packaging'],
        'Garments': ['textiles'],
        'Spices': ['food'],
        'Mobile Accessories': ['electronics'],
        'LED & Lighting': ['electronics'],
      }
      list = list.filter(p => tabMap[activeCategoryTab]?.includes(p.category) ?? false)
    }

    return list
  })()

  /* ─── Infinite scroll: Intersection Observer ─── */
  const currentProductList = searchResults ?? filteredProducts
  const hasMore = visibleProducts < currentProductList.length

  const loadMoreProducts = useCallback(() => {
    if (isFetching || !hasMore) return
    setIsFetching(true)
    setIsLoadingMore(true)
    // Simulate network delay for realistic skeleton display
    setTimeout(() => {
      setVisibleProducts((prev) => Math.min(prev + 5, currentProductList.length))
      setIsLoadingMore(false)
      setIsFetching(false)
    }, 400)
  }, [isFetching, hasMore, currentProductList.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    // Disconnect previous observer
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !isFetching) {
          loadMoreProducts()
        }
      },
      { rootMargin: '400px' } // trigger 400px before the sentinel enters viewport
    )

    observerRef.current.observe(sentinel)

    return () => {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [hasMore, loadMoreProducts])

  // Sync visible products when category/search changes
  // (handled inline above during render)

  /* ─── Get suggestion icon ─── */
  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'product': return <Package className="h-3.5 w-3.5 text-red-500" />
      case 'category': return <Tag className="h-3.5 w-3.5 text-blue-500" />
      case 'supplier': return <Building2 className="h-3.5 w-3.5 text-green-500" />
      case 'fallback': return <Search className="h-3.5 w-3.5 text-gray-400" />
    }
  }

  return (
    <main className="flex-1 min-w-0 space-y-3">
      {/* ═══════════ SECTION 1: TABBED SEARCH AREA ═══════════ */}
      <Card className="border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div className="bg-white">
          {/* Row 1: Search Tabs */}
          <div className="flex items-center gap-0 border-b border-gray-100">
            {SEARCH_TABS.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeSearchTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveSearchTab(tab.id)
                    setSearchResults(null)
                    setSearchQuery('')
                    setSuggestions([])
                    setShowSuggestions(false)
                  }}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all relative cursor-pointer ${
                    isActive
                      ? 'text-red-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <TabIcon className={`h-4 w-4 ${isActive ? 'text-red-600' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-red-600" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Row 2: Search Bar + Photo Scan + QR Code */}
          <div className="flex items-center gap-3 px-5 py-4">
            <form onSubmit={handleSearch} className="flex items-center flex-1 relative">
              <div className="flex items-center w-full relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={activeTabConfig.placeholder}
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true)
                  }}
                  className="flex-1 h-11 border-2 border-red-600 rounded-l-md px-4 text-sm placeholder:text-gray-400 focus:outline-none focus:border-red-700 transition-colors"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-[100px] top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                )}
                <button
                  type="submit"
                  className="h-11 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-r-md transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>

              {/* ─── Suggestions Dropdown ─── */}
              {showSuggestions && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
                >
                  {suggestionsLoading && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Searching...</span>
                    </div>
                  )}

                  {!suggestionsLoading && suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.type}-${suggestion.id}`}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                        index === selectedSuggestionIndex
                          ? 'bg-red-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="shrink-0 h-8 w-8 rounded-md bg-gray-100 flex items-center justify-center">
                        {getSuggestionIcon(suggestion.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">
                          {highlightMatch(suggestion.name, searchQuery)}
                        </p>
                        {suggestion.subtitle && (
                          <p className="text-xs text-gray-400 truncate">{suggestion.subtitle}</p>
                        )}
                      </div>
                      {suggestion.price && (
                        <span className="text-sm font-semibold text-red-600 shrink-0">{formatPrice(suggestion.price)}</span>
                      )}
                      <span className="text-[10px] text-gray-300 uppercase shrink-0">{suggestion.type}</span>
                    </button>
                  ))}

                  {!suggestionsLoading && suggestions.length === 0 && searchQuery && (
                    <div className="px-4 py-3 text-sm text-gray-400 text-center">
                      No suggestions found
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Camera / QR Scanner — real dedicated pages */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCurrentPage('image-search')}
                className="flex items-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
                title="Search by product photo"
              >
                <Camera className="h-4 w-4 text-red-600" />
                <span className="text-xs text-red-600 font-medium">Photo Scan</span>
              </button>
              <button
                onClick={() => setCurrentPage('barcode-scanner')}
                className="flex items-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
                title="Scan a barcode to find a product"
              >
                <QrCode className="h-4 w-4 text-red-600" />
                <span className="text-xs text-red-600 font-medium">Scan Code</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══════════ SEARCH RESULTS INDICATOR ═══════════ */}
      {searchResults !== null && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 font-medium">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              {searchQuery && <span> for "<span className="font-bold">{searchQuery}</span>"</span>}
            </span>
          </div>
          <button onClick={clearSearch} className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer">
            Clear search
          </button>
        </div>
      )}

      {/* ═══════════ SECTION 2: CATEGORY TABS + PRODUCT GRID ═══════════ */}
      <Card className="border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <div className="px-4 pt-3 pb-0" style={{ background: BG_CARD }}>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-2">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveCategoryTab(tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategoryTab === tab
                    ? 'text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
                style={activeCategoryTab === tab ? { background: RED } : undefined}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ═══════════ PRODUCT GRID ═══════════ */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Initial loading skeletons while products load from API */}
          {productsLoading && products.length === 0 &&
            Array.from({ length: 10 }).map((_, i) => (
              <ProductCardSkeleton key={`initial-skeleton-${i}`} />
            ))
          }
          {!productsLoading && currentProductList.slice(0, visibleProducts).map((product) => (
            <MainProductCard key={product.id} product={product} />
          ))}
          {/* Skeleton loading cards while fetching more */}
          {isLoadingMore &&
            Array.from({ length: Math.min(5, currentProductList.length - visibleProducts) }).map((_, i) => (
              <ProductCardSkeleton key={`skeleton-${i}`} />
            ))
          }
        </div>
        {currentProductList.length === 0 && !isLoadingMore && !productsLoading && (
          <div className="flex flex-col items-center py-12 text-center">
            <Search className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No products found</p>
            <p className="text-xs text-gray-400 mt-1">
              {productsError ?? 'Try a different search term'}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={clearSearch}>Clear search</Button>
          </div>
        )}
        {/* Intersection Observer sentinel — invisible element that triggers loading when near viewport */}
        {hasMore && (
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
        )}
        {/* End-of-list indicator */}
        {!hasMore && currentProductList.length > 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="px-4 text-xs text-gray-400 font-medium">You&#39;ve seen all products</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        )}
      </div>
    </main>
  )
}

/* ─── Highlight matching text in suggestions ─── */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-red-600 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}
