'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, X, Search, ArrowLeft, Mic, Camera, Smartphone } from 'lucide-react'

interface HistoryItem {
  id: string
  query: string
  searchType: string
  resultCount: number
  createdAt: string
}

interface HistoryGroup {
  label: string
  items: HistoryItem[]
}

function groupLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupByDate(items: HistoryItem[]): HistoryGroup[] {
  const map = new Map<string, HistoryItem[]>()
  for (const item of items) {
    const label = groupLabel(item.createdAt)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(item)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

const typeIcon = (t: string) => {
  if (t === 'voice') return <Mic className="w-3.5 h-3.5 text-blue-400" />
  if (t === 'image') return <Camera className="w-3.5 h-3.5 text-purple-400" />
  if (t === 'barcode') return <Smartphone className="w-3.5 h-3.5 text-green-400" />
  return <Search className="w-3.5 h-3.5 text-gray-400" />
}

export function SearchHistoryPage() {
  const { navigate, goBack } = useNavigationStore()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'text' | 'voice' | 'image' | 'barcode'>('all')

  useEffect(() => { fetchHistory() }, [])

  async function fetchHistory() {
    setLoading(true)
    try {
      const res = await fetch('/api/search/history')
      if (res.ok) {
        const json = await res.json()
        setHistory(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  async function deleteItem(query: string) {
    setHistory(prev => prev.filter(h => h.query !== query))
    await fetch(`/api/search/history?term=${encodeURIComponent(query)}`, { method: 'DELETE' }).catch(() => {})
  }

  async function clearAll() {
    setHistory([])
    await fetch('/api/search/history', { method: 'DELETE' }).catch(() => {})
  }

  const filtered = history.filter(h => filter === 'all' || h.searchType === filter)
  const groups = groupByDate(filtered)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-700" /></button>
          <span className="font-semibold text-gray-900 flex-1 md:text-xl">Search History</span>
          {history.length > 0 && <button onClick={clearAll} className="text-sm text-red-600 font-medium">Clear All</button>}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {(['all', 'text', 'voice', 'image', 'barcode'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize transition ${filter === f ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        <div className="md:max-w-3xl md:mx-auto">
        {loading ? (
          <div className="px-4 pt-4 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6 gap-3">
            <Clock className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No search history yet</p>
            <p className="text-xs text-gray-400">Your recent searches will appear here</p>
            <button onClick={() => navigate('search-home')} className="mt-2 px-4 py-2 bg-red-600 text-white text-sm rounded-xl font-medium">Start Searching</button>
          </div>
        ) : (
          <div>
            {groups.map(group => (
              <section key={group.label}>
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">{group.label}</p>
                <AnimatePresence>
                  {group.items.map((item, idx) => (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 group cursor-pointer"
                      onClick={() => navigate('search-results', { query: item.query })}>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {typeIcon(item.searchType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{item.query}</p>
                        {item.resultCount > 0 && <p className="text-xs text-gray-400">{item.resultCount} results</p>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteItem(item.query) }}
                        className="opacity-0 group-hover:opacity-100 transition p-1">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </section>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default SearchHistoryPage
