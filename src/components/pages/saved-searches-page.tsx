'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Bookmark, BookmarkX, Bell, BellOff, Search, Plus, Trash2 } from 'lucide-react'

interface SavedSearch {
  id: string
  name: string
  filterConfig: string
  isDefault: boolean
  createdAt: string
}

interface ParsedFilter {
  query?: string
  category?: string
  minPrice?: string
  maxPrice?: string
  moq?: string
}

export function SavedSearchesPage() {
  const { navigate, goBack } = useNavigationStore()
  const [saved, setSaved] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { fetchSaved() }, [])

  async function fetchSaved() {
    setLoading(true)
    try {
      const res = await fetch('/api/search/saved')
      if (res.ok) {
        const json = await res.json()
        setSaved(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  async function deleteSearch(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/search/saved/${id}`, { method: 'DELETE' })
      setSaved(prev => prev.filter(s => s.id !== id))
    } catch {}
    setDeleting(null)
  }

  function runSearch(s: SavedSearch) {
    try {
      const f: ParsedFilter = JSON.parse(s.filterConfig)
      navigate('search-results', { query: f.query || s.name, ...f })
    } catch {
      navigate('search-results', { query: s.name })
    }
  }

  function parseFilter(config: string): ParsedFilter {
    try { return JSON.parse(config) } catch { return {} }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1 md:text-xl">Saved Searches</span>
          <button onClick={() => navigate('search-home')} className="p-1.5 rounded-full hover:bg-gray-100 text-red-600">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10">
        {loading ? (
          <div className="px-4 pt-4 space-y-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : saved.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
            <Bookmark className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No saved searches</p>
            <p className="text-xs text-gray-400">Save a search to get notified when new products match your criteria</p>
            <button onClick={() => navigate('search-home')} className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl font-medium mt-2">Start Searching</button>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-3">
            <AnimatePresence>
              {saved.map((s, idx) => {
                const f = parseFilter(s.filterConfig)
                return (
                  <motion.div key={s.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-gray-50 rounded-xl p-3 group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bookmark className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                        {/* Filter pills */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {f.query && <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">"{f.query}"</span>}
                          {f.category && <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">{f.category}</span>}
                          {f.minPrice && <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">Min ৳{f.minPrice}</span>}
                          {f.maxPrice && <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">Max ৳{f.maxPrice}</span>}
                          {f.moq && <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">MOQ ≤{f.moq}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSearch(s.id)}
                        disabled={deleting === s.id}
                        className="p-1.5 opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => runSearch(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition">
                        <Search className="w-3 h-3" /> Search Now
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50 transition">
                        <Bell className="w-3 h-3" /> Alert
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

export default SavedSearchesPage
