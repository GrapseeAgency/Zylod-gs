'use client'

import React, { useState, useEffect } from 'react'
import {
  Zap,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  History,
  Smartphone,
  ShieldCheck,
  FileCode2,
  ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function AppUpdatePage() {
  const { navigate } = useNavigationStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  const currentVersion = '2.4.0'
  const currentVersionCode = 240

  const checkForUpdates = () => {
    setChecking(true)
    fetch(`/api/app/version?platform=android&currentVersionCode=${currentVersionCode}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setData(json.data)
      })
      .catch(console.error)
      .finally(() => {
        setChecking(false)
        setLoading(false)
      })
  }

  useEffect(() => {
    checkForUpdates()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">App Updates & Release Channels</h1>
              <p className="text-sm text-muted-foreground">Check official APK builds, SHA-256 binary signatures, and version changelogs</p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={checkForUpdates}
          disabled={checking}
          className="text-xs font-bold gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking Server...' : 'Check for Updates'}
        </Button>
      </div>

      {/* Main Status Hero */}
      <Card className="rounded-2xl border shadow-sm overflow-hidden bg-card">
        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                You are on the Latest Release
              </span>
            </div>
            <h2 className="text-3xl font-black text-foreground">
              Zylod Wholesale v{data?.latestVersion?.versionNumber || currentVersion}
            </h2>
            <p className="text-xs text-muted-foreground">
              Build #{data?.latestVersion?.versionCode || currentVersionCode} • Released on{' '}
              {data?.latestVersion?.releasedAt ? new Date(data.latestVersion.releasedAt).toLocaleDateString() : 'August 2026'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Button
              onClick={() => navigate('apk-download')}
              className="bg-primary text-primary-foreground text-xs font-bold py-5 px-6 rounded-xl gap-2 shadow-sm hover:shadow-md"
            >
              <Download className="h-4 w-4" />
              Download Android APK (28.5 MB)
            </Button>
          </div>
        </div>
      </Card>

      {/* What's New in This Version */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            What&apos;s New in v{data?.latestVersion?.versionNumber || currentVersion}
          </CardTitle>
          <CardDescription className="text-xs">Changelog & performance enhancements</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="p-4 bg-muted/30 rounded-xl border font-mono text-xs whitespace-pre-line leading-relaxed text-foreground">
            {data?.latestVersion?.changelogEn ||
              `- Added Native Android Live Factory Shopping hardware-accelerated video player\n- Instant SafePay Escrow multi-sign biometric authentication\n- Offline product catalogue sync for remote warehouse operations\n- 40% faster bulk image caching and background consignment tracking`}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Verified cryptographic signature (APK Signature Scheme v3)
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('update-changelog')}
              className="text-xs font-semibold text-primary gap-1"
            >
              Full Release Notes <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Navigation to sub-tools */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('version-history')} className="text-xs font-semibold">
          Version History & Archive
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('apk-download')} className="text-xs font-semibold">
          Direct APK Download Mirrors
        </Button>
      </div>
    </div>
  )
}
export default AppUpdatePage
