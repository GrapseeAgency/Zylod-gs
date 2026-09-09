'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Tag, Sparkles, ShoppingBag,
  Percent, Gift, Flame
} from 'lucide-react'

export function PromoDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()

  const id = pageParams?.id || ''
  const [promo, setPromo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch(`/api/notifications/${id}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPromo(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, token])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Campaign Details</span>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-2xl md:space-y-8 md:pb-10">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Campaign Details</h1>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <Skeleton className="h-36 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
          </div>
        ) : !promo ? (
          <div className="text-center py-16 text-gray-500">Promotion expired or not found.</div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white rounded-3xl p-6 shadow-md space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-100">
                <Sparkles className="w-4 h-4 text-amber-200" />
                Featured Wholesale Deal
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{promo.title}</h1>
              <p className="text-xs text-amber-100">{new Date(promo.timestamp).toLocaleDateString()}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Offer Summary</h2>
              <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">{promo.message}</p>
            </div>

            <Button
              onClick={() => {
                if (promo.relatedId) {
                  navigate('product-detail', { productId: promo.relatedId })
                } else {
                  navigate('category-browser')
                }
              }}
              className="w-full md:w-auto md:px-10 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md text-xs sm:text-sm gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Claim Wholesale Rate →
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default PromoDetailPage
