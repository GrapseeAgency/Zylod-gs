'use client'

/**
 * Storage Breakdown (Task 175-c) — honest empty state + real web storage.
 *
 * The previous page fabricated Android sandbox storage figures ("Room SQLite
 * 3.4 MB", "Glide & Coil Image WebP Cache 45.0 MB", "PDF Invoice Downloads
 * 1.8 MB", "Font Assets 2.2 MB"). The web client CANNOT know Android sandbox
 * storage — those numbers were invented.
 *
 * Rebuilt as an honest empty state: "Storage breakdown is native to the
 * Android app — the web client uses browser storage instead." The page also
 * surfaces the REAL localStorage usage bytes (the useLocalStorageUsageBytes
 * hook from t167) so the web user sees an honest number derived from the
 * actual bytes their browser is storing for this domain — not a fabricated
 * "52.4 MB" Android figure.
 */
import { HardDrive, ArrowLeft, Smartphone, Database, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useLocalStorageUsageBytes } from '@/hooks/use-device-prefs'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function StorageBreakdownPage() {
  const { navigate } = useNavigationStore()
  const bytes = useLocalStorageUsageBytes()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:px-6 md:space-y-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('storage-management')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Storage Manager
      </Button>

      <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-black text-foreground">Storage Allocation Details</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Honest view of what this device is storing — no fabricated Android sandbox figures
        </p>
      </div>

      {/* Honest empty state for Android sandbox storage */}
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-background p-6 md:p-8 text-center space-y-3">
        <Smartphone className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-bold text-foreground">
          Storage breakdown is native to the Android app
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          The web client cannot inspect Android sandbox storage — the Room SQLite database, Glide &amp; Coil image
          cache, and PDF invoice downloads live inside the Android app&apos;s private sandbox and are only visible
          there. We do not fabricate Android storage figures on the web. Install the Android app to see its granular
          file-level storage breakdown.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('apk-download')}
          className="mt-2 text-xs font-semibold gap-1.5"
        >
          <Smartphone className="h-3.5 w-3.5" /> Get the Android app
        </Button>
      </div>

      {/* Real web (browser) storage usage */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Web client (browser) storage</h2>
        </div>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="font-bold text-sm text-foreground">localStorage usage</div>
              <p className="text-xs text-muted-foreground">
                Real bytes this domain is storing in your browser&apos;s localStorage (UTF-16)
              </p>
            </div>
            <div className="font-mono text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg shrink-0">
              {formatBytes(bytes)}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Browser storage (localStorage, sessionStorage, IndexedDB, service-worker caches) is per-browser and
            per-device — it is not the same as the Android app&apos;s sandbox storage. The number above is computed
            live from <code className="font-mono">window.localStorage</code> on this device.
          </p>
        </div>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="font-bold text-sm text-foreground">Service worker &amp; HTTP cache</div>
              <p className="text-xs text-muted-foreground">
                Managed by the browser — not directly measurable from JavaScript
              </p>
            </div>
            <div className="font-mono text-xs font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 px-3 py-1 rounded-lg shrink-0">
              N/A
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="font-bold text-sm text-foreground">IndexedDB</div>
              <p className="text-xs text-muted-foreground">
                Used by some pages for offline-capable caches — per-origin, browser-managed
              </p>
            </div>
            <div className="font-mono text-xs font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 px-3 py-1 rounded-lg shrink-0">
              N/A
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <HardDrive className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
          The Android app exposes a full file-level storage breakdown (Room SQLite tables, image cache size, downloaded
          PDF invoices) inside its own Storage Manager screen. The web client does not have access to that data.
        </p>
      </div>
    </div>
  )
}
export default StorageBreakdownPage
