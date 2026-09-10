'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useTheme } from 'next-themes'
import {
  ArrowLeft, Sun, Moon, Laptop2, Eye, Activity,
  Sparkles, Check, Loader2, Layers, Sliders, Shield
} from 'lucide-react'

export function ThemeSettingsPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { setTheme: setAppliedTheme } = useTheme()

  // 'obsidian' is a pure-black variant of dark — next-themes gets 'dark'
  const applyTheme = (mode: string) => setAppliedTheme(mode === 'light' ? 'light' : mode === 'system' ? 'system' : 'dark')

  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'obsidian' | 'system'>('light')
  const [highContrast, setHighContrast] = useState(false)
  const [compactDensity, setCompactDensity] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadTheme() {
      if (!token) return
      try {
        const res = await fetch('/api/profile/theme', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            if (json.data.mode) {
              setThemeMode(json.data.mode)
              applyTheme(json.data.mode)
            }
            if (Array.isArray(json.data.accessibility)) {
              const hc = json.data.accessibility.find((a: any) => a.id === 'high-contrast')
              const rm = json.data.accessibility.find((a: any) => a.id === 'reduce-motion')
              if (hc) setHighContrast(Boolean(hc.enabled))
              if (rm) setReduceMotion(Boolean(rm.enabled))
            }
          }
        }
      } catch {
        // Graceful
      }
    }
    loadTheme()
  }, [token])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (token) {
        await fetch('/api/profile/theme', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: {
              mode: themeMode,
              accessibility: [
                { id: 'high-contrast', label: 'High Contrast', enabled: highContrast },
                { id: 'compact-density', label: 'Compact Grid Density', enabled: compactDensity },
                { id: 'reduce-motion', label: 'Reduce Motion', enabled: reduceMotion },
              ],
            },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Theme &amp; Appearance</span>
        <div className="w-8" />
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Theme Appearance</h1>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Sun className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Display &amp; Appearance</h1>
              <p className="text-xs text-slate-300">
                Personalize your workspace palette, contrast levels, and data density.
              </p>
            </div>
          </div>
        </div>

        {/* Theme Mode Selector */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Color Theme
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { key: 'light', label: 'Crisp White', desc: 'Standard daytime mode', icon: Sun },
              { key: 'dark', label: 'Charcoal Dark', desc: 'Low-light comfort', icon: Moon },
              { key: 'obsidian', label: 'OLED Obsidian', desc: 'True pure black', icon: Layers },
              { key: 'system', label: 'System Sync', desc: 'Matches device settings', icon: Laptop2 },
            ].map(({ key, label, desc, icon: Icon }) => {
              const isSelected = themeMode === key
              return (
                <button
                  key={key}
                  onClick={() => {
                    setThemeMode(key as any)
                    applyTheme(key)
                  }}
                  className={`p-3.5 rounded-2xl border text-left space-y-1.5 transition-all ${
                    isSelected
                      ? 'border-primary bg-rose-50/60 ring-2 ring-primary/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-slate-500'}`} />
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary stroke-[3]" />}
                  </div>
                  <div>
                    <span className={`text-xs font-bold block ${isSelected ? 'text-primary' : 'text-slate-900'}`}>{label}</span>
                    <span className="text-[10px] text-slate-400 block">{desc}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Accessibility & Density */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Catalog Ergonomics &amp; Motion</span>
          </div>

          <div className="divide-y divide-slate-50">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">High Contrast Mode</h3>
                  <p className="text-[11px] text-slate-400">Enhance border contrast and typography weight</p>
                </div>
              </div>
              <Switch checked={highContrast} onCheckedChange={setHighContrast} className="data-[state=checked]:bg-primary" />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Compact Density Grid</h3>
                  <p className="text-[11px] text-slate-400">Fits more wholesale items &amp; SKU rows per screen</p>
                </div>
              </div>
              <Switch checked={compactDensity} onCheckedChange={setCompactDensity} className="data-[state=checked]:bg-primary" />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Reduce Motion</h3>
                  <p className="text-[11px] text-slate-400">Minimize animations and micro-transitions</p>
                </div>
              </div>
              <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} className="data-[state=checked]:bg-primary" />
            </div>
          </div>
        </div>

        {/* Save Button */}
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
            <><Check className="h-4 w-4" /> Theme Preferences Saved!</>
          ) : (
            'Save Theme Settings'
          )}
        </Button>
      </main>
    </div>
  )
}

export default ThemeSettingsPage
