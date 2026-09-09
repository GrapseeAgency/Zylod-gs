'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Package, Clock, CheckCircle2, Truck,
  AlertCircle, ChevronRight, RefreshCw, ShoppingBag,
  ExternalLink, Bell
} from 'lucide-react'

interface OrderUpdateNotification {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  isRead: boolean
  relatedId?: string | null
  order?: {
    orderId: string
    orderNumber: string | null
    status: string | null
    totalAmount: number | null
    supplierName: string | null
    placedAt: string | null
  } | null
}

export function OrderUpdatesPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'shipped' | 'delivered' | 'cancelled'>('all')
  const [updates, setUpdates] = useState<OrderUpdateNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const fetchOrderUpdates = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1 && !append) setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      let url = `/api/notifications/order-updates?page=${pageNum}&limit=20`
      if (activeFilter !== 'all') {
        url += `&status=${activeFilter}`
      }

      const res = await fetch(url, { headers })
      const data = await res.json()

      if (data.success) {
        setUpdates(prev => append ? [...prev, ...(data.data || [])] : (data.data || []))
        setHasMore((data.pagination?.page || 1) < (data.pagination?.totalPages || 1))
      }
    } catch (err) {
      console.error('Failed to fetch order updates:', err)
    } finally {
      setLoading(false)
    }
  }, [token, activeFilter])

  useEffect(() => {
    setPage(1)
    fetchOrderUpdates(1, false)
  }, [fetchOrderUpdates])

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Delivered</Badge>
      case 'shipped':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">In Transit</Badge>
      case 'processing':
      case 'confirmed':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Processing</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Cancelled</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200">Pending</Badge>
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
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h1 className="font-bold text-gray-900 text-base">Order Updates</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('order-status-subscriptions')}
          className="text-xs font-bold text-blue-600 hover:underline"
        >
          Manage Alerts →
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: 'All Updates' },
          { key: 'pending', label: 'Processing' },
          { key: 'shipped', label: 'In Transit' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              activeFilter === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <button
          onClick={() => navigate('order-status-subscriptions')}
          className="hidden md:block ml-auto text-xs font-bold text-blue-600 hover:underline"
        >
          Manage Alerts →
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto lg:max-w-5xl w-full space-y-3 pb-24 md:pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-2">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-8 w-28 rounded-xl" />
              </div>
            ))}
          </div>
        ) : updates.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No order updates yet</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Real-time progress, shipment tracking, and delivery receipts for your wholesale purchases will appear here.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('orders')}
                className="text-xs font-bold"
              >
                View All Orders
              </Button>
            </div>
          </div>
        ) : (
          <>
          <div className="md:hidden space-y-3">
          {updates.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 hover:border-blue-200 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-900">
                      {item.order?.orderNumber || item.title}
                    </span>
                    {item.order?.supplierName && (
                      <p className="text-[11px] text-gray-400">Supplier: {item.order.supplierName}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(item.order?.status)}
                </div>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">
                {item.message}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                <span className="text-gray-400 text-[11px]">
                  {new Date(item.timestamp).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </span>

                {item.relatedId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('order-detail', { orderId: item.relatedId! })}
                    className="h-7 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    View Order →
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('orders')}
                    className="h-7 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    All Orders →
                  </Button>
                )}
              </div>
            </motion.div>
          ))
          }
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-gray-500">Order</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-gray-500">Update</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-gray-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {updates.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-gray-900 block">{item.order?.orderNumber || item.title}</span>
                      {item.order?.supplierName && (
                        <span className="text-[11px] text-gray-400 block mt-0.5">Supplier: {item.order.supplierName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-700 line-clamp-2">{item.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(item.order?.status)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {item.relatedId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('order-detail', { orderId: item.relatedId! })}
                          className="h-7 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          View Order →
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('orders')}
                          className="h-7 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          All Orders →
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {hasMore && !loading && (
          <div className="text-center pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = page + 1
                setPage(next)
                fetchOrderUpdates(next, true)
              }}
              className="text-xs font-bold px-6"
            >
              Load Older Updates
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderUpdatesPage
