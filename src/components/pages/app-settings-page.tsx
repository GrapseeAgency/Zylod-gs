'use client'

import React, { useEffect, useState } from 'react'
import {
  Shield, HardDrive, RefreshCw, Sliders, Wifi, ChevronRight, CheckCircle2,
  Fingerprint, Zap, Database, Smartphone,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useDevicePrefs, useLocalStorageUsageBytes } from '@/hooks/use-device-prefs'

export function AppSettingsPage() {
  const { navigate } = useNavigationStore()
  const { prefs, update } = useDevicePrefs()
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [buildVersion, setBuildVersion] = useState<string>('—')

  // Honest build version from the public app settings (no fabricated build number).
  useEffect(() => {
    fetch('/api/app/settings?category=general')
      .then(res => res.json())
      .then(data => {
        const v = data?.data?.settings?.app_version
        if (v) setBuildVersion(v)
      })
      .catch(() => {})
  }, [])

  const realUsageBytes = useLocalStorageUsageBytes()
  const realUsageKb = Math.round(realUsageBytes / 1024)

  const handleToggle = async <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
    setSaving(true)
    // Device-local — synchronous, persisted via useDevicePrefs.
    update(key, value)
    setSavedSuccess(true)
    window.setTimeout(() => setSavedSuccess(false), 1500)
    setSaving(false)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-primary shrink-0">
            <Sliders className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-foreground truncate">App &amp; System Settings</h1>
            <p className="text-sm text-muted-foreground">Configure client caching, synchronization, biometrics, and runtime performance</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs border-primary/30 text-primary">
            v{buildVersion}
          </Badge>
          {savedSuccess && (
            <Badge className="bg-emerald-600 text-white gap-1 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved on this device
            </Badge>
          )}
        </div>
      </div>

      {/* Honest device-local banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <Smartphone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Device-local preferences</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Toggles on this page tune how this browser talks to Zylod. They are stored in your
            localStorage and never sent to the server. The Android app carries its own native
            equivalents on-device.
          </p>
        </div>
      </div>

      {/* Quick Navigation Hub — honest numbers derived from real state */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            id: 'storage-management',
            title: 'Storage Manager',
            desc: `${realUsageKb} KB stored`,
            icon: HardDrive,
            color: 'text-blue-600',
          },
          {
            id: 'cache-settings',
            title: 'Cache & Purge',
            desc: `${prefs.imageCacheMaxMb} MB cap`,
            icon: RefreshCw,
            color: 'text-emerald-600',
          },
          {
            id: 'app-update',
            title: 'Check Updates',
            desc: `v${buildVersion}`,
            icon: Zap,
            color: 'text-amber-600',
          },
          {
            id: 'offline-mode',
            title: 'Offline Package',
            desc: prefs.autoSyncIntervalMins > 0 ? `${prefs.autoSyncIntervalMins}m sync` : 'Manual',
            icon: Wifi,
            color: 'text-purple-600',
          },
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
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-foreground truncate">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.desc}</p>
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
              Security &amp; Biometrics
            </CardTitle>
            <CardDescription className="text-xs">Manage device-level credentials and biometric gates</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-primary shrink-0" /> Biometric Sign-In Preference
                </div>
                <p className="text-xs text-muted-foreground">
                  Stored preference — biometric sign-in is not available on the web app yet
                </p>
              </div>
              <Switch
                checked={prefs.biometricLogin}
                onCheckedChange={(v) => handleToggle('biometricLogin', v)}
                disabled={saving}
                aria-label="Toggle biometric preference"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t">
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-sm">Session Inactivity Lock</div>
                <p className="text-xs text-muted-foreground">
                  Auto-lock session after 30 minutes of background state
                </p>
              </div>
              <Switch
                checked={prefs.sessionInactivityLock}
                onCheckedChange={(v) => handleToggle('sessionInactivityLock', v)}
                disabled={saving}
                aria-label="Toggle session inactivity lock"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('app-security-settings')}
              className="w-full text-xs font-semibold mt-2"
            >
              Advanced Security &amp; Permissions
            </Button>
          </CardContent>
        </Card>

        {/* Synchronization & Offline Network */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Sync &amp; Network Behavior
            </CardTitle>
            <CardDescription className="text-xs">Background sync frequency and connection timeouts</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-600 shrink-0" /> Background Auto-Sync
                </div>
                <p className="text-xs text-muted-foreground">
                  {prefs.autoSyncIntervalMins > 0
                    ? `Auto-reconcile queued RFQs & offline orders every ${prefs.autoSyncIntervalMins} mins`
                    : 'Auto-sync off — queued work reconciles on next manual refresh'}
                </p>
              </div>
              <Switch
                checked={prefs.autoSyncIntervalMins > 0}
                onCheckedChange={(v) => handleToggle('autoSyncIntervalMins', v ? 15 : 0)}
                disabled={saving}
                aria-label="Toggle background auto-sync"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t">
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-sm">WiFi-Only Image Preload</div>
                <p className="text-xs text-muted-foreground">
                  Restrict high-res wholesale swatch downloads to Wi-Fi
                </p>
              </div>
              <Switch
                checked={prefs.wifiOnlyImagePreload}
                onCheckedChange={(v) => handleToggle('wifiOnlyImagePreload', v)}
                disabled={saving}
                aria-label="Toggle Wi-Fi-only image preload"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('app-network-settings')}
              className="w-full text-xs font-semibold mt-2"
            >
              Configure Network &amp; Latency Rules
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostic Sub-links & Tools */}
      <Card className="rounded-2xl border shadow-sm bg-muted/20">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary shrink-0" />
                Diagnostic &amp; System Tools
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
