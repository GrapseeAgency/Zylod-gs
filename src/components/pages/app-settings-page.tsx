'use client'

import React, { useState, useEffect } from 'react'
import {
  Smartphone,
  Shield,
  HardDrive,
  RefreshCw,
  Sliders,
  Wifi,
  ChevronRight,
  CheckCircle2,
  Bell,
  Fingerprint,
  Zap,
  Globe,
  Database
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function AppSettingsPage() {
  const { navigate } = useNavigationStore()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(true)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [offlineCacheEnabled, setOfflineCacheEnabled] = useState(true)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/app/settings')
      .then(res => res.json())
      .then(data => {
        if (data?.data?.settings) {
          setSettings(data.data.settings)
          setBiometricEnabled(data.data.settings.enable_biometric_login === 'true')
          setAutoSyncEnabled(data.data.settings.auto_sync_interval_mins !== '0')
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: string, value: string, setter: (val: boolean) => void, currentVal: boolean) => {
    setter(!currentVal)
    setSaving(true)
    try {
      await fetch('/api/app/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-primary">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">App & System Settings</h1>
              <p className="text-sm text-muted-foreground">Configure client caching, synchronization, biometrics, and runtime performance</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs border-primary/30 text-primary">
            v2.4.0 (Build 240)
          </Badge>
          {savedSuccess && (
            <Badge className="bg-emerald-600 text-white gap-1 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Navigation Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { id: 'storage-management', title: 'Storage Manager', desc: '52.4 MB allocated', icon: HardDrive, color: 'text-blue-600' },
          { id: 'cache-settings', title: 'Cache & Purge', desc: '45.0 MB cache', icon: RefreshCw, color: 'text-emerald-600' },
          { id: 'app-update', title: 'Check Updates', desc: 'v2.4.0 Latest', icon: Zap, color: 'text-amber-600' },
          { id: 'offline-mode', title: 'Offline Package', desc: 'Available for sync', icon: Wifi, color: 'text-purple-600' },
        ].map((item) => (
          <Card
            key={item.id}
            onClick={() => navigate(item.id as any)}
            className="cursor-pointer hover:border-primary transition-all hover:shadow-md group"
          >
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-3">
                <item.icon className={`h-5 w-5 ${item.color}`} />
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security & Authentication */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security & Biometrics
            </CardTitle>
            <CardDescription className="text-xs">Manage device-level credentials and biometric gates</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-primary" /> Biometric SafePay
                </div>
                <p className="text-xs text-muted-foreground">Require fingerprint/face authentication for escrow authorizations</p>
              </div>
              <Switch
                checked={biometricEnabled}
                onCheckedChange={() => handleToggle('enable_biometric_login', biometricEnabled ? 'false' : 'true', setBiometricEnabled, biometricEnabled)}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm">Session Inactivity Lock</div>
                <p className="text-xs text-muted-foreground">Auto-lock session after 30 minutes of background state</p>
              </div>
              <Switch defaultChecked />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('app-security-settings')}
              className="w-full text-xs font-semibold mt-2"
            >
              Advanced Security & Permissions
            </Button>
          </CardContent>
        </Card>

        {/* Synchronization & Offline Network */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Sync & Network Behavior
            </CardTitle>
            <CardDescription className="text-xs">Background sync frequency and connection timeouts</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-600" /> Background Auto-Sync
                </div>
                <p className="text-xs text-muted-foreground">Auto-reconcile queued RFQs & offline orders every 15 mins</p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={() => handleToggle('auto_sync_interval_mins', autoSyncEnabled ? '0' : '15', setAutoSyncEnabled, autoSyncEnabled)}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm">WiFi-Only Image Preload</div>
                <p className="text-xs text-muted-foreground">Restrict high-res wholesale swatch downloads to Wi-Fi</p>
              </div>
              <Switch defaultChecked />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('app-network-settings')}
              className="w-full text-xs font-semibold mt-2"
            >
              Configure Network & Latency Rules
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostic Sub-links & Tools */}
      <Card className="rounded-2xl border shadow-sm bg-muted/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Diagnostic & System Tools
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deep link debugging, maintenance status, live latency probes, and crash report telemetry
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => navigate('deep-link-handler')} className="text-xs">
                Deep Link Tool
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('server-diagnostics')} className="text-xs">
                Live Health
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('maintenance-mode')} className="text-xs">
                Maintenance Window
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default AppSettingsPage
