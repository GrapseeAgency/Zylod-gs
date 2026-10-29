'use client'

/**
 * t230 MANDATORY-UPDATE GATE (native shells only).
 *
 * Why: the owner's device kept polling /api/app/version with
 * currentVersionCode=230 (v2.3.0) — a build that predates the back-stack
 * fix, the offline catalogue, the guest-order lockout and the navy-chrome
 * fix. Every audit since then graded the OLD APK while the server was
 * serving the fixed web bundle. The DB flag was soft (`isMandatory=false`),
 * so nothing ever forced the update.
 *
 * How: when this page runs INSIDE a Zylod native shell (WebView UA carries
 * `ZylodAndroidNative/<versionName>`), the gate derives the numeric
 * versionCode from the UA (2.4.6 → 246 — the same scheme gradle stamps),
 * asks /api/app/version, and — when the server says a MANDATORY update is
 * available — replaces the whole app with a blocking update screen: the
 * changelog, the APK size, and a direct download button. No dismiss control:
 * a mandatory update is mandatory. Plain browsers never match the native
 * markers, so the web experience is untouched.
 */

import React, { useEffect, useState } from 'react'
import { isNativeHost } from '@/lib/native-host'
import { AlertTriangle, Download, RefreshCw } from 'lucide-react'

interface LatestVersion {
  versionNumber: string
  versionCode: number
  changelogEn?: string | null
  apkDownloadUrl?: string | null
  apkSizeBytes?: number | null
}

/** "2.4.6" / "2.4.6-6b2ece4" → 246 (matches gradle versionCode scheme). */
function uaVersionToCode(uaVersion: string): number | null {
  const m = uaVersion.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  const code = Number(m[1]) * 100 + Number(m[2]) * 10 + Number(m[3])
  return Number.isFinite(code) ? code : null
}

/** Extract the shell's own versionName from the WebView UA. */
function nativeVersionCodeFromUa(): number | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  const m = ua.match(/ZylodAndroidNative\/([\d.]+[-\w.]*)/)
  if (!m) return null
  return uaVersionToCode(m[1])
}

function formatSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export function MandatoryUpdateGate({ children }: { children: React.ReactNode }) {
  // Non-native (plain browser): gate is fully inert, children render directly.
  const [native] = useState(() => isNativeHost())
  const [blocked, setBlocked] = useState(false)
  const [latest, setLatest] = useState<LatestVersion | null>(null)

  useEffect(() => {
    if (!native) return
    let cancelled = false

    const check = async () => {
      try {
        const code = nativeVersionCodeFromUa()
        const url =
          '/api/app/version?platform=android' +
          (code != null ? `&currentVersionCode=${code}` : '')
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) return
        const body = await res.json().catch(() => null)
        if (cancelled || !body?.success) return
        const d = body.data
        if (d?.updateAvailable && d?.isMandatory) {
          setLatest(d.latestVersion ?? null)
          setBlocked(true)
        }
      } catch {
        /* Offline/unreachable: never brick the app on a network hiccup —
           the shell's own offline layer handles connectivity. Re-check on
           the next mount; the floor remains server-side authoritative. */
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [native])

  if (!native || !blocked) {
    return <>{children}</>
  }

  const size = formatSize(latest?.apkSizeBytes)

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <AlertTriangle className="h-8 w-8 text-primary" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Update required</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This version of Zylod is no longer supported. Install{' '}
            <span className="font-semibold text-foreground">
              {latest?.versionNumber ?? 'the latest version'}
            </span>{' '}
            to keep ordering — it fixes the back button, offline catalogue and
            checkout security.
          </p>
        </div>

        {latest?.changelogEn && (
          <div className="rounded-xl border border-border bg-card p-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              What&apos;s new
            </p>
            <p className="text-xs text-card-foreground leading-relaxed line-clamp-8">
              {latest.changelogEn}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <a
            href={latest?.apkDownloadUrl || '/downloads/zylod-latest.apk'}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-[0.98] transition-transform"
            download
          >
            <Download className="h-4 w-4" aria-hidden />
            Download {latest?.versionNumber ?? 'update'}
            {size ? <span className="font-normal opacity-80">({size})</span> : null}
          </a>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground active:scale-[0.98] transition-transform"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Re-check after installing
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Your session, cart and saved data are safe — they live on the server
          and return automatically after the update.
        </p>
      </div>
    </div>
  )
}
