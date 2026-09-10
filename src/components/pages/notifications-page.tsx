'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bell, CheckCheck, Trash2, ArrowLeft, Filter, Search,
  Package, Truck, Tag, TrendingDown, Layers, Shield,
  MessageSquare, RefreshCw, AlertCircle, ChevronRight,
  SlidersHorizontal, Inbox
} from 'lucide-react'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  isRead: boolean
  relatedId?: string | null
}

export function NotificationsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'order' | 'promotion' | 'delivery' | 'system'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1 && !append) setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      let url = `/api/notifications?page=${pageNum}&limit=20`
      if (activeTab === 'unread') {
        url += '&unreadOnly=true'
      } else if (activeTab !== 'all') {
        url = `/api/notifications/by-type?type=${activeTab}&page=${pageNum}&limit=20`
      }

      const res = await fetch(url, { headers })
      const data = await res.json()

      if (data.success) {
        setNotifications(prev => append ? [...prev, ...(data.data || [])] : (data.data || []))
        if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount)
        setHasMore((data.pagination?.page || 1) < (data.pagination?.totalPages || 1))
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, activeTab])

  useEffect(() => {
    setPage(1)
    fetchNotifications(1, false)
  }, [fetchNotifications])

  const handleMarkAllRead = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers,
        body: JSON.stringify({ markAll: true }),
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Package className="w-5 h-5 text-blue-600" />
      case 'delivery':
        return <Truck className="w-5 h-5 text-emerald-600" />
      case 'promotion':
        return <Tag className="w-5 h-5 text-amber-600" />
      case 'price_drop':
        return <TrendingDown className="w-5 h-5 text-red-600" />
      case 'back_in_stock':
        return <Layers className="w-5 h-5 text-teal-600" />
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-indigo-600" />
      default:
        return <Bell className="w-5 h-5 text-gray-600" />
    }
  }

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'order': return 'bg-blue-50 border-blue-100'
      case 'delivery': return 'bg-emerald-50 border-emerald-100'
      case 'promotion': return 'bg-amber-50 border-amber-100'
      case 'price_drop': return 'bg-red-50 border-red-100'
      case 'back_in_stock': return 'bg-teal-50 border-teal-100'
      case 'chat': return 'bg-indigo-50 border-indigo-100'
      default: return 'bg-gray-50 border-gray-100'
    }
  }

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-gray-900 text-base md:text-xl">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate('notification-search')}
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition"
            title="Search notifications"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('push-notification-settings')}
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition"
            title="Notification Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'order', label: 'Orders' },
          { key: 'delivery', label: 'Delivery' },
          { key: 'promotion', label: 'Promos' },
          { key: 'system', label: 'System' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              activeTab === tab.key
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List Content */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto lg:max-w-5xl w-full space-y-3 md:space-y-4 pb-24 md:pb-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 flex gap-3 items-start animate-pulse">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No notifications found</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              {activeTab === 'unread' ? 'You have caught up on all your alerts.' : 'You will be notified about orders, deliveries, price changes, and deals here.'}
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNotifications(1, false)}
                className="text-xs font-bold gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence initial={false}>
            {notifications.map((notif, idx) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                onClick={() => navigate('notification-detail', { id: notif.id })}
                className={`group relative bg-white rounded-2xl p-4 border transition cursor-pointer shadow-sm hover:shadow hover:border-gray-300 ${
                  !notif.isRead ? 'border-red-200 bg-red-50/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${getTypeBg(notif.type)}`}>
                    {getTypeIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`text-xs sm:text-sm truncate ${!notif.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-50 text-[11px] text-gray-400">
                      <span>{formatTime(notif.timestamp)}</span>
                      <span className="capitalize font-semibold text-gray-500 flex items-center gap-1 group-hover:text-red-600 transition">
                        View details <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDelete(notif.id, e)}
                  className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100 sm:opacity-70"
                  title="Delete notification"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="text-center pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = page + 1
                setPage(next)
                fetchNotifications(next, true)
              }}
              className="text-xs font-bold px-6 py-2"
            >
              Load Older Notifications
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage
