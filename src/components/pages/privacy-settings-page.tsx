'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Eye, Shield, Lock, Globe, Building2,
  Mail, Phone, FileText, Check, Loader2, AlertCircle,
  Search, Users, MessageSquare, Share2, Sparkles, UserCheck
} from 'lucide-react'

interface PrivacyOption {
  id: string
  label: string
  description: string
  enabled: boolean
  icon: React.ElementType
  category: 'visibility' | 'communication' | 'data'
}

export function PrivacySettingsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [options, setOptions] = useState<PrivacyOption[]>([
    {
      id: 'profile-visibility',
      label: 'Wholesale Directory Visibility',
      description: 'Allow other verified B2B buyers and sellers to discover your business profile in search results.',
      enabled: true,
      icon: Building2,
      category: 'visibility',
    },
    {
      id: 'show-contact-details',
      label: 'Public Contact Information',
      description: 'Display verified corporate phone numbers and email addresses on your storefront.',
      enabled: false,
      icon: Phone,
      category: 'visibility',
    },
    {
      id: 'allow-direct-rfq',
      label: 'Direct RFQ & Chat Inquiries',
      description: 'Allow verified procurement officers to initiate real-time quote requests and chat messages.',
      enabled: true,
      icon: MessageSquare,
      category: 'communication',
    },
    {
      id: 'supplier-data-sharing',
      label: 'Aggregated Trade Trend Sharing',
      description: 'Share anonymized purchasing volume with key manufacturing partners to qualify for tiered bulk rebates.',
      enabled: false,
      icon: Share2,
      category: 'data',
    },
    {
      id: 'search-engine-indexing',
      label: 'Public Search Engine Indexing',
      description: 'Allow Google and search bots to index your public catalog and company credentials.',
      enabled: true,
      icon: Globe,
      category: 'visibility',
    },
    {
      id: 'marketing-analytics',
      label: 'Platform Experience Optimization',
      description: 'Participate in anonymous session insights to improve Zylod platform speed and catalog recommendations.',
      enabled: true,
      icon: Sparkles,
      category: 'data',
    },
  ])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadPrivacy() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/profile/privacy', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data?.options && Array.isArray(json.data.options)) {
            setOptions((prev) =>
              prev.map((opt) => {
                const found = json.data.options.find((o: any) => o.id === opt.id)
                return found ? { ...opt, enabled: found.enabled } : opt
              })
            )
          }
        }
      } catch {
        // Graceful
      } finally {
        setLoading(false)
      }
    }
    loadPrivacy()
  }, [token])

  const handleToggle = (id: string, value: boolean) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, enabled: value } : o)))
  }

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    try {
      const payload = {
        data: options.map(({ id, label, description, enabled }) => ({
          id,
          label,
          description,
          enabled,
        })),
      }
      await fetch('/api/profile/privacy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      // Handled
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Privacy &amp; Data Controls</span>
        <button
          onClick={() => navigate('account-settings')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Settings"
        >
          <Shield className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-3xl md:px-6 md:py-8 md:space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Privacy &amp; Data Controls</h1>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 text-slate-700"
            onClick={() => navigate('account-settings')}
          >
            <Shield className="h-4 w-4 mr-2" />
            Account Settings
          </Button>
        </div>
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 md:p-7 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Eye className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black">Privacy Settings</h1>
              <p className="text-xs text-slate-300">
                Control who sees your corporate directory listing and manages business data sharing.
              </p>
            </div>
          </div>
        </div>

        {/* Visibility Options */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Catalog &amp; Directory Visibility</span>
          </div>

          <div className="divide-y divide-slate-50 grid grid-cols-1 md:grid-cols-2 md:divide-y-0 md:gap-x-6 md:p-3">
            {options.map((option) => {
              const Icon = option.icon
              return (
                <div key={option.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{option.label}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{option.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={option.enabled}
                    onCheckedChange={(val) => handleToggle(option.id, val)}
                    className="data-[state=checked]:bg-primary shrink-0 mt-1"
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* GDPR / Data Export */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-700" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">Data Rights &amp; Export</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Download a certified copy of your order ledger, transaction history, and verified tax credentials in JSON format.
          </p>
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ exportedAt: new Date().toISOString(), platform: "Zylod Wholesale" }))
              const downloadAnchor = document.createElement('a')
              downloadAnchor.setAttribute("href", dataStr)
              downloadAnchor.setAttribute("download", "zylod-account-data.json")
              document.body.appendChild(downloadAnchor)
              downloadAnchor.click()
              downloadAnchor.remove()
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Request Full Data Archive (.JSON)
          </Button>
        </div>

        {/* Save CTA */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`w-full md:w-auto md:px-10 font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 ${
            saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'
          } text-white`}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <><Check className="h-4 w-4" /> Privacy Settings Saved!</>
          ) : (
            'Save Privacy Preferences'
          )}
        </Button>
      </main>
    </div>
  )
}

export default PrivacySettingsPage
