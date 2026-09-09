'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Search, X, Clock, ChevronRight,
  Package, Truck, Tag, TrendingDown, Layers, Bell
} from 'lucide-react'

export function NotificationSearchPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [query, setQuery] = useState('')
  const [allNotifs, setAllNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/notifications?limit=50', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setAllNotifs(data.data)
        }
      })
      .catch(console.error)
  }, [token])

  const results = query.trim()
    ? allNotifs.filter(n =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.message.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const searchChips = ['Orders', 'Delivery', 'Dispatched', 'Price Drop', 'Discount', 'bKash']

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Search Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>

        <div className="flex-1 relative">
          <Input
            autoFocus
            placeholder="Search notification title or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-xs pr-8"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-2xl mx-auto lg:max-w-3xl w-full space-y-4 md:space-y-6 pb-24 md:pb-8">
        {!query ? (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Popular Search Terms
            </h3>
            <div className="flex flex-wrap gap-2">
              {searchChips.map(chip => (
                <button
                  key={chip}
                  onClick={() => setQuery(chip)}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-full text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-gray-500 space-y-2">
            <Search className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="font-bold text-sm text-gray-700">No matching notifications</p>
            <p className="text-xs">Try searching for order numbers, couriers, or keywords.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-gray-500 px-1">
              Found {results.length} result{results.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {results.map(n => (
                <div
                  key={n.id}
                  onClick={() => navigate('notification-detail', { id: n.id })}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-red-200 cursor-pointer transition space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900">{n.title}</h4>
                    <span className="text-[10px] text-gray-400">
                      {new Date(n.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationSearchPage
