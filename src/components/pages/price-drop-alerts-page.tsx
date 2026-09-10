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
  ArrowLeft, TrendingDown, Plus, Trash2, SlidersHorizontal,
  Package, CheckCircle2, AlertCircle, ShoppingCart, Tag,
  ChevronRight
} from 'lucide-react'

interface PriceAlert {
  id: string
  productId: string
  productName: string
  productImage: string | null
  currentPrice: number
  targetPrice: number
  status: string
  inStock: boolean
  savings: number
  savingsPercent: number
  lastNotifiedAt: string | null
  createdAt: string
}

export function PriceDropAlertsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [activeTab, setActiveTab] = useState<'active' | 'triggered' | 'cancelled'>('active')
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/price-alerts?status=${activeTab}&limit=50`, { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setAlerts(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch price alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [token, activeTab])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch(`/api/price-alerts/${id}`, { method: 'DELETE', headers })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Failed to cancel alert:', err)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header (mobile only; desktop uses the global Header + desktop title row below) */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h1 className="font-bold text-gray-900 text-base">Price Drop Alerts</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('push-notification-settings')}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition"
            title="Alert Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <Button
            size="sm"
            onClick={() => navigate('price-alert-create')}
            className="h-8 px-3 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Set Alert</span>
          </Button>
        </div>
      </div>

      {/* Desktop title row */}
      <div className="hidden md:flex items-center justify-between max-w-5xl mx-auto w-full px-6 pt-6">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-600" />
          <h1 className="text-2xl font-bold text-gray-900">Price Drop Alerts</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('push-notification-settings')}
            className="border-gray-200 text-gray-600"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Alert Settings
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('price-alert-create')}
            className="h-9 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Set Alert
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 md:px-6">
        {[
          { key: 'active', label: 'Active Watches' },
          { key: 'triggered', label: 'Price Dropped' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === tab.key
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List Content */}
      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full space-y-3 pb-24 md:px-6 md:py-6 md:pb-8 lg:max-w-5xl md:space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 flex gap-3 animate-pulse">
                <Skeleton className="w-16 h-16 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <TrendingDown className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">
              {activeTab === 'active' ? 'No active price watches' : 'No alerts in this tab'}
            </h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Set target prices on wholesale goods to get notified instantly when suppliers lower their rates.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => navigate('price-alert-create')}
                className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create New Price Alert
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
          {alerts.map(alert => {
            const hasTriggered = alert.currentPrice <= alert.targetPrice
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('product-detail', { productId: alert.productId })}
                className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-sm hover:shadow hover:border-red-200 ${
                  hasTriggered ? 'border-green-200 bg-green-50/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {alert.productImage ? (
                      <img
                        src={alert.productImage}
                        alt={alert.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {alert.productName}
                    </h3>

                    {/* Price Comparison Row */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Current Price</span>
                        <span className="font-bold text-gray-900">
                          {formatPrice(alert.currentPrice)}
                        </span>
                      </div>
                      <div className="text-gray-300">→</div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Target Alert Price</span>
                        <span className="font-bold text-red-600">
                          {formatPrice(alert.targetPrice)}
                        </span>
                      </div>

                      {hasTriggered && (
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-bold text-green-700 bg-green-100 rounded-md">
                          TARGET MET!
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 text-[11px]">
                      <span className="text-gray-400">
                        Created {new Date(alert.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>

                      <button
                        onClick={(e) => handleDelete(alert.id, e)}
                        className="text-red-500 hover:text-red-700 font-semibold"
                      >
                        Remove Watch
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PriceDropAlertsPage
