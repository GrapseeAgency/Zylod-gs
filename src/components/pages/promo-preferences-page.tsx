'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Tag, Sparkles, Check, Mail, Smartphone,
  Sliders, Flame, Gift, Percent
} from 'lucide-react'

export function PromoPreferencesPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [pushPromos, setPushPromos] = useState(false)
  const [emailPromos, setEmailPromos] = useState(false)
  const [flashSales, setFlashSales] = useState(true)
  const [clearance, setClearance] = useState(true)
  const [vouchers, setVouchers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/notifications/preferences', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPushPromos(data.data.pushPromotions ?? false)
          setEmailPromos(data.data.emailPromotions ?? false)
        }
      })
      .catch(console.error)
  }, [token])

  const handleToggle = async (key: 'pushPromotions' | 'emailPromotions', val: boolean) => {
    if (key === 'pushPromotions') setPushPromos(val)
    if (key === 'emailPromotions') setEmailPromos(val)

    try {
      setSaving(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [key]: val }),
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
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Promotion Preferences</span>
        </div>

        {saved && (
          <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-3xl md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Promotion Preferences</h1>
          {saved && (
            <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
        {/* Main Channels */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2.5">
            Delivery Channels
          </h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-900">Push Notifications</p>
                <p className="text-[11px] text-gray-400">Receive deal popups on mobile and desktop</p>
              </div>
            </div>
            <Switch
              checked={pushPromos}
              onCheckedChange={(val) => handleToggle('pushPromotions', val)}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-900">Email Newsletters &amp; Circulars</p>
                <p className="text-[11px] text-gray-400">Weekly B2B factory discount bulletins</p>
              </div>
            </div>
            <Switch
              checked={emailPromos}
              onCheckedChange={(val) => handleToggle('emailPromotions', val)}
            />
          </div>
        </div>

        {/* Campaign Categories */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2.5">
            Interested Deal Types
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-gray-800">Flash Sales &amp; Midnight Deals</span>
              </div>
              <Switch checked={flashSales} onCheckedChange={setFlashSales} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-gray-800">Factory Clearance &amp; Excess Inventory</span>
              </div>
              <Switch checked={clearance} onCheckedChange={setClearance} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-gray-800">Exclusive Promo Vouchers</span>
              </div>
              <Switch checked={vouchers} onCheckedChange={setVouchers} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromoPreferencesPage
