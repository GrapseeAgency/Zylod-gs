'use client'

import React, { useState, useEffect } from 'react'
import {
  HardDrive,
  Trash2,
  PieChart,
  Database,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  FolderArchive
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'

export function StorageManagementPage() {
  const { navigate } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [clearedSuccess, setClearedSuccess] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  const fetchStats = () => {
    setLoading(true)
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    fetch('/api/app/storage-stats', { headers })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return null
        }
        if (!res.ok) throw new Error('Request failed')
        return res.json()
      })
      .then(json => {
        if (json && json.data) setData(json.data)
        else if (json && !json.data) setLoadError('Could not load storage stats. Please try again later.')
      })
      .catch(() => setLoadError('Could not load storage stats. Please try again later.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStats()
  }, [isAuthenticated])

  const handleClearCache = async (category = 'all') => {
    if (!confirm(`Are you sure you want to clear ${category === 'all' ? 'all cached data' : category}? Offline items will re-download when needed.`)) return
    setClearing(true)
    setActionError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/app/storage-stats', {
        method: 'POST',
        headers,
        body: JSON.stringify({ cacheCategory: category }),
      })
      if (!res.ok) {
        setActionError('Could not record the cache clear on the server. Please try again.')
        return
      }
      if (typeof window !== 'undefined' && (window as any).ZylodNativeBridge?.clearLocalAppCache) {
        (window as any).ZylodNativeBridge.clearLocalAppCache()
      }
      setClearedSuccess(true)
      fetchStats()
      setTimeout(() => setClearedSuccess(false), 3000)
    } catch {
      setActionError('Could not record the cache clear on the server. Please try again.')
    } finally {
      setClearing(false)
    }
  }

  if (sessionExpired) return <AccountGate title="Session expired" message="Your session has expired. Sign in again to manage storage." />
  if (!loading && !isAuthenticated) return <AccountGate title="Sign in to manage storage" message="Storage management tracks the caches tied to your account. Sign in to continue." />

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 dark:bg-primary/10/50 flex items-center justify-center text-primary">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">Storage Management</h1>
              <p className="text-sm text-muted-foreground">Monitor local device allocations, offline catalogues, and free up space</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} className="text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={clearing}
            onClick={() => handleClearCache('all')}
            className="text-xs font-bold gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {clearing ? 'Clearing...' : 'Clear All Cache'}
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-700 dark:text-red-300 text-sm font-semibold">
          {actionError}
        </div>
      )}

      {loadError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-700 dark:text-red-300 text-sm font-semibold">
          {loadError}
        </div>
      )}

      {clearedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          Successfully purged local storage caches. Free space reclaimed!
        </div>
      )}

      {/* Overview Storage Bar */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Allocated Device Storage
            </CardTitle>
            <span className="text-xs font-bold text-muted-foreground">
              {data ? `${data.totalAllocatedMB} MB of ${data.maxQuotaMB} MB Used` : loading ? 'Calculating…' : '—'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={Number(data?.usagePercentage ?? 0)} className="h-3 rounded-full" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            {data?.breakdown?.map((b: any) => (
              <div key={b.category} className="p-3 bg-muted/30 rounded-xl border space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="truncate">{b.category}</span>
                </div>
                <div className="text-muted-foreground text-xs font-mono">{b.sizeMB} MB</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Itemized Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Factory Media & Image Thumbnails
            </CardTitle>
            <CardDescription className="text-xs">Compressed WebP & AVIF product previews</CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-lg font-black text-foreground">
                {data ? `${data.breakdown?.find((b: any) => b.category === 'Product Media & Swatches')?.sizeMB ?? '0.0'} MB` : '—'}
              </div>
              <p className="text-xs text-muted-foreground">Product images & thumbnails cached locally</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClearCache('images')}
              className="text-xs font-bold text-destructive hover:bg-destructive/10"
            >
              Purge Images
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-emerald-600" />
              Offline Wholesale Catalogue
            </CardTitle>
            <CardDescription className="text-xs">Product specs, mill contacts, & offline database</CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-lg font-black text-foreground">
                {data ? `${data.breakdown?.find((b: any) => b.category === 'Offline Wholesale Catalogue')?.sizeMB ?? '0.0'} MB` : '—'}
              </div>
              <p className="text-xs text-muted-foreground">Offline product dataset cached locally</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('offline-data-manager')}
              className="text-xs font-bold"
            >
              Manage Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick links to sub-tools */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('storage-breakdown')} className="text-xs font-semibold">
          Detailed Storage Breakdown
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('clear-storage')} className="text-xs font-semibold">
          Advanced Clear Data Wizard
        </Button>
      </div>
    </div>
  )
}
export default StorageManagementPage
