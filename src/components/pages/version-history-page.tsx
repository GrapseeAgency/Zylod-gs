'use client'

/**
 * VERSION HISTORY — release archive.
 *
 * HONESTY LINEAGE: the original page shipped a fabricated changelog
 * (v2.1.0–v2.4.0 with "SafePay multi-tier escrow", "Live Factory streaming",
 * future 2026 dates) — no such releases existed. t173 replaced it with an
 * honest STATIC empty state ("no releases published yet"). t285 wires it to
 * the LIVE app-versions rail: real releases HAVE shipped since (every CI run
 * seeds the published row), so the archive now renders what actually exists —
 * version, code, release date, real change notes, and the real APK link per
 * release. The honest empty state remains for the genuinely-empty DB (never
 * seeded on a fresh volume) and for load/HTTP failures.
 */
import { PageLoader } from '@/components/ui/page-loader'
import React, { useEffect, useState } from 'react'
import { ArrowLeft, Download, History, AlertCircle, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

interface HistoryRow {
  versionNumber: string
  versionCode: number
  changelogEn?: string | null
  releasedAt?: string | null
  apkDownloadUrl?: string | null
  apkSizeBytes?: number | null
}

export function VersionHistoryPage() {
  const { navigate } = useNavigationStore()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/app/version?platform=android')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (!res.ok || !json?.success) {
          setError(json?.error || `Failed to load release history (${res.status}).`)
          return
        }
        const history = json?.data?.history
        setRows(Array.isArray(history) ? history : [])
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
          <History className="h-6 w-6 text-primary" />
          Version History &amp; Release Archive
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real release notes only — every row below is a published app-versions record, served live
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
              <p className="mt-1 text-xs">The archive only lists releases the server actually published.</p>
            </div>
          </CardContent>
        </Card>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-background p-8 text-center space-y-2">
          <History className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-bold text-foreground">No releases published yet</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            When Zylod ships a real update, it will be listed here with its actual version number, date, and change notes. We do not publish invented changelog entries.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {rows.map((r, i) => {
            const bullets = (r.changelogEn || '')
              .split('\n')
              .map(l => l.replace(/^-\s*/, '').trim())
              .filter(Boolean)
            const date = fmtDate(r.releasedAt)
            const size = fmtSize(r.apkSizeBytes)
            const isLatest = i === 0
            return (
              <li key={`${r.versionCode}-${r.versionNumber}`}>
                <Card className={`rounded-2xl border shadow-sm ${isLatest ? 'border-primary/40' : ''}`}>
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-black text-foreground">v{r.versionNumber}</span>
                      <Badge variant="outline" className="text-[10px] font-semibold h-5 rounded-md">
                        Build #{r.versionCode}
                      </Badge>
                      {isLatest && (
                        <Badge className="text-[10px] font-bold h-5 rounded-md">Latest</Badge>
                      )}
                      {date && (
                        <span className="text-[11px] text-muted-foreground ml-auto">Released {date}</span>
                      )}
                    </div>
                    {bullets.length > 0 && (
                      <ul className="space-y-1.5">
                        {bullets.map((b, bi) => (
                          <li key={bi} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                            <span aria-hidden className="text-primary mt-px">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.apkDownloadUrl && (
                      <div className="pt-1">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold gap-1.5 rounded-lg"
                        >
                          <a href={r.apkDownloadUrl} download>
                            <Download className="h-3.5 w-3.5" />
                            Download APK{size ? ` (${size})` : ''}
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
export default VersionHistoryPage
