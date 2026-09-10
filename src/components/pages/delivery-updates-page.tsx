'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Truck, Package, Clock, CheckCircle2,
  MapPin, Copy, ExternalLink, RefreshCw, AlertCircle,
  ChevronRight, Check
} from 'lucide-react'

interface DeliveryUpdate {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  isRead: boolean
  relatedId?: string | null
  order?: {
    orderId: string
    subOrderId?: string
    orderNumber: string | null
    status: string | null
    trackingNumber: string | null
    carrier: string | null
    estimatedDelivery: string | null
  } | null
}

export function DeliveryUpdatesPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [activeFilter, setActiveFilter] = useState<'all' | 'in_transit' | 'delivered'>('all')
  const [updates, setUpdates] = useState<DeliveryUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/notifications/delivery-updates?limit=30', { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setUpdates(data.data)
      }
    } catch (err) {
      console.error('Failed to load delivery updates:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  const filteredUpdates = updates.filter(u => {
    if (activeFilter === 'all') return true
    const st = u.order?.status?.toLowerCase() || ''
    if (activeFilter === 'delivered') return st === 'delivered'
    if (activeFilter === 'in_transit') return st === 'shipped' || st === 'packed' || st === 'confirmed'
    return true
  })

  const copyTracking = (tracking: string, id: string) => {
    navigator.clipboard.writeText(tracking)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStepProgress = (status: string | null | undefined) => {
    const s = status?.toLowerCase()
    if (s === 'delivered') return 4
    if (s === 'out_for_delivery') return 3
    if (s === 'shipped') return 2
    if (s === 'packed' || s === 'confirmed') return 1
    return 0
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <h1 className="font-bold text-gray-900 text-base">Delivery Updates</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('delivery-tracking-alerts')}
          className="text-xs font-bold text-emerald-600 hover:underline"
        >
          Live Tracking →
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
        {[
          { key: 'all', label: 'All Dispatches' },
          { key: 'in_transit', label: 'In Transit' },
          { key: 'delivered', label: 'Delivered' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              activeFilter === tab.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto w-full space-y-4 pb-24 md:pb-8 lg:max-w-5xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-3">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-8 w-full rounded-xl" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            ))}
          </div>
        ) : filteredUpdates.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No delivery alerts right now</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Real-time courier GPS tracking, Steadfast/Pathao/RedX waybills, and arrival time estimates will appear here.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('orders')}
                className="text-xs font-bold"
              >
                Track Orders
              </Button>
            </div>
          </div>
        ) : (
          <>
          <div className="md:hidden space-y-4">
          {filteredUpdates.map((item, idx) => {
            const step = getStepProgress(item.order?.status)
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4 hover:border-emerald-200 transition"
              >
                {/* Top Info */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      {item.order?.orderNumber || item.title}
                    </span>
                    {item.order?.carrier && (
                      <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                        Carrier: {item.order.carrier}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-gray-400">
                    {new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {/* Delivery Pipeline Visualization */}
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {['Confirmed', 'Dispatched', 'In Transit', 'Delivered'].map((stLabel, sIdx) => {
                      const isComplete = step >= sIdx + 1
                      return (
                        <div key={stLabel} className="space-y-1">
                          <div className={`h-1.5 rounded-full transition ${isComplete ? 'bg-emerald-500' : 'bg-gray-100'}`} />
                          <span className={`text-[9px] block ${isComplete ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>
                            {stLabel}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tracking & Message */}
                <p className="text-xs text-gray-600 leading-relaxed">
                  {item.message}
                </p>

                {/* Waybill / Tracking Action */}
                {item.order?.trackingNumber && (
                  <div className="bg-slate-50 rounded-xl p-2.5 flex items-center justify-between text-xs border border-gray-100">
                    <span className="text-gray-500">
                      Consignment: <strong className="text-gray-800">{item.order.trackingNumber}</strong>
                    </span>
                    <button
                      onClick={() => copyTracking(item.order!.trackingNumber!, item.id)}
                      className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-[11px]"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy ID
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                  {item.order?.estimatedDelivery && (
                    <span className="text-[11px] text-gray-400">
                      Est. Arrival: <strong>{new Date(item.order.estimatedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong>
                    </span>
                  )}

                  {item.order?.orderId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('order-detail', { orderId: item.order!.orderId })}
                      className="h-7 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 ml-auto"
                    >
                      Consignment Details →
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50/50 text-left">
                  <th className="p-3 text-xs font-semibold text-gray-700">Order</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Latest Update</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Status</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Consignment</th>
                  <th className="p-3 text-xs font-semibold text-gray-700">Est. Arrival</th>
                  <th className="p-3 text-xs font-semibold text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUpdates.map(item => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-red-50/30">
                    <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{item.order?.orderNumber || item.title}</td>
                    <td className="p-3 text-gray-600">{item.message}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                        {item.order?.status || 'In Transit'}
                      </span>
                    </td>
                    <td className="p-3">
                      {item.order?.trackingNumber ? (
                        <button
                          onClick={() => copyTracking(item.order!.trackingNumber!, item.id)}
                          className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-[11px]"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy ID
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-500 whitespace-nowrap">
                      {item.order?.estimatedDelivery
                        ? new Date(item.order.estimatedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '-'}
                    </td>
                    <td className="p-3">
                      {item.order?.orderId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('order-detail', { orderId: item.order!.orderId })}
                          className="h-7 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        >
                          Details
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
      </div>
    </div>
  )
}

export default DeliveryUpdatesPage
