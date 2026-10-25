'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useTheme } from 'next-themes'
import {
  ArrowLeft, Sun, Moon, Laptop2, Eye, Activity,
  Check, Loader2, Layers, Sliders, AlertCircle
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Real theme settings, persisted on the userSettings row via
 * GET/PATCH /api/profile/theme (cookies, credentials:'include').
 * - `configured: false` means the account still runs the platform default.
 * - Selection PATCHes immediately — no optimistic writes: the UI applies the
 *   choice only after the server confirms, and reverts + shows the verbatim
 *   error when the write fails.
 * - The old 'obsidian' option is gone: the backend only persists
 *   system|light|dark, and a mode that cannot survive a reload is not a theme.
 * - High-contrast / compact-density / reduce-motion have NO backend backing —
 *   they are shown honestly as not implemented instead of fake toggles.
 */
export function ThemeSettingsPage() {
  const { goBack, navigate } = useNavigationStore()
  const { setTheme: setAppliedTheme } = useTheme()

  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [configured, setConfigured] = useState(false)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [savingMode, setSavingMode] = useState<ThemeMode | null>(null)
  const [saveError, setSaveError] = useState('')
  const serverThemeRef = useRef<ThemeMode>('system')

  useEffect(() => {
    async function loadTheme() {
      setLoading(true)
      setLoadError('')
      setNeedsAuth(false)
      try {
        const res = await fetch('/api/profile/theme', { credentials: 'include' })
        if (res.status === 401 || res.status === 403) {
          setNeedsAuth(true)
          return
        }
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setLoadError(json?.error || `Failed to load your saved theme (HTTP ${res.status}).`)
          return
        }
        const mode: ThemeMode = json.data?.theme === 'dark' ? 'dark' : json.data?.theme === 'light' ? 'light' : 'system'
        serverThemeRef.current = mode
        setThemeMode(mode)
        setConfigured(Boolean(json.data?.configured))
      } catch {
        setLoadError('Network error while loading your saved theme. Check your connection and retry.')
      } finally {
        setLoading(false)
      }
    }
    loadTheme()
  }, [])

  const selectTheme = async (mode: ThemeMode) => {
    if (savingMode) return
    setSaveError('')
    setSavingMode(mode)
    try {
      const res = await fetch('/api/profile/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: mode }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setSaveError(json?.error || 'Your session ended — sign in to save your theme.')
        return
      }
      if (!res.ok || !json?.success) {
        setSaveError(json?.error || `Saving your theme failed (HTTP ${res.status}).`)
        return
      }
      // Server confirmed — only now apply and keep the state.
      const confirmed: ThemeMode = json.data?.theme === 'dark' ? 'dark' : json.data?.theme === 'light' ? 'light' : 'system'
      serverThemeRef.current = confirmed
      setThemeMode(confirmed)
      setConfigured(true)
      setAppliedTheme(confirmed)
    } catch {
      setSaveError('Network error while saving your theme. Check your connection and retry.')
    } finally {
      setSavingMode(null)
    }
  }

  const options: { key: ThemeMode; label: string; desc: string; icon: React.ElementType }[] = [
    { key: 'light', label: 'Crisp White', desc: 'Standard daytime mode', icon: Sun },
    { key: 'dark', label: 'Charcoal Dark', desc: 'Low-light comfort', icon: Moon },
    { key: 'system', label: 'System Sync', desc: 'Matches device settings', icon: Laptop2 },
  ]

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 pb-24 md:pb-10">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Theme &amp; Appearance</span>
        <div className="w-8" />
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Theme Appearance</h1>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-slate-900 dark:to-rose-950 rounded-3xl p-5 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <Sun className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Display &amp; Appearance</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Your choice is saved to your account the moment you tap it.
              </p>
            </div>
          </div>
        </div>

        {needsAuth ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xs text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
            <h2 className="text-sm font-black">Sign in to manage your saved theme</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Theme preferences are stored on your account.</p>
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

            {/* Theme Mode Selector */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Color Theme</h2>
                {!loading && (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    {configured ? 'Customized for your account' : 'Platform default — not customized yet'}
                  </span>
                )}
              </div>
              {loading ? (
                <PageLoader label="Loading your saved theme…" />
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {options.map(({ key, label, desc, icon: Icon }) => {
                    const isSelected = themeMode === key
                    const isSaving = savingMode === key
                    return (
                      <button
                        key={key}
                        onClick={() => selectTheme(key)}
                        disabled={savingMode !== null}
                        className={`p-3.5 rounded-2xl border text-left space-y-1.5 transition-all disabled:opacity-70 ${
                          isSelected
                            ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} />
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : (
                            isSelected && <Check className="h-3.5 w-3.5 text-primary stroke-[3]" />
                          )}
                        </div>
                        <div>
                          <span className={`text-xs font-bold block ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-slate-100'}`}>{label}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 block">{desc}</span>
                        </div>
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
            </div>

            {/* Accessibility & Density — honestly not implemented (no backend storage) */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-background border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Catalog Ergonomics &amp; Motion</span>
              </div>

              <div className="divide-y divide-slate-50">
                <div className="p-4 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <Eye className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">High Contrast Mode</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Not implemented yet — requires backend support</p>
                    </div>
                  </div>
                  <Switch checked={false} disabled aria-label="High Contrast Mode (not implemented)" />
                </div>

                <div className="p-4 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Compact Density Grid</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Not implemented yet — requires backend support</p>
                    </div>
                  </div>
                  <Switch checked={false} disabled aria-label="Compact Density Grid (not implemented)" />
                </div>

                <div className="p-4 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Reduce Motion</h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Not implemented yet — requires backend support</p>
                    </div>
                  </div>
                  <Switch checked={false} disabled aria-label="Reduce Motion (not implemented)" />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default ThemeSettingsPage
