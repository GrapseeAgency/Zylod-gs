'use client'

import React, { useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Cookie, Shield, BarChart3, Megaphone, CheckCircle2 } from 'lucide-react'

export function CookiePreferencesPage() {
  const { navigate, goBack } = useNavigationStore()
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const sessionId = `pref-${Date.now()}`
      await fetch('/api/legal/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, analyticsAllowed: analytics, marketingAllowed: marketing }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Cookie Preferences Center</h1>
          <p className="text-xs text-gray-400">Manage Consent for Tracking Technologies</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-3xl">
        <div className="bg-amber-500 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5" />
            <h2 className="font-bold text-sm">Granular Tracking Controls</h2>
          </div>
          <p className="text-xs text-amber-100 leading-relaxed">
            Adjust your privacy settings. Strictly necessary cookies are mandatory to maintain authentication sessions and cart persistence.
          </p>
        </div>

        <div className="space-y-3">
          {/* Necessary */}
          <div className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-gray-900">Strictly Necessary Cookies</h3>
                  <Badge className="bg-gray-100 text-gray-600 border-none text-[10px]">Always Active</Badge>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  Required for CSRF tokens, sign-in sessions, cart storage, and server load balancing.
                </p>
              </div>
            </div>
            <Switch checked={true} disabled className="flex-shrink-0" />
          </div>

          {/* Analytics */}
          <div className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-gray-900">Performance & Analytics</h3>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  Helps us measure page load times, buyer search query performance, and user interface responsiveness.
                </p>
              </div>
            </div>
            <Switch checked={analytics} onCheckedChange={setAnalytics} className="flex-shrink-0" />
          </div>

          {/* Marketing */}
          <div className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Megaphone className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-gray-900">Personalized Bulk Promotions</h3>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  Allows us to deliver personalized wholesale volume rebates and notifications based on your sourcing categories.
                </p>
              </div>
            </div>
            <Switch checked={marketing} onCheckedChange={setMarketing} className="flex-shrink-0" />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className={`w-full rounded-xl text-xs font-bold py-3 text-white ${
            saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {saved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Preferences Saved</> : saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  )
}

export default CookiePreferencesPage
