'use client'

import React, { useState } from 'react'
import { Globe, ArrowLeft, Check, Languages } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function AppLanguageSettingsPage() {
  const { navigate } = useNavigationStore()
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'bn'>('en')

  const langs = [
    { code: 'en', name: 'English (US & International)', localName: 'English', desc: 'Standard business English for cross-border and regional trade' },
    { code: 'bn', name: 'বাংলা (বাংলাদেশ)', localName: 'Bengali', desc: 'স্থানীয় পাইকারি ও প্রস্তুতকারক বাণিজ্যের জন্য' },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Language & Regional Localization</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Switch interface languages, numeric digit formats (লিপি), and localized invoice terms</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {langs.map((l) => {
          const isSelected = selectedLanguage === l.code
          return (
            <Card
              key={l.code}
              onClick={() => setSelectedLanguage(l.code as any)}
              className={`cursor-pointer transition-all border rounded-2xl ${
                isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-border/80'
              }`}
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold ${
                    isSelected ? 'bg-primary text-white' : 'bg-muted text-foreground'
                  }`}>
                    {l.code.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{l.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
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
    </div>
  )
}
export default AppLanguageSettingsPage
