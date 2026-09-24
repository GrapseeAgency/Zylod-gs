'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Tag, Copy, Check, Clock,
  ShieldCheck, AlertCircle, ShoppingBag
} from 'lucide-react'

export function CouponDetailPage() {
  const { currentPage, navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const couponId = pageParams?.id

  const [coupon, setCoupon] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!couponId) {
      setLoading(false)
      return
    }
    fetch(`/api/coupons/${couponId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setCoupon(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [couponId])

  const copyCode = () => {
    if (!coupon?.code) return
    navigator.clipboard.writeText(coupon.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">Coupon Terms &amp; Conditions</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto w-full space-y-6 md:space-y-8 pb-24 md:pb-8 lg:max-w-3xl">
        {loading ? (
          <div className="p-6 text-center text-gray-400">Loading coupon details...</div>
        ) : !coupon ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
            <p className="text-sm font-bold text-gray-800">Coupon Details</p>
            <p className="text-xs text-gray-500">
              This voucher can be applied during checkout to get wholesale savings on qualified bulk orders.
            </p>
            <Button onClick={() => navigate('coupons')} className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold">
              Browse All Coupons
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
            <div className="space-y-2 text-center pb-4 border-b border-gray-100">
              <Badge className="bg-red-50 text-red-700 border-red-200 uppercase font-bold text-xs">
                {coupon.discountType === 'percentage' ? `${coupon.discountPercent}% OFF` : `৳${coupon.discountPercent} FLAT OFF`}
              </Badge>
              <h2 className="text-lg md:text-2xl font-black text-gray-900">{coupon.code}</h2>
              <p className="text-xs text-gray-500">
                Expires on {new Date(coupon.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Applicable Rules</h3>
              <ul className="text-xs text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Minimum bulk order: <strong>{formatPrice(coupon.minOrderAmount || 0)}</strong>
                </li>
                {coupon.maxDiscount && (
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Maximum allowable savings: <strong>{formatPrice(coupon.maxDiscount)}</strong>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Applies once per transaction at checkout.
                </li>
              </ul>
            </div>

            <div className="pt-2 flex gap-2">
              <Button onClick={copyCode} variant="outline" className="w-1/2 rounded-xl text-xs font-bold">
                {copied ? <Check className="w-4 h-4 mr-1 text-green-600" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Code Copied' : 'Copy Code'}
              </Button>
              <Button onClick={() => navigate('category-browser')} className="w-1/2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold">
                Shop Wholesale →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CouponDetailPage
