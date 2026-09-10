'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Archive, Trash2, Clock, CheckCircle2,
  Package, Truck, Tag, TrendingDown, Layers, Bell
} from 'lucide-react'

export function NotificationArchivePage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [archived, setArchived] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const fetchArchive = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/notifications/archive?limit=50', { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setArchived(data.data)
      }
    } catch (err) {
      console.error('Failed to load archive:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchArchive()
  }, [fetchArchive])

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all archived notifications?')) return
    try {
      setClearing(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/notifications/archive', { method: 'DELETE', headers })
      setArchived([])
    } catch (err) {
      console.error('Failed to clear archive:', err)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-600" />
            <h1 className="font-bold text-gray-900 text-base">Notification Archive</h1>
          </div>
        </div>

        {archived.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="flex items-center gap-1 text-xs font-bold text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Archive
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto lg:max-w-6xl w-full space-y-3 md:space-y-5 pb-24 md:pb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>
            Notifications older than 30 days are automatically archived here and will be purged periodically.
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-2">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-3 w-full rounded" />
              </div>
            ))}
          </div>
        ) : archived.length === 0 ? (
          <div className="text-center py-16 space-y-2 text-gray-500">
            <Archive className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="font-bold text-sm text-gray-700">No Archived Notifications</p>
            <p className="text-xs">Notifications older than 30 days will appear in this repository.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
          {archived.map(item => (
            <div
              key={item.id}
              onClick={() => navigate('notification-detail', { id: item.id })}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm opacity-80 hover:opacity-100 transition cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">{item.title}</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{item.message}</p>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationArchivePage
