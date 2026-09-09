'use client'

import React, { useState, useEffect } from 'react'
import { Sliders, ArrowLeft, CheckCircle2, Save, Sparkles, Building2, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigationStore } from '@/store/navigation-store'

export function AppGeneralSettingsPage() {
  const { navigate } = useNavigationStore()
  const [appName, setAppName] = useState('Zylod Wholesale')
  const [minOrderBdt, setMinOrderBdt] = useState('5000')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/app/settings?category=general')
      .then(res => res.json())
      .then(data => {
        if (data?.data?.settings) {
          if (data.data.settings.app_name) setAppName(data.data.settings.app_name)
          if (data.data.settings.min_order_bdt) setMinOrderBdt(data.data.settings.min_order_bdt)
        }
      })
      .catch(console.error)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/app/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'min_order_bdt', value: minOrderBdt, category: 'general' }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">General App Preferences</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Platform wholesale thresholds, default currency units, and display parameters</p>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Wholesale Commercial Baseline
          </CardTitle>
          <CardDescription className="text-xs">Configure platform-wide transaction guardrails</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">App Identifier</Label>
                <Input value={appName} disabled className="bg-muted/40 font-mono text-xs" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Default Wholesale Minimum Order Value (BDT)</Label>
                <Input
                  type="number"
                  value={minOrderBdt}
                  onChange={e => setMinOrderBdt(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Default minimum B2B order value across supplier catalogues</p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save General Settings'}
              </Button>
              {saved && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Updated successfully!
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
export default AppGeneralSettingsPage
