'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, TrendingUp, Flame, BarChart2, Search, ChevronRight } from 'lucide-react'

interface PopularSearch {
  id: string
  query: string
  searchCount: number
  clickCount: number
  trendingScore: number
  category?: string
  lastSearchedAt: string
}

export function PopularSearchesPage() {
  const { navigate, goBack } = useNavigationStore()
  const [searches, setSearches] = useState<PopularSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trending' | 'most-searched' | 'category'>('trending')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => { fetchPopular() }, [])

  async function fetchPopular() {
    setLoading(true)
    try {
      const res = await fetch('/api/search/popular?limit=40')
      if (res.ok) {
        const json = await res.json()
        setSearches(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  const categories = Array.from(new Set(searches.map(s => s.category).filter(Boolean))) as string[]

  const filtered = searches
    .filter(s => !selectedCategory || s.category === selectedCategory)
    .sort((a, b) => {
      if (activeTab === 'trending') return b.trendingScore - a.trendingScore
      if (activeTab === 'most-searched') return b.searchCount - a.searchCount
      return b.trendingScore - a.trendingScore
    })
    .slice(0, 30)

  const maxCount = Math.max(...filtered.map(s => s.searchCount), 1)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1 md:text-xl">Popular Searches</span>
          <button onClick={() => navigate('search-home')} className="p-1.5 rounded-full hover:bg-gray-100"><Search className="w-4 h-4 text-gray-600" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          {([
            { key: 'trending', label: 'Trending', Icon: TrendingUp },
            { key: 'most-searched', label: 'Most Searched', Icon: BarChart2 },
          ] as const).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${activeTab === key ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs transition ${!selectedCategory ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs transition capitalize ${selectedCategory === cat ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10">
        {loading ? (
          <div className="px-4 pt-4 space-y-3">
            {[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Flame className="w-12 h-12 text-gray-200" />
            <p className="text-sm text-gray-500">No trending searches yet</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-2 md:px-6 md:max-w-4xl md:mx-auto md:w-full md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
            {filtered.map((item, idx) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => navigate('search-results', { query: item.query })}
                className="w-full flex items-center gap-3 bg-gray-50 hover:bg-red-50 rounded-xl px-3 py-3 transition group"
              >
                {/* Rank */}
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
                  idx === 0 ? 'bg-red-600 text-white' : idx === 1 ? 'bg-orange-400 text-white' : idx === 2 ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-800 group-hover:text-red-700 truncate">{item.query}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Progress bar showing relative volume */}
                    <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.round((item.searchCount / maxCount) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {item.searchCount >= 1000 ? `${(item.searchCount / 1000).toFixed(1)}k` : item.searchCount} searches
                    </span>
                  </div>
                </div>
                {item.category && (
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0 capitalize">{item.category}</span>
                )}
                {idx < 3 && <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PopularSearchesPage
