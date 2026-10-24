'use client'

/**
 * LANGUAGE & REGIONAL LOCALIZATION — Task 176-c. The previous page let the
 * user click English / বাংলা cards but the selection lived in a local
 * useState only — it was lost on every refresh, so the toggle was pure
 * theater. This rewrite wires the selection to the real useDevicePrefs
 * hook (`language: 'en' | 'bn'`) so the preference actually persists in
 * localStorage and survives reloads.
 *
 * The web client renders English strings today; the Bengali card is
 * honestly labelled as the future-language track. Selecting বাংলা saves
 * the preference (so a future translation pass can read it) without
 * pretending to translate the UI today.
 */
import React from 'react'
import { ArrowLeft, Check, Smartphone, Languages } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useDevicePrefs } from '@/hooks/use-device-prefs'

const LANGS = [
  {
    code: 'en' as const,
    name: 'English (US & International)',
    desc: 'Standard business English for cross-border and regional trade. The web client renders English today.',
  },
  {
    code: 'bn' as const,
    name: 'বাংলা (বাংলাদেশ)',
    desc: 'Bengali localization is on the roadmap. Saving this preference today will let a future Bengali UI render in বাংলা automatically.',
  },
]

export function AppLanguageSettingsPage() {
  const { navigate } = useNavigationStore()
  const { prefs, update } = useDevicePrefs()
  const selected = prefs.language

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Language &amp; Regional Localization</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick the language the web client should render in — saved on this device
        </p>
      </div>

      {/* Honest device-local banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <Smartphone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Saved on this device</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Your language preference is persisted to localStorage on this browser. The Zylod Android app
            carries its own language setting through its native settings panel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LANGS.map(l => {
          const isSelected = selected === l.code
          return (
            <Card
              key={l.code}
              onClick={() => update('language', l.code)}
              className={`cursor-pointer transition-all border rounded-2xl ${
                isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-border/80'
              }`}
            >
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isSelected ? 'bg-primary text-white' : 'bg-muted text-foreground'
                  }`}>
                    {l.code.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground">{l.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{l.desc}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-4 flex items-start gap-3 text-xs text-muted-foreground">
          <Languages className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            Bengali (বাংলা) is the next planned language for the Bangladesh wholesale market. The web client
            ships English-only today; switching to বাংলা saves your preference so the moment Bengali strings
            ship, this browser will pick them up automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
export default AppLanguageSettingsPage
