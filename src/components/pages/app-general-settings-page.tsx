'use client'

import React, { useState, useEffect } from 'react'
import {
  Building2, ArrowLeft, CheckCircle2, Save, ShieldAlert, Loader2, Lock, LogIn,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useToast } from '@/hooks/use-toast'
import { PageLoader } from '@/components/ui/page-loader'

type AuthState = 'loading' | 'anon' | 'forbidden' | 'admin'

export function AppGeneralSettingsPage() {
  const { navigate } = useNavigationStore()
  const { toast } = useToast()
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [appName, setAppName] = useState('Zylod Wholesale')
  const [minOrderBdt, setMinOrderBdt] = useState('5000')
  const [currency, setCurrency] = useState('BDT')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load public platform settings (read is public).
  useEffect(() => {
    fetch('/api/app/settings?category=general')
      .then(res => res.json())
      .then(data => {
        if (data?.data?.settings) {
          if (data.data.settings.app_name) setAppName(data.data.settings.app_name)
          if (data.data.settings.min_order_bdt) setMinOrderBdt(data.data.settings.min_order_bdt)
          if (data.data.settings.default_currency) setCurrency(data.data.settings.default_currency)
        }
      })
      .catch(() => {})
  }, [])

  // Resolve the viewer's role (honest 401/403 gate before the write form is shown).
  useEffect(() => {
    fetch('/api/profile', { headers: { Accept: 'application/json' } })
      .then(res => res.json())
      .then(data => {
        if (!data?.data?.userType) return setAuthState('anon')
        if (data.data.userType !== 'admin') return setAuthState('forbidden')
        setAuthState('admin')
      })
      .catch(() => setAuthState('anon'))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = Number(minOrderBdt)
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast({ title: 'Invalid minimum order', description: 'Enter a non-negative BDT amount.', variant: 'destructive' })
      return
    }
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/app/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'min_order_bdt',
          value: String(numeric),
          category: 'general',
          description: 'Default minimum B2B order value across supplier catalogues',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: `Save failed (${res.status})`,
          description: json?.error || 'The platform config was not updated.',
          variant: 'destructive',
        })
        return
      }
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
      toast({ title: 'Platform config updated', description: `Minimum order value set to ৳${numeric}.` })
    } finally {
      setSaving(false)
    }
  }

  // Honest 401 gate.
  if (authState === 'loading') {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl flex justify-center">
        <PageLoader className="min-h-0" />
      </div>
    )
  }
  if (authState === 'anon') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back to App Settings
        </Button>
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
              <LogIn className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold">Admin sign-in required</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Platform wholesale thresholds are admin-only configuration. Sign in with an admin
              account to edit the default minimum order value.
            </p>
            <Button onClick={() => navigate('login')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (authState === 'forbidden') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back to App Settings
        </Button>
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
              <Lock className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-bold">Admin access required</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              You are signed in, but platform configuration is restricted to admin accounts. Your
              current role does not have permission to edit wholesale thresholds.
            </p>
            <Button variant="outline" onClick={() => navigate('app-settings')} className="text-xs font-bold gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to App Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-black text-foreground">General App Preferences</h1>
          <Badge className="bg-red-600 text-white text-[10px] gap-1 py-0.5">
            <ShieldAlert className="h-3 w-3" /> ADMIN
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Platform wholesale thresholds, default currency units, and display parameters
        </p>
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
                <p className="text-[11px] text-muted-foreground">Read-only platform brand identifier</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Default Currency</Label>
                <Input value={currency} disabled className="bg-muted/40 font-mono text-xs" />
                <p className="text-[11px] text-muted-foreground">Locked to BDT for the Bangladesh market</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-bold">Default Wholesale Minimum Order Value (BDT)</Label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={minOrderBdt}
                  onChange={e => setMinOrderBdt(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Default minimum B2B order value across supplier catalogues. Individual suppliers may
                  raise their own floor above this baseline.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save General Settings'}
              </Button>
              {saved && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Platform config updated
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
