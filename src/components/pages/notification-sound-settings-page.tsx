'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Volume2, VolumeX, Vibrate, Music,
  Check, Sparkles, Sliders
} from 'lucide-react'
import { soundEffects } from '@/lib/sound-effects'

export function NotificationSoundSettingsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [sound, setSound] = useState<string>('default')
  const [vibrate, setVibrate] = useState(true)
  const [inAppSound, setInAppSound] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/notifications/preferences', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setSound(data.data.notificationSound || 'default')
        }
      })
      .catch(console.error)
  }, [token])

  const handleSaveSound = async (val: string) => {
    setSound(val)
    try {
      setSaving(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ notificationSound: val }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const soundOptions = [
    { key: 'default', title: 'Default Chime', desc: 'Standard Zylod wholesale priority sound', icon: Volume2 },
    { key: 'chime', title: 'Soft Melody', desc: 'Gentle, modern acoustic chime', icon: Music },
    { key: 'vibrate', title: 'Vibration Only', desc: 'Haptic feedback without audible chime', icon: Vibrate },
    { key: 'silent', title: 'Silent Mode', desc: 'Deliver notifications visually with zero sound', icon: VolumeX },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Sound &amp; Vibration Settings</span>
        </div>

        {saved && (
          <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-3xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Sound Selection Card */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Notification Tone
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {soundOptions.map(opt => (
              <div
                key={opt.key}
                onClick={() => handleSaveSound(opt.key)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                  sound === opt.key
                    ? 'border-red-500 bg-red-50/30'
                    : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sound === opt.key ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                    <opt.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-gray-900">{opt.title}</p>
                    <p className="text-[11px] text-gray-400">{opt.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      soundEffects.playByName(opt.key)
                    }}
                    className="h-7 px-2 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Play Preview 🔊
                  </Button>
                  {sound === opt.key && (
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Haptic & In-app Options */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2.5">
            Feedback Preferences
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-900">Vibration Feedback</p>
              <p className="text-[11px] text-gray-400">Vibrate phone on high-priority orders and bids</p>
            </div>
            <Switch checked={vibrate} onCheckedChange={setVibrate} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-900">In-App Notification Chimes</p>
              <p className="text-[11px] text-gray-400">Play subtle audio while using the app</p>
            </div>
            <Switch checked={inAppSound} onCheckedChange={setInAppSound} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationSoundSettingsPage
