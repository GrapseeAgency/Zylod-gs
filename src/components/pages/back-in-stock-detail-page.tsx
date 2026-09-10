'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Layers, Package, ShoppingCart,
  CheckCircle2, AlertCircle
} from 'lucide-react'

export function BackInStockDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const id = pageParams?.id || ''
  const [notif, setNotif] = useState<any>(null)
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch(`/api/notifications/${id}`, { headers })
      .then(res => res.json())
      .then(async data => {
        if (data.success && data.data) {
          setNotif(data.data)
          if (data.data.relatedId) {
            const pRes = await fetch(`/api/products/${data.data.relatedId}`).then(r => r.json()).catch(() => null)
            if (pRes?.success && pRes?.data) setProduct(pRes.data)
          }
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
        <span className="font-bold text-gray-900 text-base">Restock Notification</span>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-4xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-36 w-full rounded-3xl" />
          </div>
        ) : !notif ? (
          <div className="text-center py-16 text-gray-500">Notice not found.</div>
        ) : (
          <>
            <button onClick={goBack} className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white rounded-3xl p-6 md:p-8 shadow-md space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-200">
                <Layers className="w-4 h-4" />
                Inventory Available
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{notif.title}</h1>
              <p className="text-xs text-teal-100">{new Date(notif.timestamp).toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Restock Notice</h2>
              <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">{notif.message}</p>

              {product && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {product.thumbnailUrl ? (
                      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      Rate: <strong>{formatPrice(product.basePrice)}</strong> • Available: <strong>{product.stockQuantity} units</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {product && (
              <Button
                onClick={() => navigate('product-detail', { productId: product.id })}
                className="w-full md:w-auto md:px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-md text-xs sm:text-sm gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Order Available Stock →
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default BackInStockDetailPage
