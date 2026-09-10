'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Clock, ArrowLeft, TrendingUp, X, Tag } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

interface SuggestionProduct {
  id: string
  name: string
  basePrice: number
  thumbnailUrl?: string
  category?: { name: string }
}

interface SuggestionSupplier {
  id: string
  companyName: string
  ratingAvg: number
}

interface SuggestionCategory {
  id: string
  name: string
  slug: string
}

interface SuggestionsData {
  products: SuggestionProduct[]
  categories: SuggestionCategory[]
  suppliers: SuggestionSupplier[]
  fallbackSuggestions: string[]
}

interface HistoryItem {
  id: string
  query: string
  createdAt: string
}

export function SearchSuggestionsPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const initialQuery = pageParams.query || ''
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    inputRef.current?.focus()
    fetchHistory()
  }, [])

  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      fetchSuggestions(debouncedQuery)
    } else {
      setSuggestions(null)
    }
  }, [debouncedQuery])

  async function fetchHistory() {
    try {
      const res = await fetch('/api/search/history')
      if (res.ok) {
        const json = await res.json()
        setHistory((json.data || []).slice(0, 6))
      }
    } catch {}
  }

  async function fetchSuggestions(q: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}&limit=6`)
      if (res.ok) {
        const json = await res.json()
        setSuggestions(json.data || null)
      }
    } catch {}
    setLoading(false)
  }

  function handleSearch(q: string) {
    if (!q.trim()) return
    navigate('search-results', { query: q.trim() })
  }

  function deleteHistory(term: string) {
    setHistory(prev => prev.filter(h => h.query !== term))
    fetch(`/api/search/history?term=${encodeURIComponent(term)}`, { method: 'DELETE' }).catch(() => {})
  }

  const hasSuggestions = suggestions && (
    suggestions.products.length > 0 ||
    suggestions.categories.length > 0 ||
    suggestions.suppliers.length > 0 ||
    suggestions.fallbackSuggestions.length > 0
  )

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header with live input */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-red-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search wholesale products..."
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder:text-gray-400"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
            />
            {query && (
              <button onClick={() => setQuery('')}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          {query && (
            <button
              onClick={() => handleSearch(query)}
              className="text-sm font-medium text-red-600"
            >
              Search
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        {/* No query — show recent history */}
        {!query && (
          <AnimatePresence>
            {history.length > 0 && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 pt-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent</p>
                  <button
                    onClick={() => { setHistory([]); fetch('/api/search/history', { method: 'DELETE' }).catch(() => {}) }}
                    className="text-xs text-red-500"
                  >
                    Clear all
                  </button>
                </div>
                {history.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-3 py-3 border-b border-gray-50 group cursor-pointer"
                    onClick={() => handleSearch(item.query)}
                  >
                    <Clock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">{item.query}</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteHistory(item.query) }}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5 text-gray-300" />
                    </button>
                  </motion.div>
                ))}
              </motion.section>
            )}
          </AnimatePresence>
        )}

        {/* Loading skeleton */}
        {loading && query && (
          <div className="px-4 pt-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {!loading && hasSuggestions && (
          <div className="pt-2">
            {/* Text suggestions */}
            {suggestions!.fallbackSuggestions.length > 0 && (
              <div>
                {suggestions!.fallbackSuggestions.map((s, idx) => (
                  <motion.button
                    key={s}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => handleSearch(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50"
                  >
                    <Search className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <span className="text-sm text-gray-700 text-left flex-1">
                      {s.toLowerCase().includes(query.toLowerCase()) ? (
                        <>
                          {s.substring(0, s.toLowerCase().indexOf(query.toLowerCase()))}
                          <strong className="text-red-600">{s.substring(s.toLowerCase().indexOf(query.toLowerCase()), s.toLowerCase().indexOf(query.toLowerCase()) + query.length)}</strong>
                          {s.substring(s.toLowerCase().indexOf(query.toLowerCase()) + query.length)}
                        </>
                      ) : s}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Category suggestions */}
            {suggestions!.categories.length > 0 && (
              <div>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Categories</p>
                {suggestions!.categories.map((cat, idx) => (
                  <motion.button
                    key={cat.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => navigate('category-products', { category: cat.slug })}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50"
                  >
                    <Tag className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 text-left">{cat.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">Category</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Product suggestions */}
            {suggestions!.products.length > 0 && (
              <div>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Products</p>
                {suggestions!.products.map((product, idx) => (
                  <motion.button
                    key={product.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => navigate('product-detail', { productId: product.id })}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50"
                  >
                    {product.thumbnailUrl ? (
                      <img src={product.thumbnailUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm text-gray-800 line-clamp-1">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.category?.name}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600 flex-shrink-0">{formatPrice(product.basePrice)}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Supplier suggestions */}
            {suggestions!.suppliers.length > 0 && (
              <div>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Suppliers</p>
                {suggestions!.suppliers.map((supplier, idx) => (
                  <motion.button
                    key={supplier.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => navigate('seller-storefront', { supplierId: supplier.id })}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50"
                  >
                    <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700 text-left">{supplier.companyName}</span>
                    <span className="text-xs text-gray-400">⭐ {supplier.ratingAvg.toFixed(1)}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* See all results */}
            {query && (
              <button
                onClick={() => handleSearch(query)}
                className="w-full flex items-center justify-center gap-2 py-4 text-sm text-red-600 font-medium"
              >
                <Search className="w-4 h-4" />
                See all results for &ldquo;{query}&rdquo;
              </button>
            )}
          </div>
        )}

        {/* No suggestions */}
        {!loading && query && !hasSuggestions && (
          <div className="px-4 pt-8 text-center">
            <p className="text-sm text-gray-500">No suggestions found</p>
            <button
              onClick={() => handleSearch(query)}
              className="mt-3 text-sm text-red-600 font-medium"
            >
              Search for &ldquo;{query}&rdquo;
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchSuggestionsPage
