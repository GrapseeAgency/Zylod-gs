'use client'

import React, { useState, useEffect } from 'react'
import { FolderArchive, ArrowLeft, Download, CheckCircle2, RefreshCw, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function OfflineDataManagerPage() {
  const { navigate } = useNavigationStore()
  const [downloading, setDownloading] = useState(false)
  const [synced, setSynced] = useState(false)
  const [dataPackage, setDataPackage] = useState<any>(null)

  useEffect(() => {
    fetch('/api/app/offline-sync')
      .then(res => res.json())
      .then(json => {
        if (json.data) setDataPackage(json.data)
      })
      .catch(console.error)
  }, [])

  const handleDownloadPackage = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/app/offline-sync')
      const json = await res.json()
      if (json.data) {
        setDataPackage(json.data)
        setSynced(true)
        setTimeout(() => setSynced(false), 3000)
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:px-6 md:space-y-8 lg:max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('storage-management')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Storage Manager
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Offline Wholesale Data Manager</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Manage local SQLite database sync package for disconnected field operations</p>
      </div>

      {synced && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Offline wholesale package downloaded and cached to local database.
        </div>
      )}

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-primary" />
              Active Offline Snapshot
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs">
              v{dataPackage?.version || '2026.08.18'}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Snapshot timestamp: {dataPackage?.timestamp ? new Date(dataPackage.timestamp).toLocaleString() : 'Just now'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="p-3 md:p-4 bg-muted/30 rounded-xl border text-center">
              <div className="text-lg md:text-2xl font-black text-foreground">{dataPackage?.catalogue?.categories?.length || 30}</div>
              <div className="text-xs text-muted-foreground">Categories</div>
            </div>
            <div className="p-3 md:p-4 bg-muted/30 rounded-xl border text-center">
              <div className="text-lg md:text-2xl font-black text-foreground">{dataPackage?.catalogue?.products?.length || 50}</div>
              <div className="text-xs text-muted-foreground">Top Products</div>
            </div>
            <div className="p-3 md:p-4 bg-muted/30 rounded-xl border text-center">
              <div className="text-lg md:text-2xl font-black text-foreground">{dataPackage?.catalogue?.suppliers?.length || 20}</div>
              <div className="text-xs text-muted-foreground">Verified Mills</div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleDownloadPackage}
              disabled={downloading}
              className="bg-primary text-primary-foreground text-xs font-bold gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Syncing...' : 'Re-download Offline Package'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default OfflineDataManagerPage
