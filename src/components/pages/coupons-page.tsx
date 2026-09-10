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
  ArrowLeft, Tag, Copy, Check, Sparkles, Gift,
  Percent, Clock, ExternalLink, ChevronRight, Bookmark
} from 'lucide-react'

interface Coupon {
  id: string
  code: string
  discountType: string
  discountPercent: number
  minOrderAmount: number | null
  maxDiscount: number | null
  validUntil: string
}

export function CouponsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedCodes, setClaimedCodes] = useState<Set<string>>(new Set())

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/coupons')
      const data = await res.json()
      if (data.success && data.data) {
        setCoupons(data.data)
      }
    } catch (err) {
      console.error('Failed to load coupons:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleClaim = async (coupon: Coupon) => {
    try {
      setClaimingId(coupon.id)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/coupons/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: coupon.code }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setClaimedCodes(prev => new Set(prev).add(coupon.code))
        alert('Coupon collected! It has been saved to your My Coupons vault.')
      } else {
        alert(data.error || 'Failed to claim coupon')
      }
    } catch (err) {
      console.error('Claim error:', err)
    } finally {
      setClaimingId(null)
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
            <Tag className="w-5 h-5 text-red-600" />
            <h1 className="font-bold text-gray-900 text-base">Wholesale Coupons</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('earn-coupons')}
            className="h-8 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
          >
            Earn Vouchers
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('my-coupons')}
            className="h-8 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl"
          >
            My Vault
          </Button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="px-4 pt-4 md:px-6 md:pt-6 max-w-3xl mx-auto w-full lg:max-w-5xl">
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-5 text-white shadow-md space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-100">
            <Sparkles className="w-4 h-4 text-amber-200" />
            Verified B2B Volume Vouchers
          </div>
          <h2 className="text-base sm:text-lg md:text-2xl font-bold">Collect Discounts for Your Purchase Orders</h2>
          <p className="text-xs text-red-100">
            Apply these codes at checkout to reduce unit prices or get free cargo transit across Bangladesh.
          </p>
        </div>
      </div>

      {/* Coupons List */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-3xl mx-auto w-full space-y-4 md:space-y-5 pb-24 md:pb-8 lg:max-w-5xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-gray-100 animate-pulse space-y-3">
                <Skeleton className="h-5 w-1/3 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-10 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16 text-gray-500 space-y-2">
            <Gift className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="font-bold text-sm text-gray-800">No public coupons active right now</p>
            <p className="text-xs">Check back soon or earn vouchers by completing tasks.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {coupons.map((coupon, idx) => {
            const isClaimed = claimedCodes.has(coupon.code)
            const discountLabel = coupon.discountType === 'percentage'
              ? `${coupon.discountPercent}% OFF`
              : `৳${coupon.discountPercent} FLAT OFF`

            return (
              <motion.div
                key={coupon.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition"
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-extrabold text-red-600">
                          {discountLabel}
                        </span>
                        <Badge className="bg-red-50 text-red-700 hover:bg-red-50 border-red-100 text-[10px]">
                          Wholesale
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">
                        {coupon.minOrderAmount
                          ? `Valid on bulk orders of ${formatPrice(coupon.minOrderAmount)} or more`
                          : 'Valid on all wholesale purchases'}
                      </p>
                    </div>

                    <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      Exp: {new Date(coupon.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  {/* Coupon Code Strip */}
                  <div className="bg-slate-50 rounded-2xl p-3 border border-dashed border-gray-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="font-mono font-bold text-xs sm:text-sm text-gray-900 tracking-wider truncate">
                        {coupon.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyCode(coupon.code)}
                        className="h-8 px-2.5 text-xs font-bold text-gray-700 hover:text-gray-900"
                      >
                        {copiedCode === coupon.code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-600 mr-1" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        disabled={isClaimed || claimingId === coupon.id}
                        onClick={() => handleClaim(coupon)}
                        className="h-8 px-3.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl"
                      >
                        {isClaimed ? 'Collected' : claimingId === coupon.id ? 'Collecting...' : 'Collect'}
                      </Button>
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

export default CouponsPage
