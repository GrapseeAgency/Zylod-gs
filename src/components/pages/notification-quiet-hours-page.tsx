'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, Moon, Clock, BellOff, ShieldAlert,
  CheckCircle2, Sparkles, Check
} from 'lucide-react'

export function NotificationQuietHoursPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [enabled, setEnabled] = useState(false)
  const [start, setStart] = useState('22:00')
  const [end, setEnd] = useState('07:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Honesty fix: quiet hours are saved on YOUR notification preferences —
  // guests get a gate instead of silently discarding their toggles.
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
      .then(async res => {
        if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
        const data = await res.json()
        if (data.success && data.data) {
          setEnabled(data.data.quietHoursEnabled ?? false)
          if (data.data.quietHoursStart) setStart(data.data.quietHoursStart)
          if (data.data.quietHoursEnd) setEnd(data.data.quietHoursEnd)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isAuthenticated, token])

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session is no longer valid. Sign in again to manage quiet hours." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to set quiet hours"
        message="Quiet hours are saved to your account's notification preferences. Sign in to configure yours."
      />
    )
  }

  const handleSave = async (newEnabled = enabled, newStart = start, newEnd = end) => {
    try {
      setSaving(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          quietHoursEnabled: newEnabled,
          quietHoursStart: newStart,
          quietHoursEnd: newEnd,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-base">Quiet Hours Schedule</span>
        </div>

        {saved && (
          <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-3xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 text-gray-900 dark:text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary/60 uppercase tracking-wide">
            <Moon className="w-4 h-4" />
            Distraction-Free Rest Window
          </div>
          <h1 className="text-lg md:text-2xl font-bold">Automatic Do Not Disturb</h1>
          <p className="text-xs text-primary/50 leading-relaxed">
            Mute audible wholesale alerts and vibration during nighttime hours while still queuing critical updates.
          </p>
        </div>

        {/* Master Toggle */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Enable Quiet Hours</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Automatically silence alerts during specified time window</p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(val) => {
                setEnabled(val)
                handleSave(val, start, end)
              }}
            />
          </div>

          {enabled && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 dark:text-gray-500 block mb-1.5">Silence From (PM):</label>
                  <Input
                    type="time"
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value)
                      handleSave(enabled, e.target.value, end)
                    }}
                    className="text-sm font-bold text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 dark:text-gray-500 block mb-1.5">Resume At (AM):</label>
                  <Input
                    type="time"
                    value={end}
                    onChange={(e) => {
                      setEnd(e.target.value)
                      handleSave(enabled, start, e.target.value)
                    }}
                    className="text-sm font-bold text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 text-xs text-primary space-y-1">
                <p className="font-bold">What happens during Quiet Hours?</p>
                <p className="text-[11px] text-primary leading-relaxed">
                  Promotions, price drops, and general order notifications will not make sound or vibrate. High-priority security alerts will still come through.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationQuietHoursPage
