'use client'

/**
 * UPDATE CHANGELOG / RELEASE NOTES (audit unit 29 — Task 174).
 *
 * HONESTY LINEAGE: the original page shipped a fabricated "Official Release
 * Notes — v2.4.0" with invented "Live Factory Shopping Engine" and "Offline
 * Wholesale Catalogue" features. t174 replaced it with an honest STATIC empty
 * state. t285 wires it to the LIVE app-versions rail: the page now renders
 * the REAL notes of the latest published release (changelog, date, APK link)
 * and links to the version-history archive for older releases. The honest
 * empty state remains for the genuinely-empty DB and for load/HTTP failures.
 */
import { PageLoader } from '@/components/ui/page-loader'
import React, { useEffect, useState } from 'react'
import { ArrowLeft, Download, FileCode2, History, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

interface LatestData {
  versionNumber: string
  versionCode: number
  changelogEn?: string | null
  releaseNotes?: string | null
  releasedAt?: string | null
  apkDownloadUrl?: string | null
  apkSizeBytes?: number | null
}

export function UpdateChangelogPage() {
  const { navigate } = useNavigationStore()
  const [latest, setLatest] = useState<LatestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/app/version?platform=android')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (!res.ok || !json?.success) {
          setError(json?.error || `Failed to load release notes (${res.status}).`)
          return
        }
        if (json?.data?.latestVersion && typeof json.data.latestVersion === 'object') {
          setLatest(json.data.latestVersion as LatestData)
        } else {
          setLatest(null)
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

  const fmtDate = (iso?: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-update')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Updates
      </Button>

      <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <FileCode2 className="h-6 w-6 text-primary" />
          Release Notes
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real release notes only — served live from the published app-versions record
        </p>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">{error}</p>
              <p className="mt-1 text-xs">Release notes are only published for releases the server actually shipped.</p>
            </div>
          </CardContent>
        </Card>
      ) : !latest ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-background p-8 text-center space-y-2">
          <History className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-bold text-foreground">No releases published yet</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            When Zylod ships a real update, its actual version number, date, and change notes will appear here. We do not publish invented changelog entries.
          </p>
        </div>
      ) : (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black text-foreground">v{latest.versionNumber}</span>
              <Badge variant="outline" className="text-[10px] font-semibold h-5 rounded-md">
                Build #{latest.versionCode}
              </Badge>
              <Badge className="text-[10px] font-bold h-5 rounded-md">Latest</Badge>
              {fmtDate(latest.releasedAt) && (
                <span className="text-[11px] text-muted-foreground ml-auto">
                  Released {fmtDate(latest.releasedAt)}
                </span>
              )}
            </div>

            {latest.releaseNotes && (
              <p className="text-sm text-foreground font-medium leading-relaxed">{latest.releaseNotes}</p>
            )}

            {(latest.changelogEn || '').split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean).length > 0 && (
              <ul className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                {(latest.changelogEn || '')
                  .split('\n')
                  .map(l => l.replace(/^-\s*/, '').trim())
                  .filter(Boolean)
                  .map((b, i) => (
                    <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                      <span aria-hidden className="text-primary mt-px">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
              {latest.apkDownloadUrl && (
                <Button asChild size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-lg">
                  <a href={latest.apkDownloadUrl} download>
                    <Download className="h-3.5 w-3.5" />
                    Download APK{fmtSize(latest.apkSizeBytes) ? ` (${fmtSize(latest.apkSizeBytes)})` : ''}
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('version-history')}
                className="h-9 text-xs font-semibold gap-1.5 rounded-lg"
              >
                <History className="h-3.5 w-3.5" /> View version history
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default UpdateChangelogPage
