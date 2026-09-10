'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  getNativeDeviceId,
  hasNativeNotifications,
  requestNativeNotificationPermission,
  showNativeNotification,
} from '@/lib/native-bridge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Bell, Smartphone, Mail, Volume2, Moon,
  Package, Truck, Tag, TrendingDown, Layers, MessageSquare,
  Shield, Check, Sliders, VolumeX, Sparkles, Clock
} from 'lucide-react'

interface Preferences {
  pushOrderUpdates: boolean
  pushPromotions: boolean
  pushPriceDrops: boolean
  pushBackInStock: boolean
  pushDelivery: boolean
  pushChat: boolean
  pushSystem: boolean
  emailOrderUpdates: boolean
  emailPromotions: boolean
  emailPriceDrops: boolean
  emailBackInStock: boolean
  emailDelivery: boolean
  notificationSound: string
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  digestEnabled: boolean
  mentionNotify: boolean
}

export function PushNotificationSettingsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const fetchPrefs = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/notifications/preferences', { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setPrefs(data.data)
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs])

  const updatePreference = async (key: keyof Preferences, value: any) => {
    if (!prefs) return
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)

    try {
      setSaving(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [key]: value }),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      }
    } catch (err) {
      console.error('Failed to save preference:', err)
    } finally {
      setSaving(false)
    }
  }

  const categoryConfigs = [
    {
      id: 'order',
      title: 'Order Status & Tracking',
      desc: 'Confirmations, supplier packaging, and dispatch alerts',
      icon: Package,
      iconBg: 'bg-blue-50 text-blue-600',
      pushKey: 'pushOrderUpdates' as keyof Preferences,
      emailKey: 'emailOrderUpdates' as keyof Preferences,
    },
    {
      id: 'delivery',
      title: 'Real-time Courier Delivery',
      desc: 'Out for delivery notices and delivery confirmations',
      icon: Truck,
      iconBg: 'bg-emerald-50 text-emerald-600',
      pushKey: 'pushDelivery' as keyof Preferences,
      emailKey: 'emailDelivery' as keyof Preferences,
    },
    {
      id: 'price_drop',
      title: 'Price Drop Alerts',
      desc: 'When items in your wishlist or price watches drop',
      icon: TrendingDown,
      iconBg: 'bg-red-50 text-red-600',
      pushKey: 'pushPriceDrops' as keyof Preferences,
      emailKey: 'emailPriceDrops' as keyof Preferences,
    },
    {
      id: 'stock',
      title: 'Back in Stock Alerts',
      desc: 'Instant notifications when watched products restock',
      icon: Layers,
      iconBg: 'bg-teal-50 text-teal-600',
      pushKey: 'pushBackInStock' as keyof Preferences,
      emailKey: 'emailBackInStock' as keyof Preferences,
    },
    {
      id: 'promo',
      title: 'Promotions, Flash Sales & Coupons',
      desc: 'Exclusive wholesale volume discounts and factory deals',
      icon: Tag,
      iconBg: 'bg-amber-50 text-amber-600',
      pushKey: 'pushPromotions' as keyof Preferences,
      emailKey: 'emailPromotions' as keyof Preferences,
    },
    {
      id: 'chat',
      title: 'Supplier Chat & RFQs',
      desc: 'Direct supplier messages, quotes, and counter-offers',
      icon: MessageSquare,
      iconBg: 'bg-indigo-50 text-indigo-600',
      pushKey: 'pushChat' as keyof Preferences,
      emailKey: null,
    },
    {
      id: 'system',
      title: 'Platform & Security Alerts',
      desc: 'Account security, policy updates, and escrow clearances',
      icon: Shield,
      iconBg: 'bg-slate-50 text-slate-700',
      pushKey: 'pushSystem' as keyof Preferences,
      emailKey: null,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Push Notification Settings</span>
        </div>

        {saveSuccess && (
          <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Push Notification Settings</h1>
          {saveSuccess && (
            <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <Skeleton className="h-28 w-full rounded-3xl" />
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        ) : !prefs ? (
          <div className="text-center py-12 text-gray-500">Failed to load settings.</div>
        ) : (
          <>
            {/* Web Push Device Permission Banner */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-3xl p-5 text-white shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-white" />
                  <h2 className="text-sm font-bold">Browser &amp; Device Web Push</h2>
                </div>
                <span className="text-[10px] font-bold uppercase bg-white/20 px-2 py-0.5 rounded-full">
                  Real-time
                </span>
              </div>
              <p className="text-xs text-red-100 leading-relaxed">
                Receive instant popups for incoming wholesale orders, factory bid responses, and courier deliveries even when Zylod is in the background.
              </p>
              <div className="pt-1 flex gap-2">
                <Button
                  onClick={async () => {
                    if (hasNativeNotifications()) {
                      // The Android WebView has no Web Notifications API — route the
                      // permission request through the native bridge instead.
                      const granted = await requestNativeNotificationPermission()
                      if (granted) {
                        // Real per-install device identifier from the native side
                        const deviceToken = 'android-' + (getNativeDeviceId() ?? 'unknown-device')
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                        if (token) headers['Authorization'] = `Bearer ${token}`
                        await fetch('/api/notifications/push-token', {
                          method: 'POST',
                          headers,
                          body: JSON.stringify({ token: deviceToken, platform: 'android' }),
                        })
                        alert('Push alerts enabled! Live updates will now deliver to this device.')
                      } else {
                        alert('Permission denied. Please allow notifications for Zylod in system settings.')
                      }
                    } else if (typeof window !== 'undefined' && 'Notification' in window) {
                      const perm = await Notification.requestPermission()
                      if (perm === 'granted') {
                        // Generate mock device token or VAPID token
                        const fakeToken = 'web-token-' + Math.random().toString(36).slice(2, 12) + '-' + Date.now()
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                        if (token) headers['Authorization'] = `Bearer ${token}`
                        await fetch('/api/notifications/push-token', {
                          method: 'POST',
                          headers,
                          body: JSON.stringify({ token: fakeToken, platform: 'web' }),
                        })
                        alert('Browser Web Push enabled! Live alerts will now deliver to your device.')
                      } else {
                        alert('Permission denied. Please enable notifications in your browser address bar.')
                      }
                    }
                  }}
                  className="bg-white hover:bg-white/90 text-red-600 font-bold text-xs rounded-xl shadow-sm"
                >
                  Enable Browser Push Alerts 🔔
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const native = hasNativeNotifications()
                    fetch('/api/notifications/evaluate-alerts', { method: 'POST' })
                      .then(r => r.json())
                      .then(d => {
                        const message = `Alert Evaluation Completed! Checked: ${d.summary?.priceAlertsChecked} price watches, ${d.summary?.stockAlertsChecked} stock watches.`
                        if (native) showNativeNotification('Price Watch Scan', message, 'zylod_deals_channel')
                        else alert(message)
                      })
                      .catch(() => {
                        if (native) showNativeNotification('Price Watch Scan', 'Triggered alert scan.', 'zylod_deals_channel')
                        else alert('Triggered alert scan.')
                      })
                  }}
                  className="border-white/40 text-white hover:bg-white/10 font-bold text-xs rounded-xl"
                >
                  Scan Price Watches ⚡
                </Button>
              </div>
            </div>

            {/* Quick Links Sub-bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => navigate('notification-sound-settings')}
                className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-red-200 transition space-y-1"
              >
                <Volume2 className="w-4 h-4 text-red-600" />
                <p className="text-xs font-bold text-gray-900">Sounds &amp; Vibrate</p>
                <p className="text-[10px] text-gray-400 capitalize">{prefs.notificationSound}</p>
              </button>
              <button
                onClick={() => navigate('notification-quiet-hours')}
                className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-red-200 transition space-y-1"
              >
                <Moon className="w-4 h-4 text-indigo-600" />
                <p className="text-xs font-bold text-gray-900">Quiet Hours</p>
                <p className="text-[10px] text-gray-400">{prefs.quietHoursEnabled ? 'Active' : 'Disabled'}</p>
              </button>
              <button
                onClick={() => navigate('notification-archive')}
                className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-red-200 transition space-y-1"
              >
                <Clock className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-bold text-gray-900">Archive</p>
                <p className="text-[10px] text-gray-400">&gt;30 days old</p>
              </button>
              <button
                onClick={() => navigate('notification-muted')}
                className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-red-200 transition space-y-1"
              >
                <VolumeX className="w-4 h-4 text-slate-600" />
                <p className="text-xs font-bold text-gray-900">Muted Alerts</p>
                <p className="text-[10px] text-gray-400">Pause alerts</p>
              </button>
            </div>

            {/* Notification Channels Header */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Category Controls
                </h2>
                <div className="flex items-center gap-6 text-xs font-bold text-gray-500">
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" /> Push
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" /> Email
                  </span>
                </div>
              </div>

              <div className="space-y-4 divide-y divide-gray-50">
                {categoryConfigs.map((cat) => (
                  <div key={cat.id} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.iconBg}`}>
                        <cat.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{cat.title}</p>
                        <p className="text-[11px] text-gray-400 line-clamp-1">{cat.desc}</p>
                      </div>
                    </div>

                    {/* Toggle Switch Group */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {/* Push Toggle */}
                      {cat.pushKey && (
                        <Switch
                          checked={Boolean(prefs[cat.pushKey])}
                          onCheckedChange={(checked) => updatePreference(cat.pushKey!, checked)}
                        />
                      )}
                      {/* Email Toggle */}
                      {cat.emailKey ? (
                        <Switch
                          checked={Boolean(prefs[cat.emailKey])}
                          onCheckedChange={(checked) => updatePreference(cat.emailKey!, checked)}
                        />
                      ) : (
                        <span className="w-10 text-center text-[10px] text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Delivery Preferences */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2.5">
                Frequency &amp; Digest Options
              </h2>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-gray-900">Daily Morning Summary</p>
                  <p className="text-[11px] text-gray-400">Receive a consolidated 8:00 AM briefing of all wholesale movements</p>
                </div>
                <Switch
                  checked={prefs.digestEnabled}
                  onCheckedChange={(checked) => updatePreference('digestEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-gray-900">Direct Mention &amp; RFQ Pings</p>
                  <p className="text-[11px] text-gray-400">High-priority sound alerts when a factory responds to your RFQ</p>
                </div>
                <Switch
                  checked={prefs.mentionNotify}
                  onCheckedChange={(checked) => updatePreference('mentionNotify', checked)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PushNotificationSettingsPage
