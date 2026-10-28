'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Smartphone, Mail, Bell, Check,
  Package, Truck, Tag, TrendingDown, Layers, MessageSquare
} from 'lucide-react'

export function PushNotificationPerChannelPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [prefs, setPrefs] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/notifications/preferences', { headers })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return null
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json()
      })
      .then(data => {
        if (data && data.success && data.data) {
          setPrefs(data.data)
        } else if (data && !data.success) {
          setError('Could not load your notification preferences.')
        }
      })
      .catch(() => setError('Could not load your notification preferences.'))
      .finally(() => setLoading(false))
  }, [isAuthenticated, token])

  const handleUpdate = async (key: string, val: boolean) => {
    const prev = prefs[key]
    setPrefs((p: any) => ({ ...p, [key]: val }))
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [key]: val }),
      })
      if (!res.ok) {
        setPrefs((p: any) => ({ ...p, [key]: prev }))
        setError('Could not save the change. Please try again.')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setPrefs((p: any) => ({ ...p, [key]: prev }))
      setError('Could not save the change. Please check your connection and try again.')
      console.error(e)
    }
  }

  if (sessionExpired) {
    return (
      <AccountGate
        title="Session expired"
        message="Your session is no longer valid. Sign in again to manage your notification preferences."
      />
    )
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to manage notifications"
        message="The Channel Matrix shows and changes your real account notification preferences. Sign in to continue."
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-base">Channel Matrix</span>
        </div>

        {saved && (
          <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-3xl md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Channel Matrix</h1>
          {saved && (
            <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
        {error && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900 p-3">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {/* Push Section */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <Smartphone className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Mobile &amp; Web Push</h2>
          </div>

          <div className="space-y-3 divide-y divide-gray-50">
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Orders &amp; Invoices</span>
              <Switch checked={Boolean(prefs.pushOrderUpdates)} onCheckedChange={(v) => handleUpdate('pushOrderUpdates', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Courier Delivery Updates</span>
              <Switch checked={Boolean(prefs.pushDelivery)} onCheckedChange={(v) => handleUpdate('pushDelivery', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Price Drop Triggers</span>
              <Switch checked={Boolean(prefs.pushPriceDrops)} onCheckedChange={(v) => handleUpdate('pushPriceDrops', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Back in Stock Alerts</span>
              <Switch checked={Boolean(prefs.pushBackInStock)} onCheckedChange={(v) => handleUpdate('pushBackInStock', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Promotions &amp; Flash Sales</span>
              <Switch checked={Boolean(prefs.pushPromotions)} onCheckedChange={(v) => handleUpdate('pushPromotions', v)} />
            </div>
          </div>
        </div>

        {/* Email Section */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
            <Mail className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Email Notifications</h2>
          </div>

          <div className="space-y-3 divide-y divide-gray-50">
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Order Receipts &amp; Mushak-6.3</span>
              <Switch checked={Boolean(prefs.emailOrderUpdates)} onCheckedChange={(v) => handleUpdate('emailOrderUpdates', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Delivery Confirmation Summaries</span>
              <Switch checked={Boolean(prefs.emailDelivery)} onCheckedChange={(v) => handleUpdate('emailDelivery', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Weekly Price Drop Digest</span>
              <Switch checked={Boolean(prefs.emailPriceDrops)} onCheckedChange={(v) => handleUpdate('emailPriceDrops', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Factory Promotion Circulars</span>
              <Switch checked={Boolean(prefs.emailPromotions)} onCheckedChange={(v) => handleUpdate('emailPromotions', v)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PushNotificationPerChannelPage
