'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Smartphone, Mail, Bell, Check,
  Package, Truck, Tag, TrendingDown, Layers, MessageSquare
} from 'lucide-react'

export function PushNotificationPerChannelPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [prefs, setPrefs] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/notifications/preferences', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPrefs(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const handleUpdate = async (key: string, val: boolean) => {
    setPrefs((prev: any) => ({ ...prev, [key]: val }))
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [key]: val }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Channel Matrix</span>
        </div>

        {saved && (
          <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-3xl md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Channel Matrix</h1>
          {saved && (
            <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
        {/* Push Section */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900">Mobile &amp; Web Push</h2>
          </div>

          <div className="space-y-3 divide-y divide-gray-50">
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Orders &amp; Invoices</span>
              <Switch checked={Boolean(prefs.pushOrderUpdates)} onCheckedChange={(v) => handleUpdate('pushOrderUpdates', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Courier Delivery Updates</span>
              <Switch checked={Boolean(prefs.pushDelivery)} onCheckedChange={(v) => handleUpdate('pushDelivery', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Price Drop Triggers</span>
              <Switch checked={Boolean(prefs.pushPriceDrops)} onCheckedChange={(v) => handleUpdate('pushPriceDrops', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Back in Stock Alerts</span>
              <Switch checked={Boolean(prefs.pushBackInStock)} onCheckedChange={(v) => handleUpdate('pushBackInStock', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Promotions &amp; Flash Sales</span>
              <Switch checked={Boolean(prefs.pushPromotions)} onCheckedChange={(v) => handleUpdate('pushPromotions', v)} />
            </div>
          </div>
        </div>

        {/* Email Section */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <Mail className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900">Email Notifications</h2>
          </div>

          <div className="space-y-3 divide-y divide-gray-50">
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Order Receipts &amp; Mushak-6.3</span>
              <Switch checked={Boolean(prefs.emailOrderUpdates)} onCheckedChange={(v) => handleUpdate('emailOrderUpdates', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Delivery Confirmation Summaries</span>
              <Switch checked={Boolean(prefs.emailDelivery)} onCheckedChange={(v) => handleUpdate('emailDelivery', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Weekly Price Drop Digest</span>
              <Switch checked={Boolean(prefs.emailPriceDrops)} onCheckedChange={(v) => handleUpdate('emailPriceDrops', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700">Factory Promotion Circulars</span>
              <Switch checked={Boolean(prefs.emailPromotions)} onCheckedChange={(v) => handleUpdate('emailPromotions', v)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PushNotificationPerChannelPage
