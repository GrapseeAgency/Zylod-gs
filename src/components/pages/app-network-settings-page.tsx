'use client'

import React from 'react'
import { Wifi, ArrowLeft, CheckCircle2, Save, Activity, Globe2, ShieldCheck, Smartphone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useDevicePrefs } from '@/hooks/use-device-prefs'

export function AppNetworkSettingsPage() {
  const { navigate } = useNavigationStore()
  const { prefs, update } = useDevicePrefs()
  const [saved, setSaved] = React.useState(false)

  const handleSave = () => {
    // All three fields persisted to localStorage by the setters.
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Network &amp; Latency Rules</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure network timeouts, data saver limits, and CDN failover routes
        </p>
      </div>

      {/* Honest device-local banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <Smartphone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Saved on this device</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Network behavior rules are client-side preferences. They tune how this browser fetches
            from Zylod and live in localStorage. The Android app carries its own network rules.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Connection Resilience
          </CardTitle>
          <CardDescription className="text-xs">Manage mobile cellular vs broadband latency behaviors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold">API Request Timeout (Milliseconds)</Label>
              <Input
                type="number"
                min={1000}
                max={120000}
                step={500}
                value={prefs.networkTimeoutMs}
                onChange={(e) => update('networkTimeoutMs', Number(e.target.value) || 15000)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Standard timeout before triggering offline fallback mode (default: 15000 ms)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex items-center justify-between pt-2 border-t gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    Low-Bandwidth Wholesale Mode
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compress catalog thumbnails for 2G/3G connectivity in remote production zones
                  </p>
                </div>
                <Switch
                  checked={prefs.dataSaver}
                  onCheckedChange={(v) => update('dataSaver', v)}
                  aria-label="Toggle low-bandwidth mode"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                    Encrypted DNS over HTTPS (DoH)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enforce DNS query encryption for enterprise supplier transactions
                  </p>
                </div>
                <Switch
                  checked={prefs.dnsOverHttps}
                  onCheckedChange={(v) => update('dnsOverHttps', v)}
                  aria-label="Toggle DNS over HTTPS"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between gap-3 flex-wrap">
              <Badge variant="outline" className="text-[10px] font-mono py-1 gap-1">
                <Globe2 className="h-3 w-3" /> {prefs.dnsOverHttps ? 'DoH ON' : 'DoH OFF'} · {prefs.dataSaver ? 'Saver' : 'Full'}
              </Badge>
              <Button onClick={handleSave} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Saved on this device' : 'Save Network Config'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default AppNetworkSettingsPage
