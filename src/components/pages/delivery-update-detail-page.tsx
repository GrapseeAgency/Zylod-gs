'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Truck, MapPin, CheckCircle2,
  Copy, Check, ExternalLink
} from 'lucide-react'

export function DeliveryUpdateDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()

  const id = pageParams?.id || ''
  const [notif, setNotif] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch(`/api/notifications/${id}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setNotif(data.data)
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
        <span className="font-bold text-gray-900 text-base">Consignment Notice</span>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto w-full space-y-6 pb-24 md:pb-8 lg:max-w-3xl">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        ) : !notif ? (
          <div className="text-center py-16 text-gray-500">Notice not found.</div>
        ) : (
          <>
            {/* Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-6 shadow-md space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                <Truck className="w-4 h-4" />
                Courier Transit Update
              </div>
              <h1 className="text-base sm:text-lg md:text-2xl font-bold">{notif.title}</h1>
              <p className="text-xs text-emerald-100">{new Date(notif.timestamp).toLocaleString()}</p>
            </div>

            {/* Message Body */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dispatch Progress</h2>
              <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">{notif.message}</p>
            </div>

            <Button
              onClick={() => navigate('orders')}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md text-xs sm:text-sm"
            >
              Track on Courier GPS →
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default DeliveryUpdateDetailPage
