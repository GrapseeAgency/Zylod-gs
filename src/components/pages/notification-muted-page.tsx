'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, VolumeX, Bell, Check, Clock,
  Shield, Package, Tag, Layers
} from 'lucide-react'

export function NotificationMutedPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [pausedUntil, setPausedUntil] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedPause = localStorage.getItem('zylod_notif_pause_until')
    if (savedPause && new Date(savedPause).getTime() > Date.now()) {
      setPausedUntil(savedPause)
    }

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

  const pauseFor = (hours: number) => {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    setPausedUntil(until)
    localStorage.setItem('zylod_notif_pause_until', until)
  }

  const resumeNow = () => {
    setPausedUntil(null)
    localStorage.removeItem('zylod_notif_pause_until')
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-bold text-gray-900 text-base">Muted &amp; Paused Alerts</span>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-4xl w-full space-y-6 pb-24 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Pause Master Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <VolumeX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Temporary Snooze</h2>
              <p className="text-xs text-gray-400">Pause all non-critical wholesale notifications</p>
            </div>
          </div>

          {pausedUntil ? (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-2">
              <p className="text-xs font-bold text-amber-900">
                All alerts paused until: {new Date(pausedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <Button
                onClick={resumeNow}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                Resume Alerts Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { hours: 1, label: '1 Hour' },
                { hours: 4, label: '4 Hours' },
                { hours: 8, label: '8 Hours' },
              ].map(opt => (
                <button
                  key={opt.hours}
                  onClick={() => pauseFor(opt.hours)}
                  className="p-2.5 bg-slate-50 hover:bg-red-50 hover:text-red-700 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 transition"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Currently Disabled Categories */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Disabled Categories
          </h2>

          <div className="space-y-2">
            {!prefs.pushPromotions && (
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700">Promotions &amp; Flash Sales</span>
                <span className="text-gray-400">Muted</span>
              </div>
            )}
            {!prefs.pushPriceDrops && (
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700">Price Drops</span>
                <span className="text-gray-400">Muted</span>
              </div>
            )}
            {!prefs.pushBackInStock && (
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700">Back in Stock</span>
                <span className="text-gray-400">Muted</span>
              </div>
            )}
            {prefs.pushPromotions && prefs.pushPriceDrops && prefs.pushBackInStock && (
              <p className="text-xs text-gray-400 text-center py-4">No categories currently muted.</p>
            )}
          </div>

          <div className="pt-2 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('push-notification-settings')}
              className="text-xs font-bold"
            >
              Modify Settings
            </Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationMutedPage
