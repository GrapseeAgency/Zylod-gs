'use client'

import { useEffect, useState } from 'react'

/**
 * BuildBadge (t229h) — the exact build identity of the running bundle:
 * "web <commit>" from the head-injected __ZylodBundleIdentity plus
 * "app <versionName>" from the Android ZylodNativeBridge.
 *
 * Rendered by BOTH the desktop Footer AND the mobile MobileSiteLinks —
 * t229g shipped it desktop-only, but the mobile layout renders
 * MobileSiteLinks instead of <Footer>, so the Android WebView (mobile-width)
 * never showed it and on-device build identification was impossible — the
 * exact stale-APK confusion the badge exists to kill. Inert when no identity
 * is present: nothing is fabricated.
 */
export function BuildBadge({ className = '' }: { className?: string }) {
  const [buildInfo, setBuildInfo] = useState<string | null>(null)
  useEffect(() => {
    try {
      const w = window as unknown as {
        __ZylodBundleIdentity?: { shortCommit?: string }
        ZylodNativeBridge?: { getAppVersionName?: () => string }
      }
      const parts: string[] = []
      const webCommit = w.__ZylodBundleIdentity?.shortCommit
      if (webCommit) parts.push(`web ${webCommit}`)
      const appVersion = w.ZylodNativeBridge?.getAppVersionName?.()
      if (appVersion) parts.push(`app ${appVersion}`)
      setBuildInfo(parts.length > 0 ? parts.join(' · ') : null)
    } catch {
      setBuildInfo(null)
    }
  }, [])
  if (!buildInfo) return null
  return (
    <span
      className={`text-[10px] leading-none text-muted-foreground/50 tabular-nums select-none ${className}`}
      title={`Zylod build identity — ${buildInfo}`}
    >
      · Build {buildInfo}
    </span>
  )
}
