'use client'

/**
 * APP UPDATES & RELEASE CHANNELS — Task 176-c. The previous page shipped a
 * hardcoded "currentVersion = '2.4.0'" + "currentVersionCode = 240" with a
 * "Released on August 2026" fallback date that was never real, a hardcoded
 * "Download Android APK (28.5 MB)" size, and an unconditional
 * "Verified cryptographic signature (APK Signature Scheme v3)" claim that
 * nothing on the platform actually attests.
 *
 * This rewrite reads EVERYTHING from /api/app/version: versionNumber,
 * versionCode, apkDownloadUrl, apkSizeBytes, releasedAt, changelogEn. The
 * "Latest Release" badge only renders when the rail actually returns a
 * latest version. The APK-size label and download link come from the
 * server. The "verified signature" line is replaced with an honest
 * statement about what Android's installer actually checks.
 *
 * The update-check call uses `currentVersionCode=0` so the server always
 * reports `updateAvailable: true` if any version is published — the page
 * is "show me the latest", not "compare against a stub local version".
 */
import { PageLoader } from '@/components/ui/page-loader'
import React, { useEffect, useState } from 'react'
import { Zap, Download, RefreshCw, History, ShieldCheck, FileCode2, ChevronRight, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

interface LatestVersion {
  versionNumber: string
  versionCode: number
  apkDownloadUrl?: string | null
  apkSizeBytes?: number | null
  releasedAt?: string | null
  changelogEn?: string | null
}

export function AppUpdatePage() {
  const { navigate } = useNavigationStore()
  const [latest, setLatest] = useState<LatestVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkForUpdates = () => {
    setChecking(true)
    // currentVersionCode=0 → server reports the latest published version
    // unconditionally, which is exactly what this page is meant to show.
    fetch('/api/app/version?platform=android&currentVersionCode=0')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setError(json?.error || `Failed to load version info (${res.status}).`)
          return
        }
        setError(null)
        if (json.data?.latestVersion) {
          setLatest(json.data.latestVersion as LatestVersion)
        } else {
          setLatest(null)
        }
      })
      .catch(() => setError('Could not reach the version service. Try again shortly.'))
      .finally(() => {
        setChecking(false)
        setLoading(false)
      })
  }

  useEffect(() => {
    checkForUpdates()
  }, [])

  const fmtSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null
    const mb = bytes / (1024 * 1024)
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`
    return `${mb.toFixed(1)} MB`
  }

  const sizeLabel = fmtSize(latest?.apkSizeBytes)
  const downloadUrl = latest?.apkDownloadUrl

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">App Updates &amp; Release Channels</h1>
              <p className="text-sm text-muted-foreground">Latest published Android release and changelog</p>
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
          {checking ? 'Checking...' : 'Check for Updates'}
        </Button>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="font-bold text-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : !latest ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <History className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-bold text-foreground">No published releases yet</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              There is no published Android release in the app-versions table. When Zylod ships a real update,
              it will be listed here with its actual version number, size and changelog.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main Status Hero */}
          <Card className="rounded-2xl border shadow-sm overflow-hidden bg-card">
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Latest Published Release
                  </span>
                </div>
                <h2 className="text-3xl font-black text-foreground">Zylod Wholesale v{latest.versionNumber}</h2>
                <p className="text-xs text-muted-foreground">
                  Build #{latest.versionCode}
                  {latest.releasedAt && ` • released ${new Date(latest.releasedAt).toLocaleDateString()}`}
                  {sizeLabel && ` • ${sizeLabel}`}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                {downloadUrl ? (
                  <a href={downloadUrl} download className="contents">
                    <Button className="bg-primary text-primary-foreground text-xs font-bold py-5 px-6 rounded-xl gap-2 shadow-sm hover:shadow-md">
                      <Download className="h-4 w-4" />
                      Download Android APK{sizeLabel ? ` (${sizeLabel})` : ''}
                    </Button>
                  </a>
                ) : (
                  <Button disabled className="text-xs font-bold py-5 px-6 rounded-xl gap-2">
                    <Download className="h-4 w-4" />
                    APK download unavailable
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* What's New in This Version */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-primary" />
                What&apos;s New in v{latest.versionNumber}
              </CardTitle>
              <CardDescription className="text-xs">Changelog from the published release</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 bg-muted/30 rounded-xl border font-mono text-xs whitespace-pre-line leading-relaxed text-foreground">
                {latest.changelogEn || 'No changelog published for this release.'}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Android verifies the APK signer at install time
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
        </>
      )}

      {/* Navigation to sub-tools */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('version-history')} className="text-xs font-semibold">
          Version History &amp; Archive
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('apk-download')} className="text-xs font-semibold">
          Direct APK Download
        </Button>
      </div>
    </div>
  )
}
export default AppUpdatePage
