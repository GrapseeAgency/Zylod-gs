'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Globe, Check, Loader2, DollarSign,
  Clock, Hash, Calendar, Layers, Sparkles
} from 'lucide-react'

interface Language {
  id: string
  name: string
  nativeName: string
  region: string
}

export function LanguageSettingsPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { currentCurrency, setCurrency } = useCurrencyStore()

  const languages: Language[] = [
    { id: 'en', name: 'English (US)', nativeName: 'English', region: 'Global B2B Standard' },
    { id: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'বাংলাদেশ (National)' },
    { id: 'es', name: 'Spanish', nativeName: 'Español', region: 'América Latina / España' },
    { id: 'fr', name: 'French', nativeName: 'Français', region: 'Europe / Afrique' },
    { id: 'ar', name: 'Arabic', nativeName: 'العربية', region: 'Middle East & GCC' },
  ]

  const currencies = [
    { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka (BDT)' },
    { code: 'USD', symbol: '$', label: 'United States Dollar (USD)' },
    { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
    { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
    { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham (AED)' },
  ]

  const [selectedLang, setSelectedLang] = useState('en')
  const [numberFormat, setNumberFormat] = useState<'lakh' | 'million'>('lakh')
  const [timeZone, setTimeZone] = useState('Asia/Dhaka')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadLang() {
      if (!token) return
      try {
        const res = await fetch('/api/profile/language', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data?.selectedId) {
            setSelectedLang(json.data.selectedId)
          }
        }
      } catch {
        // Graceful
      }
    }
    loadLang()
  }, [token])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (token) {
        await fetch('/api/profile/language', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            selectedId: selectedLang,
            numberFormat,
            timeZone,
          }),
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      // Graceful
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Language &amp; Locale</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto lg:max-w-3xl px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 md:p-6 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black">Language &amp; Currency</h1>
              <p className="text-xs md:text-sm text-slate-300">
                Choose your preferred interface language, currency standard, and number formatting.
              </p>
            </div>
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Interface Language
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {languages.map((lang) => {
              const isSelected = selectedLang === lang.id
              return (
                <button
                  key={lang.id}
                  onClick={() => setSelectedLang(lang.id)}
                  className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className={`text-xs font-black block ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
                      {lang.nativeName} ({lang.name})
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{lang.region}</span>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Preferred Currency */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-primary" />
            Wholesale Catalog Currency
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {currencies.map((c) => {
              const isSelected = currentCurrency === c.code
              return (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code as any)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="text-sm font-black font-mono text-primary block">{c.symbol}</span>
                  <span className={`text-xs font-bold block mt-0.5 ${isSelected ? 'text-primary' : 'text-slate-900'}`}>{c.code}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Number Format & Timezone */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Regional Number &amp; Time Formats
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Number Grouping Standard</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNumberFormat('lakh')}
                  className={`p-3 rounded-xl border text-left text-xs font-bold ${
                    numberFormat === 'lakh' ? 'border-primary bg-rose-50 text-primary' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span>Lakh / Crore</span>
                  <span className="text-[10px] text-slate-400 block font-mono">1,00,000 (BD Standard)</span>
                </button>
                <button
                  onClick={() => setNumberFormat('million')}
                  className={`p-3 rounded-xl border text-left text-xs font-bold ${
                    numberFormat === 'million' ? 'border-primary bg-rose-50 text-primary' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span>Thousands / Millions</span>
                  <span className="text-[10px] text-slate-400 block font-mono">100,000 (Western Standard)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Operating Time Zone</label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 px-3.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
              >
                <option value="Asia/Dhaka">Bangladesh Standard Time (BST — UTC+6)</option>
                <option value="UTC">Coordinated Universal Time (UTC+0)</option>
                <option value="Asia/Dubai">Gulf Standard Time (GST — UTC+4)</option>
                <option value="Europe/London">Greenwich Mean Time (GMT — UTC+1)</option>
                <option value="America/New_York">Eastern Standard Time (EST — UTC-5)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save CTA */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`w-full font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 ${
            saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'
          } text-white`}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <><Check className="h-4 w-4" /> Preferences Saved!</>
          ) : (
            'Save Language & Regional Settings'
          )}
        </Button>
      </main>
    </div>
  )
}

export default LanguageSettingsPage
