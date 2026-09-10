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
  ArrowLeft, Tag, Copy, Check, Clock,
  Gift, ShoppingBag, ChevronRight, AlertCircle
} from 'lucide-react'

interface UserCoupon {
  id: string
  code: string
  title: string
  discountStyle: string
  discountLabel: string
  status: string
  validUntil: string
  savingsBDT: number
  minOrderBDT: number
  categoryLabel: string | null
  categoryColor: string | null
}

export function MyCouponsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [activeTab, setActiveTab] = useState<'active' | 'used' | 'expired'>('active')
  const [coupons, setCoupons] = useState<UserCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const fetchMyCoupons = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/coupons/my?status=${activeTab}&limit=50`, { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setCoupons(data.data)
      }
    } catch (err) {
      console.error('Failed to load user coupons:', err)
    } finally {
      setLoading(false)
    }
  }, [token, activeTab])

  useEffect(() => {
    fetchMyCoupons()
  }, [fetchMyCoupons])

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
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
            <Gift className="w-5 h-5 text-red-600" />
            <h1 className="font-bold text-gray-900 text-base">My Coupon Vault</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('coupons')}
          className="h-8 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl"
        >
          Collect More →
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
        {[
          { key: 'active', label: 'Active Available' },
          { key: 'used', label: 'Used Vouchers' },
          { key: 'expired', label: 'Expired' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === tab.key
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto lg:max-w-6xl w-full space-y-4 md:space-y-6 pb-24 md:pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-gray-100 animate-pulse space-y-3">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-8 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16 text-gray-500 space-y-3">
            <Tag className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="font-bold text-sm text-gray-800">
              {activeTab === 'active' ? 'No active coupons in your vault' : 'No coupons in this category'}
            </p>
            <p className="text-xs max-w-xs mx-auto">
              Collect vouchers from the coupon hub or earn points to redeem exclusive factory rebates.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => navigate('coupons')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
              >
                Browse Available Coupons
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {coupons.map((coupon, idx) => (
            <motion.div
              key={coupon.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => navigate('coupon-detail', { id: coupon.id })}
              className={`bg-white rounded-3xl border shadow-sm p-5 space-y-3 cursor-pointer hover:shadow-md transition ${
                activeTab === 'active' ? 'border-red-100 hover:border-red-300' : 'border-gray-100 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-red-600">
                      {coupon.discountLabel}
                    </span>
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-gray-200 text-[10px]">
                      {coupon.categoryLabel || 'Wholesale'}
                    </Badge>
                  </div>
                  <p className="text-xs font-bold text-gray-900">{coupon.title}</p>
                  <p className="text-[11px] text-gray-500">
                    Min Purchase: <strong>{formatPrice(coupon.minOrderBDT)}</strong>
                  </p>
                </div>

                <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  Exp: {new Date(coupon.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {/* Action Bar */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-gray-100 flex items-center justify-between gap-3">
                <span className="font-mono font-bold text-xs sm:text-sm text-gray-800">
                  {coupon.code}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      copyCode(coupon.code)
                    }}
                    className="h-8 px-2.5 text-xs font-bold text-gray-700 hover:text-gray-900"
                  >
                    {copiedCode === coupon.code ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600 mr-1" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy Code
                      </>
                    )}
                  </Button>

                  {activeTab === 'active' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate('category-browser')
                      }}
                      className="h-8 px-3 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl"
                    >
                      Use Now →
                    </Button>
                  )}
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

export default MyCouponsPage
