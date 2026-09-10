'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Bell, Package, Truck, Tag, TrendingDown,
  Layers, MessageSquare, Trash2, ExternalLink, Clock,
  CheckCircle2, AlertTriangle, Share2
} from 'lucide-react'

interface NotificationDetail {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  isRead: boolean
  relatedId?: string | null
}

export function NotificationDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()

  const notificationId = pageParams?.id || ''
  const [notification, setNotification] = useState<NotificationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!notificationId) {
      setLoading(false)
      return
    }

    const fetchDetail = async () => {
      try {
        setLoading(true)
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(`/api/notifications/${notificationId}`, { headers })
        const data = await res.json()
        if (data.success && data.data) {
          setNotification(data.data)
        }
      } catch (err) {
        console.error('Failed to load notification detail:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [notificationId, token])

  const handleDelete = async () => {
    if (!notificationId) return
    try {
      setDeleting(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE', headers })
      goBack()
    } catch (err) {
      console.error('Failed to delete notification:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleAction = () => {
    if (!notification) return

    switch (notification.type) {
      case 'order':
        if (notification.relatedId) {
          navigate('order-detail', { orderId: notification.relatedId })
        } else {
          navigate('orders')
        }
        break
      case 'delivery':
        if (notification.relatedId) {
          navigate('delivery-updates')
        } else {
          navigate('orders')
        }
        break
      case 'price_drop':
        if (notification.relatedId) {
          navigate('product-detail', { productId: notification.relatedId })
        } else {
          navigate('price-drop-alerts')
        }
        break
      case 'back_in_stock':
        if (notification.relatedId) {
          navigate('product-detail', { productId: notification.relatedId })
        } else {
          navigate('back-in-stock-alerts')
        }
        break
      case 'promotion':
        if (notification.relatedId) {
          navigate('product-detail', { productId: notification.relatedId })
        } else {
          navigate('promo-notifications')
        }
        break
      default:
        navigate('notifications')
    }
  }

  const getActionLabel = () => {
    switch (notification?.type) {
      case 'order': return 'View Order Details →'
      case 'delivery': return 'Track Shipment →'
      case 'price_drop': return 'View Discounted Product →'
      case 'back_in_stock': return 'Order Now While in Stock →'
      case 'promotion': return 'Explore Promotion →'
      default: return 'Explore Platform →'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'order': return <Package className="w-6 h-6 text-blue-600" />
      case 'delivery': return <Truck className="w-6 h-6 text-emerald-600" />
      case 'promotion': return <Tag className="w-6 h-6 text-amber-600" />
      case 'price_drop': return <TrendingDown className="w-6 h-6 text-red-600" />
      case 'back_in_stock': return <Layers className="w-6 h-6 text-teal-600" />
      default: return <Bell className="w-6 h-6 text-gray-600" />
    }
  }

  const getTypeHeaderBg = (type: string) => {
    switch (type) {
      case 'order': return 'from-blue-600 to-indigo-700'
      case 'delivery': return 'from-emerald-600 to-teal-700'
      case 'promotion': return 'from-amber-600 to-orange-700'
      case 'price_drop': return 'from-red-600 to-rose-700'
      case 'back_in_stock': return 'from-teal-600 to-cyan-700'
      default: return 'from-slate-800 to-slate-900'
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Notification Detail</span>
        </div>

        {notification && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
            title="Delete notification"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-2xl mx-auto lg:max-w-3xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : !notification ? (
          <div className="text-center py-16 space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className="font-bold text-gray-900 text-base">Notification not found</h3>
            <p className="text-xs text-gray-500">This notification may have expired or been deleted.</p>
            <Button onClick={goBack} variant="outline" size="sm">Go Back</Button>
          </div>
        ) : (
          <>
            {/* Type Header Banner */}
            <div className={`bg-gradient-to-r ${getTypeHeaderBg(notification.type)} rounded-3xl p-6 text-white shadow-md space-y-3`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  {notification.type.replace('_', ' ')}
                </span>
                <span className="text-xs text-white/80 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(notification.timestamp).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold leading-snug">{notification.title}</h1>
            </div>

            {/* Notification Full Content Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Full Message Body
              </h2>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {notification.message}
              </p>

              {/* Status Badge */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400">Read Status</span>
                <span className="flex items-center gap-1 font-bold text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> Delivered &amp; Read
                </span>
              </div>
            </div>

            {/* Action CTA */}
            <div className="flex flex-col md:flex-row gap-3 pt-2">
              <Button
                onClick={handleAction}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md transition text-xs sm:text-sm"
              >
                {getActionLabel()}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('notifications')}
                className="w-full py-3 rounded-2xl text-xs font-bold"
              >
                Back to All Notifications
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default NotificationDetailPage
