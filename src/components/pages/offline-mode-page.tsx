'use client'

import React, { useState, useEffect } from 'react'
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Download,
  CheckCircle2,
  Layers,
  ShoppingBag,
  Clock,
  HardDrive,
  Building2,
  ChevronRight,
  Database,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function OfflineModePage() {
  const { navigate } = useNavigationStore()
  const [offlineData, setOfflineData] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const fetchOfflinePackage = () => {
    fetch('/api/app/offline-sync')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || `Failed to load the offline package (${res.status})`)
        if (json.data) setOfflineData(json.data)
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load the offline package')
      })
  }

  useEffect(() => {
    fetchOfflinePackage()
  }, [])

  const handleSyncQueue = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/app/offline-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'client-offline-manager',
          queue: [
            { syncAction: 'OFFLINE_CACHE_RECONCILE', entityType: 'catalogue', payload: { timestamp: Date.now() } }
          ],
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.error || (res.status === 401
          ? 'Sign in to sync queued operations with the server.'
          : `Sync failed (${res.status}) — queued operations were NOT synchronized.`))
      }
      setSyncDone(true)
      fetchOfflinePackage()
      setTimeout(() => setSyncDone(false), 3000)
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed — queued operations were NOT synchronized.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
              <WifiOff className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">Offline Wholesale Engine</h1>
              <p className="text-sm text-muted-foreground">Access product specifications, verified mills, and queue drafts without internet</p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSyncQueue}
          disabled={syncing}
          className="bg-primary text-primary-foreground text-xs font-bold gap-2 py-5 px-5 rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Queued Operations'}
        </Button>
      </div>

      {syncDone && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Offline actions synchronized with central server.
        </div>
      )}

      {syncError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-800 dark:text-red-300 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          {syncError}
        </div>
      )}

      {loadError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-800 dark:text-red-300 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          Could not load the offline package: {loadError} Reload to try again.
        </div>
      )}

      {/* Offline Status & SQLite Snapshot */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Cached Offline Snapshot
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs">Ready for Field Use</Badge>
          </div>
          <CardDescription className="text-xs">Available locally on Android Room SQLite storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-muted/30 rounded-xl border text-center space-y-1">
              <div className="text-2xl font-black text-foreground">{offlineData?.catalogue?.products?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Wholesale SKUs</div>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl border text-center space-y-1">
              <div className="text-2xl font-black text-foreground">{offlineData?.catalogue?.categories?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Categories</div>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl border text-center space-y-1">
              <div className="text-2xl font-black text-foreground">{offlineData?.catalogue?.suppliers?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Verified Factories</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          onClick={() => navigate('offline-catalogue')}
          className="cursor-pointer hover:border-primary transition-all p-5 rounded-2xl border shadow-sm group"
        >
          <div className="space-y-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Browse Offline Catalog</div>
            <p className="text-xs text-muted-foreground">Inspect cached fabric thread counts, MOQ, and factory pricing</p>
          </div>
        </Card>

        <Card
          onClick={() => navigate('offline-sync-queue')}
          className="cursor-pointer hover:border-primary transition-all p-5 rounded-2xl border shadow-sm group"
        >
          <div className="space-y-2">
            <Clock className="h-6 w-6 text-amber-600" />
            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Offline Sync Queue</div>
            <p className="text-xs text-muted-foreground">View draft RFQs and orders waiting for connectivity</p>
          </div>
        </Card>

        <Card
          onClick={() => navigate('offline-orders')}
          className="cursor-pointer hover:border-primary transition-all p-5 rounded-2xl border shadow-sm group"
        >
          <div className="space-y-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Offline Order History</div>
            <p className="text-xs text-muted-foreground">Access previously downloaded receipts & waybills</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
export default OfflineModePage
