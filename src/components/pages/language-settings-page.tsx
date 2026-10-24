'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Globe, Check, Loader2, DollarSign, AlertCircle
} from 'lucide-react'
import type { CurrencyCode } from '@/store/currency-store'

type LanguageId = 'bn' | 'en'

/**
 * Real language settings, persisted on the userSettings row via
 * GET/PATCH /api/profile/language (cookies, credentials:'include').
 *
 * Only 'bn' (Bengali) and 'en' (English) have backend backing today — the
 * other previously-offered languages (es/fr/ar) were never persisted anywhere,
 * so they are shown honestly as not implemented instead of selectable fakes.
 * The old number-format / timezone controls never persisted either and are
 * removed. The currency picker is real device-local state (zustand persist)
 * and is kept, labelled truthfully.
 * No optimistic writes: the selection PATCHes first and applies on 2xx.
 */
export function LanguageSettingsPage() {
  const { goBack, navigate } = useNavigationStore()
  const { currentCurrency, setCurrency } = useCurrencyStore()

  const languages: { id: LanguageId; name: string; nativeName: string; region: string }[] = [
    { id: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'বাংলাদেশ (National)' },
    { id: 'en', name: 'English (US)', nativeName: 'English', region: 'Global B2B Standard' },
  ]

  const currencies = [
    { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka (BDT)' },
    { code: 'USD', symbol: '$', label: 'United States Dollar (USD)' },
    { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
    { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
    { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham (AED)' },
  ]

  const [selectedLang, setSelectedLang] = useState<LanguageId>('bn')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const serverLangRef = useRef<LanguageId>('bn')

  useEffect(() => {
    async function loadLang() {
      setLoading(true)
      setLoadError('')
      setNeedsAuth(false)
      try {
        const res = await fetch('/api/profile/language', { credentials: 'include' })
        if (res.status === 401 || res.status === 403) {
          setNeedsAuth(true)
          return
        }
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setLoadError(json?.error || `Failed to load your saved language (HTTP ${res.status}).`)
          return
        }
        const lang: LanguageId = json.data?.language === 'en' ? 'en' : 'bn'
        serverLangRef.current = lang
        setSelectedLang(lang)
        setConfigured(Boolean(json.data?.configured))
      } catch {
        setLoadError('Network error while loading your saved language. Check your connection and retry.')
      } finally {
        setLoading(false)
      }
    }
    loadLang()
  }, [])

  const selectLanguage = async (lang: LanguageId) => {
    if (saving) return
    setSaveError('')
    setSaving(true)
    try {
      const res = await fetch('/api/profile/language', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: lang }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setSaveError(json?.error || 'Your session ended — sign in to save your language.')
        return
      }
      if (!res.ok || !json?.success) {
        setSaveError(json?.error || `Saving your language failed (HTTP ${res.status}).`)
        return
      }
      const confirmed: LanguageId = json.data?.language === 'en' ? 'en' : 'bn'
      serverLangRef.current = confirmed
      setSelectedLang(confirmed)
      setConfigured(true)
    } catch {
      setSaveError('Network error while saving your language. Check your connection and retry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back">
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
                Your interface language is saved to your account the moment you tap it.
              </p>
            </div>
          </div>
        </div>

        {needsAuth ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
            <h2 className="text-sm font-black">Sign in to manage your saved language</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Language preferences are stored on your account.</p>
            <Button onClick={() => navigate('login')} className="h-11 px-6 rounded-xl text-xs font-bold">Sign In</Button>
          </div>
        ) : (
          <>
            {/* Real load error */}
            {loadError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{loadError}</p>
              </div>
            )}

            {/* Language Selection */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Interface Language</h2>
                {!loading && (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {configured ? 'Customized for your account' : 'Platform default — not customized yet'}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs font-bold ml-2">Loading your saved language…</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {languages.map((lang) => {
                    const isSelected = selectedLang === lang.id
                    const isSaving = saving && isSelected
                    return (
                      <button
                        key={lang.id}
                        onClick={() => { if (!isSelected) selectLanguage(lang.id) }}
                        disabled={saving}
                        className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all disabled:opacity-70 ${
                          isSelected
                            ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <span className={`text-xs font-black block ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>
                            {lang.nativeName} ({lang.name})
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">{lang.region}</span>
                        </div>
                        {isSaving ? (
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </div>
                        ) : isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
              {/* Real save error — verbatim from the server */}
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-600">{saveError}</p>
                </div>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Spanish, French, and Arabic were listed before but were never actually supported — they are
                not implemented yet and require backend support before they can be selected.
              </p>
            </div>

            {/* Preferred Currency — real device-local preference (zustand persist) */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-primary" />
                Wholesale Catalog Currency
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {currencies.map((c) => {
                  const isSelected = currentCurrency === c.code
                  return (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code as CurrencyCode)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-sm font-black font-mono text-primary block">{c.symbol}</span>
                      <span className={`text-xs font-bold block mt-0.5 ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>{c.code}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Currency is stored on this device only (it is not part of your account settings).
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default LanguageSettingsPage
