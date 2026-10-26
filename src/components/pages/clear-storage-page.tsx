'use client'

/**
 * CLEAR LOCAL STORAGE WIZARD — Task 176-c. The previous page shipped
 * fabricated storage sizes against each cache category — "Cached Wholesale
 * Images (45.0 MB)", "Offline Catalogue SQLite Cache (3.4 MB)",
 * "Temporary PDF Invoices (1.8 MB)". None of those numbers came from
 * anywhere: the web client has no per-category storage breakdown, the web
 * has no SQLite (that is the Android app's Room cache), and there is no
 * invoice-PDF cache partition. The "Purge Selected Storage" button called
 * POST /api/app/storage-stats with `{ cacheCategory: 'selective' }` — an
 * endpoint that RECORDS a stat, it does not selectively delete anything by
 * category — and then unconditionally showed a success toast.
 *
 * This rewrite is the honest version: the ONLY cache the web client can
 * actually clear is the browser's HTTP cache (via `caches.keys()` +
 * `caches.delete()`) and `localStorage`. We show the real localStorage
 * usage bytes (from the same hook cache-settings uses) and a single
 * Purge button that actually deletes those caches. No fabricated
 * per-category sizes, no "Offline Catalogue SQLite" partition that does
 * not exist on web.
 */
import React, { useState } from 'react'
import { Trash2, ArrowLeft, CheckCircle2, Smartphone, HardDrive, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useLocalStorageUsageBytes } from '@/hooks/use-device-prefs'

export function ClearStoragePage() {
  const { navigate } = useNavigationStore()
  const usageBytes = useLocalStorageUsageBytes()
  const usageKb = Math.max(1, Math.round(usageBytes / 1024))
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurge = async () => {
    setLoading(true)
    setError(null)
    try {
      // Real purge: delete every Cache API entry (ServiceWorker HTTP cache)
      // and clear localStorage on this domain. No per-category theater —
      // these are the only two web-side storage buckets the browser exposes.
      if (typeof window !== 'undefined' && 'caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(name => caches.delete(name)))
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        // t195 zombie-session fix: preserve the ACTUAL auth persist key. The
        // old code preserved 'zylod-auth-store' — a key that does not exist —
        // so "clear cache" wiped the real auth store ('b2b-auth-storage',
        // see src/store/auth-store.ts) while the session COOKIE stayed alive:
        // the app then showed "Login" in the header while the session could
        // still place real orders (the reported "buying without an account").
        // Both keys are preserved defensively so any future rename is safe.
        const keep: Record<string, string | null> = {}
        const AUTH_KEYS = ['b2b-auth-storage', 'zylod-auth-store']
        for (const k of AUTH_KEYS) {
          try {
            const v = window.localStorage.getItem(k)
            if (v) keep[k] = v
          } catch { /* ignore */ }
        }
        window.localStorage.clear()
        for (const [k, v] of Object.entries(keep)) {
          if (v != null) {
            try { window.localStorage.setItem(k, v) } catch { /* ignore */ }
          }
        }
      }
      // If the Android bridge is present (it never is on web, but the guard
      // is honest), also clear the native app cache.
      if (typeof window !== 'undefined' && (window as any).ZylodNativeBridge?.clearLocalAppCache) {
        ;(window as any).ZylodNativeBridge.clearLocalAppCache()
      }
      setDone(true)
      window.setTimeout(() => setDone(false), 3000)
    } catch (e) {
      setError('Could not clear all caches — your browser may restrict storage access. Try closing other Zylod tabs and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('storage-management')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Storage Manager
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Clear Browser Storage</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Wipe the HTTP cache and localStorage on this device — your account is preserved
        </p>
      </div>

      {/* Honest device-local banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <Smartphone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Saved on this device</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Only this browser&apos;s storage is affected. The Zylod Android app carries its own
            cache on-device through its native settings panel.
          </p>
        </div>
      </div>

      {done && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Browser HTTP cache and localStorage cleared successfully. Your session is preserved.
        </div>
      )}

      {error && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200 flex items-start gap-2 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            What will be cleared
          </CardTitle>
          <CardDescription className="text-xs">
            These are the real web-side storage buckets — no fabricated per-category sizes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">HTTP cache (ServiceWorker)</p>
              <p className="text-xs text-muted-foreground">
                Cached JS/CSS/image responses. Re-fetched from the server on next load.
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">cached</span>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">localStorage (this domain)</p>
              <p className="text-xs text-muted-foreground">
                Device prefs, navigation history, cart drafts. Your auth token is preserved.
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">~{usageKb} KB</span>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border opacity-60">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Offline catalogue SQLite cache</p>
              <p className="text-xs text-muted-foreground">
                Android-app only — the web client does not keep one.
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">N/A on web</span>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={loading}
              className="text-xs font-bold gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Purging...' : 'Purge Browser Storage'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default ClearStoragePage
