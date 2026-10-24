'use client'

/**
 * APK DOWNLOAD — Task 176-c. The previous page shipped a HARDCODED version
 * ("v2.4.0 Final"), a HARDCODED package size ("28.5 MB"), and a SHA-256
 * checksum that is the well-known hash of the EMPTY STRING
 * (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).
 * The "Download APK Now" button called `window.open('/api/app/version')` —
 * but /api/app/version returns JSON update-check data, NOT an APK file, so
 * clicking Download gave the user a JSON file. Pure showcase.
 *
 * This rewrite wires the page to the REAL /api/app/version rail: it loads
 * the actual latest published version (versionNumber, versionCode,
 * apkDownloadUrl, apkSizeBytes, releasedAt, changelogEn) and links the
 * Download button to the real APK file URL. No SHA-256 hash is shown
 * (the schema has no SHA column — pretending one exists would be the same
 * lie class as the empty-string hash before). Honest 404 / empty state
 * when no published version exists.
 */
import React, { useEffect, useState } from 'react'
import { Download, ArrowLeft, ShieldCheck, Smartphone, AlertCircle, Loader2, FileCheck2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

interface VersionData {
  versionNumber: string
  versionCode: number
  apkDownloadUrl?: string | null
  apkSizeBytes?: number | null
  releasedAt?: string | null
  changelogEn?: string | null
}

export function ApkDownloadPage() {
  const { navigate } = useNavigationStore()
  const [latest, setLatest] = useState<VersionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/app/version?platform=android')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (!res.ok || !json?.success) {
          setError(json?.error || `Failed to load version info (${res.status}).`)
          return
        }
        if (json.data?.latestVersion) {
          setLatest(json.data.latestVersion as VersionData)
        }
      })
      .catch(() => {
        if (mounted) setError('Could not reach the version service. Try again shortly.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const fmtSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null
    const mb = bytes / (1024 * 1024)
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`
    return `${mb.toFixed(1)} MB`
  }

  const downloadUrl = latest?.apkDownloadUrl || null
  const sizeLabel = fmtSize(latest?.apkSizeBytes)

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-update')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Updates
      </Button>

      <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-black text-foreground">Direct Android APK Download</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Latest published Android release — version and size come from the live app-versions rail
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="font-bold text-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : !latest || !downloadUrl ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <Smartphone className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-bold text-foreground">No published Android release yet</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              There is no published APK in the app-versions table right now. When a real release ships, it will
              be listed here with its actual version number, file size and download URL — no invented numbers.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('app-update')} className="text-xs font-semibold">
              Back to App Updates
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Production Release
              </CardTitle>
              <Badge className="bg-emerald-600 text-white text-xs">v{latest.versionNumber}</Badge>
            </div>
            <CardDescription className="text-xs">
              Build #{latest.versionCode}
              {sizeLabel && ` • ${sizeLabel}`}
              {latest.releasedAt && ` • released ${new Date(latest.releasedAt).toLocaleDateString()}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latest.changelogEn && (
              <div className="p-3 bg-muted/30 rounded-xl border text-xs leading-relaxed text-foreground whitespace-pre-line">
                {latest.changelogEn}
              </div>
            )}

            <div className="p-3 bg-muted/30 rounded-xl border text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p>
                The APK is served from Zylod&apos;s own static download directory. We do not publish a SHA-256
                checksum because the app-versions schema does not store one — install verification relies on
                Android&apos;s built-in APK Signature Scheme v3 (the package is signed by Zylod&apos;s release
                key, and Android refuses to install a mismatched signer).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href={downloadUrl}
                download
                className="flex-1"
              >
                <Button className="w-full bg-primary text-primary-foreground text-xs font-bold py-4 rounded-xl gap-2 shadow-sm">
                  <Download className="h-4 w-4" />
                  Download APK{sizeLabel ? ` (${sizeLabel})` : ''}
                </Button>
              </a>
              <Button
                variant="outline"
                onClick={() => navigate('version-history')}
                className="text-xs font-bold gap-2"
              >
                <FileCheck2 className="h-4 w-4" />
                Version History
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default ApkDownloadPage
