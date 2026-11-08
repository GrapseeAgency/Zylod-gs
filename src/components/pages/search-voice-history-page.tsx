'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useSearchHistory } from '@/hooks/use-search-history'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Mic, Search, Trash2, Clock } from 'lucide-react'

interface VoiceHistoryItem {
  id: string
  query: string
  createdAt: string
}

export function SearchVoiceHistoryPage() {
  const { navigate, goBack } = useNavigationStore()
  // Dual-source (t293): buyers → server voice history; guests → the
  // device-local store (search-results records voice searches locally with
  // their real type, so the ?type=voice filter has honest guest rows too).
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const { items: localVoice, remove: removeLocal } = useSearchHistory('voice')
  const [items, setItems] = useState<VoiceHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchHistory() {
    setLoading(true)
    try {
      const res = await fetch('/api/search/history?type=voice')
      if (res.ok) {
        const json = await res.json()
        setItems(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (isAuthenticated) fetchHistory()
    else setLoading(false)
  }, [isAuthenticated])

  const rows: VoiceHistoryItem[] = isAuthenticated
    ? items
    : localVoice.map(i => ({ id: i.id, query: i.query, createdAt: new Date(i.searchedAt).toISOString() }))

  async function deleteVoiceItem(term: string) {
    if (!isAuthenticated) {
      for (const row of localVoice.filter(i => i.query === term)) removeLocal(row.id)
      return
    }
    setItems(prev => prev.filter(i => i.query !== term))
    try {
      await fetch(`/api/search/history?term=${encodeURIComponent(term)}`, { method: 'DELETE' })
    } catch {}
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 pt-4 pb-3 flex items-center justify-between md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <span className="font-semibold text-gray-900 dark:text-gray-100 md:text-xl">Voice Search History</span>
        </div>
        <button
          onClick={() => navigate('voice-search')}
          className="flex items-center gap-1 text-xs text-red-600 font-medium"
        >
          <Mic className="w-3.5 h-3.5" />
          New Voice Search
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-10 md:px-6">
        <div className="md:max-w-3xl md:mx-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 px-4">
            <Mic className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No voice searches recorded</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tap below to try voice search</p>
            <button
              onClick={() => navigate('voice-search')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold"
            >
              Start Voice Search
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950"
              >
                <div
                  onClick={() => navigate('search-results', { query: item.query, type: 'voice' })}
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0 text-primary/80">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">&ldquo;{item.query}&rdquo;</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteVoiceItem(item.query)}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default SearchVoiceHistoryPage
