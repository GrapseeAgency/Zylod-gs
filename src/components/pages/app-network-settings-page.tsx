'use client'

import React, { useState } from 'react'
import { Wifi, ArrowLeft, CheckCircle2, Save, Activity, Globe2, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'

export function AppNetworkSettingsPage() {
  const { navigate } = useNavigationStore()
  const [timeoutMs, setTimeoutMs] = useState('15000')
  const [dataSaver, setDataSaver] = useState(false)
  const [dnsOverHttps, setDnsOverHttps] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/app/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'network_timeout_ms', value: timeoutMs, category: 'network' }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Network & Latency Rules</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Configure network timeouts, data saver limits, and CDN failover routes</p>
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
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold">API Request Timeout (Milliseconds)</Label>
              <Input
                type="number"
                value={timeoutMs}
                onChange={e => setTimeoutMs(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Standard timeout before triggering offline fallback mode (Default: 15000 ms)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <div className="font-semibold text-sm">Low-Bandwidth Wholesale Mode</div>
                  <p className="text-xs text-muted-foreground">Compress catalog thumbnails for 2G/3G connectivity in remote production zones</p>
                </div>
                <Switch checked={dataSaver} onCheckedChange={setDataSaver} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <div className="font-semibold text-sm">Encrypted DNS over HTTPS (DoH)</div>
                  <p className="text-xs text-muted-foreground">Enforce DNS query encryption for enterprise supplier transactions</p>
                </div>
                <Switch checked={dnsOverHttps} onCheckedChange={setDnsOverHttps} />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Updating...' : 'Save Network Config'}
              </Button>
              {saved && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Network rules updated!
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
export default AppNetworkSettingsPage
