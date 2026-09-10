'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Layers, Plus, Trash2, Package, CheckCircle2,
  AlertCircle, ShoppingCart, ChevronRight
} from 'lucide-react'

interface StockAlert {
  id: string
  productId: string
  productName: string
  productImage: string | null
  currentPrice: number
  stockQuantity: number
  inStock: boolean
  status: string
  lastNotifiedAt: string | null
  createdAt: string
}

export function BackInStockAlertsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [activeTab, setActiveTab] = useState<'active' | 'notified' | 'cancelled'>('active')
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/stock-alerts?status=${activeTab}&limit=50`, { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setAlerts(data.data)
      }
    } catch (err) {
      console.error('Failed to load stock alerts:', err)
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

      await fetch(`/api/stock-alerts/${id}`, { method: 'DELETE', headers })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Failed to cancel stock alert:', err)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            <h1 className="font-bold text-gray-900 text-base">Back in Stock Alerts</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('stock-alert-create')}
          className="h-8 px-3 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Watch Product</span>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
        {[
          { key: 'active', label: 'Watching (Out of Stock)' },
          { key: 'notified', label: 'Restocked!' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === tab.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alert Cards List */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto lg:max-w-5xl w-full space-y-3 pb-24 md:pb-8">
        {/* Desktop page title */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            <h1 className="text-2xl font-black text-gray-900">Back in Stock Alerts</h1>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('stock-alert-create')}
            className="h-9 px-3 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Watch Product
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 flex gap-3 animate-pulse">
                <Skeleton className="w-16 h-16 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">
              {activeTab === 'active' ? 'No stock watches active' : 'No restocked alerts here'}
            </h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Get notified immediately when sold-out wholesale inventory is replenished by factories.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => navigate('stock-alert-create')}
                className="text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Restock Alert
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate('product-detail', { productId: alert.productId })}
              className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-sm hover:shadow hover:border-teal-200 ${
                alert.inStock ? 'border-teal-300 bg-teal-50/20' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
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
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {alert.productName}
                    </h3>
                    {alert.inStock ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold text-teal-700 bg-teal-100 rounded-md flex-shrink-0">
                        {alert.stockQuantity} units available
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-gray-100 rounded-md flex-shrink-0">
                        Awaiting Restock
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-gray-700 mt-1">
                    {formatPrice(alert.currentPrice)}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 text-[11px]">
                    <span className="text-gray-400">
                      Watched since {new Date(alert.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>

                    {alert.inStock ? (
                      <span className="font-bold text-teal-600 flex items-center gap-1">
                        Order Now <ChevronRight className="w-3 h-3" />
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleDelete(alert.id, e)}
                        className="text-red-500 hover:text-red-700 font-semibold"
                      >
                        Cancel Watch
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BackInStockAlertsPage
