'use client'

import React from 'react'
import { ArrowLeft, RefreshCw, CheckCircle2, CloudOff, Smartphone, Wifi } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useDevicePrefs } from '@/hooks/use-device-prefs'

/**
 * HONEST offline-sync status — replaces the fabricated queue ("Product
 * #clx8919 (Cotton Jersey Fabric)", "Supplier #sup201 (Ananta Garments
 * MOQ 500)", invented "10 mins ago" timestamps) and the fake
 * "Reconcile Queue" setTimeout theater.
 *
 * The web app is an ALWAYS-ONLINE client: every mutation is a live fetch,
 * so a web device has nothing to queue — an always-populated queue was a
 * lie. The REAL offline queue lives in the Android app (native queue +
 * its own sync worker). This page now tells that truth:
 *   - live online/offline state from the browser (navigator.onLine + events)
 *   - the real device auto-sync preference (useDevicePrefs — the same key
 *     the App Settings hub toggle writes; this page is its consumer)
 *   - an honest always-empty queue on web, clearly explained
 */
export function OfflineSyncQueuePage() {
  const { navigate } = useNavigationStore()
  const { prefs } = useDevicePrefs()
  const [online, setOnline] = React.useState(true)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    setOnline(navigator.onLine)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:px-6 md:space-y-8 lg:max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('offline-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Offline Engine
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Offline Mutation Sync Queue</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Actions performed while disconnected, waiting for network reconnection
        </p>
      </div>

      {/* Live connectivity */}
      <div
        className={
          'flex items-start gap-3 rounded-xl border p-3 ' +
          (online
            ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30')
        }
      >
        {online
          ? <Wifi className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          : <CloudOff className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <p className={'text-xs font-bold ' + (online ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
            {online ? 'Online — all changes sync in real time' : 'Offline — browsing with cached data'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            The web app performs every save, order, and RFQ as a live request the moment you act —
            there is no offline mutation queue on the web client.
          </p>
        </div>
      </div>

      {/* Honest queue state */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-6 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Nothing queued on this device</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The web client has no offline mutation queue — actions execute immediately against the
            server. The Android app maintains its own native offline queue and reconciles it through
            its sync worker when connectivity returns.
          </p>
          <Badge variant="outline" className="text-[10px] font-mono">
            Queue: 0 items (web client, by design)
          </Badge>
        </CardContent>
      </Card>

      {/* Real device sync preference — the consumer of the App Settings toggle */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Background auto-sync preference: {prefs.autoSyncIntervalMins > 0 ? `every ${prefs.autoSyncIntervalMins} minutes` : 'manual only'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set from App &amp; System Settings — stored on this device, never sent to the server.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('app-settings')} className="text-xs font-semibold shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Change
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
export default OfflineSyncQueuePage
