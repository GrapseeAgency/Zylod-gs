'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Tag, Sparkles, Flame, Percent, Gift,
  ChevronRight, Megaphone, ShoppingBag, SlidersHorizontal
} from 'lucide-react'

interface PromoNotification {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  isRead: boolean
  relatedId?: string | null
}

export function PromoNotificationsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [promos, setPromos] = useState<PromoNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<'all' | 'flash' | 'seasonal' | 'clearance' | 'coupon'>('all')

  const fetchPromos = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/notifications/by-type?type=promotion&limit=30', { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setPromos(data.data)
      }
    } catch (err) {
      console.error('Failed to load promotions:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchPromos()
  }, [fetchPromos])

  const filteredPromos = promos.filter(p => {
    if (activeCategory === 'all') return true
    const text = (p.title + ' ' + p.message).toLowerCase()
    if (activeCategory === 'flash') return text.includes('flash') || text.includes('hour')
    if (activeCategory === 'seasonal') return text.includes('season') || text.includes('eid') || text.includes('puja')
    if (activeCategory === 'clearance') return text.includes('clearance') || text.includes('stock')
    if (activeCategory === 'coupon') return text.includes('coupon') || text.includes('code') || text.includes('voucher')
    return true
  })

  const getPromoTheme = (title: string, message: string) => {
    const text = (title + ' ' + message).toLowerCase()
    if (text.includes('flash') || text.includes('fire')) {
      return { border: 'border-l-4 border-l-red-500', icon: Flame, iconBg: 'bg-red-50 text-red-600' }
    }
    if (text.includes('coupon') || text.includes('code')) {
      return { border: 'border-l-4 border-l-emerald-500', icon: Gift, iconBg: 'bg-emerald-50 text-emerald-600' }
    }
    if (text.includes('clearance')) {
      return { border: 'border-l-4 border-l-amber-500', icon: Percent, iconBg: 'bg-amber-50 text-amber-600' }
    }
    return { border: 'border-l-4 border-l-purple-500', icon: Sparkles, iconBg: 'bg-purple-50 text-purple-600' }
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
            <Tag className="w-5 h-5 text-amber-600" />
            <h1 className="font-bold text-gray-900 text-base">Promotions &amp; Deals</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('promo-preferences')}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition"
          title="Promo preferences"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Hero Banner */}
      <div className="px-4 pt-4 max-w-3xl mx-auto w-full md:max-w-5xl md:px-6 md:pt-6">
        <div className="hidden md:flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900">Promotions &amp; Deals</h1>
          </div>
          <button
            onClick={() => navigate('promo-preferences')}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Preferences
          </button>
        </div>
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-3xl p-5 text-white shadow-md space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-100">
            <Sparkles className="w-4 h-4 text-amber-200" />
            Exclusive Wholesale Pricing
          </div>
          <h2 className="text-base sm:text-lg font-bold">Factory Direct &amp; Volume Campaigns</h2>
          <p className="text-xs text-amber-100">
            Verified manufacturers offering limited-time tiered rate discounts for bulk buyers.
          </p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="px-4 pt-4 max-w-3xl mx-auto w-full flex items-center gap-2 overflow-x-auto no-scrollbar md:max-w-5xl md:px-6">
        {[
          { key: 'all', label: 'All Deals' },
          { key: 'flash', label: 'Flash Sales' },
          { key: 'coupon', label: 'Vouchers' },
          { key: 'clearance', label: 'Clearance' },
          { key: 'seasonal', label: 'Seasonal' },
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              activeCategory === cat.key
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Promotions List */}
      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full space-y-3 pb-24 md:max-w-5xl md:px-6 md:py-6 md:pb-10 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-2">
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Megaphone className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No active promotions right now</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              New volume discount deals, supplier promotions, and flash sales will be announced here.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('category-browser')}
                className="text-xs font-bold gap-1"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Browse Catalog
              </Button>
            </div>
          </div>
        ) : (
          filteredPromos.map((promo, idx) => {
            const theme = getPromoTheme(promo.title, promo.message)
            return (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => navigate('promo-detail', { id: promo.id })}
                className={`bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 cursor-pointer hover:shadow hover:border-amber-200 transition ${theme.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${theme.iconBg}`}>
                      <theme.icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900">{promo.title}</h3>
                  </div>

                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {new Date(promo.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                  {promo.message}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                  <span className="text-amber-600 font-bold text-[11px] flex items-center gap-0.5">
                    Limited Time Offer
                  </span>

                  <button className="flex items-center gap-1 font-bold text-red-600 hover:text-red-700 text-xs">
                    Shop Now <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default PromoNotificationsPage
