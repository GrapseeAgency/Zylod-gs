'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search, Mic, Camera, Clock, X, ArrowLeft,
  ChevronRight, Flame, TrendingUp, Hash
} from 'lucide-react'

interface SearchHistoryItem {
  id: string
  query: string
  searchType: string
  createdAt: string
}

interface PopularSearch {
  id: string
  query: string
  searchCount: number
  trendingScore: number
  category?: string
}

interface Category {
  id: string
  name: string
  slug: string
  iconUrl?: string
}

export function SearchHomePage() {
  const { navigate, goBack } = useNavigationStore()
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [popular, setPopular] = useState<PopularSearch[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingPopular, setLoadingPopular] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetchHistory()
    fetchPopular()
    fetchCategories()
  }, [])

  async function fetchHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/search/history')
      if (res.ok) {
        const json = await res.json()
        setHistory(json.data || [])
      }
    } catch {
      // unauthenticated — just skip history
    } finally {
      setLoadingHistory(false)
    }
  }

  async function fetchPopular() {
    setLoadingPopular(true)
    try {
      const res = await fetch('/api/search/popular')
      if (res.ok) {
        const json = await res.json()
        setPopular(json.data || [])
      }
    } catch {
    } finally {
      setLoadingPopular(false)
    }
  }

  async function fetchCategories() {
    setLoadingCategories(true)
    try {
      const res = await fetch('/api/categories?limit=8&isActive=true')
      if (res.ok) {
        const json = await res.json()
        setCategories(json.data || json.categories || [])
      }
    } catch {
    } finally {
      setLoadingCategories(false)
    }
  }

  async function deleteHistoryItem(term: string) {
    setHistory(prev => prev.filter(h => h.query !== term))
    try {
      await fetch(`/api/search/history?term=${encodeURIComponent(term)}`, { method: 'DELETE' })
    } catch {}
  }

  async function clearAllHistory() {
    setHistory([])
    try {
      await fetch('/api/search/history', { method: 'DELETE' })
    } catch {}
  }

  function handleSearch(q: string) {
    if (!q.trim()) return
    navigate('search-results', { query: q.trim() })
  }

  return (
    <div className="overflow-x-hidden flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
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
          <button
            onClick={() => navigate('voice-search')}
            className="p-2 rounded-full bg-gray-100 hover:bg-red-50 transition"
          >
            <Mic className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => navigate('image-search')}
            className="p-2 rounded-full bg-gray-100 hover:bg-red-50 transition"
          >
            <Camera className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        {/* Recent Searches */}
        {(loadingHistory || history.length > 0) && (
          <section className="px-4 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Recent Searches</h2>
              {!loadingHistory && history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="text-xs text-red-600 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>
            {loadingHistory ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <AnimatePresence>
                  {history.slice(0, 8).map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: idx * 0.04 }}
                      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer group"
                      onClick={() => handleSearch(item.query)}
                    >
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-sm text-gray-700">{item.query}</span>
                      <button
                        onClick={e => { e.stopPropagation(); deleteHistoryItem(item.query) }}
                        className="opacity-0 group-hover:opacity-100 transition p-1"
                      >
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        )}

        {/* Popular Searches */}
        <section className="px-4 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-500" />
              Popular Searches
            </h2>
          </div>
          {loadingPopular ? (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
          ) : popular.length === 0 ? (
            <p className="text-sm text-gray-400">No trending searches yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {popular.map((item, idx) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleSearch(item.query)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 rounded-full text-sm text-gray-700 transition"
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>{item.query}</span>
                  {item.searchCount > 100 && (
                    <span className="text-xs text-gray-400">{(item.searchCount / 1000).toFixed(1)}k</span>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* Trending Categories */}
        <section className="pt-6">
          <div className="px-4 flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Browse Categories</h2>
            <button
              onClick={() => navigate('category-browser')}
              className="text-xs text-red-600 flex items-center gap-0.5"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {loadingCategories ? (
            <div className="flex gap-3 px-4 overflow-x-auto pb-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-20 w-20 flex-shrink-0 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 px-4 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat, idx) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate('category-products', { category: cat.slug })}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 bg-gray-50 hover:bg-red-50 rounded-xl w-20 transition"
                >
                  {cat.iconUrl ? (
                    <img src={cat.iconUrl} alt={cat.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <Hash className="w-8 h-8 text-gray-400" />
                  )}
                  <span className="text-xs text-gray-700 text-center leading-tight line-clamp-2">{cat.name}</span>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* Search tip */}
        <div className="px-4 pt-6 pb-4">
          <div className="bg-red-50 rounded-xl p-3 flex items-start gap-3">
            <Search className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-700">Wholesale Search Tips</p>
              <p className="text-xs text-red-600 mt-0.5">Try searching by product name, SKU, brand, or supplier name. Use filters on results to narrow by MOQ, price, and certifications.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchHomePage
