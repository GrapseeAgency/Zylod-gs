'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Package, Clock, CheckCircle2, Truck,
  AlertCircle, ChevronRight, FileText
} from 'lucide-react'

export function OrderUpdateDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const id = pageParams?.id || ''
  const [notif, setNotif] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
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
            const ordRes = await fetch(`/api/orders/${data.data.relatedId}`, { headers }).then(r => r.json()).catch(() => null)
            if (ordRes?.success && ordRes?.data) setOrder(ordRes.data)
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, token])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Order Progress Notice</span>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto md:max-w-2xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        ) : !notif ? (
          <div className="text-center py-16 text-gray-500">Notice not found.</div>
        ) : (
          <>
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-3xl p-6 shadow-md space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-200">
                <Package className="w-4 h-4" />
                Wholesale Order Milestone
              </div>
              <h1 className="text-base sm:text-lg font-bold">{notif.title}</h1>
              <p className="text-xs text-blue-100">{new Date(notif.timestamp).toLocaleString()}</p>
            </div>

            {/* Content */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Update Details</h2>
              <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">{notif.message}</p>

              {order && (
                <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">PO Number:</span>
                    <strong className="text-gray-900">{order.orderNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order Total:</span>
                    <strong className="text-gray-900">{formatPrice(order.totalAmount)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            {notif.relatedId && (
              <Button
                onClick={() => navigate('order-detail', { orderId: notif.relatedId })}
                className="w-full md:w-auto md:px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md text-xs sm:text-sm"
              >
                Open Order Console →
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default OrderUpdateDetailPage
