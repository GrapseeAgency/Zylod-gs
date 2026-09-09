'use client'

import React, { useState } from 'react'
import {
  RefreshCw,
  Zap,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Sliders,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Cpu
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function CacheSettingsPage() {
  const { navigate } = useNavigationStore()
  const [swPrecache, setSwPrecache] = useState(true)
  const [memoryCache, setMemoryCache] = useState(true)
  const [cleared, setCleared] = useState(false)

  const handlePurge = () => {
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name))
      })
    }
    if (typeof window !== 'undefined' && (window as any).ZylodNativeBridge?.clearLocalAppCache) {
      (window as any).ZylodNativeBridge.clearLocalAppCache()
    }
    setCleared(true)
    setTimeout(() => setCleared(false), 3000)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">Cache Settings & Strategy</h1>
              <p className="text-sm text-muted-foreground">HTTP caching layers, ServiceWorker pre-caching, and instant page transitions</p>
            </div>
          </div>
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={handlePurge}
          className="text-xs font-bold gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Purge HTTP & In-Memory Cache
        </Button>
      </div>

      {cleared && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          All ServiceWorker & In-Memory runtime caches purged successfully.
        </div>
      )}

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              ServiceWorker Offline Caching
            </CardTitle>
            <CardDescription className="text-xs">Cache-first strategy for static JS, CSS, and fonts</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm">Background Asset Pre-caching</div>
                <p className="text-xs text-muted-foreground">Preload next likely wholesale pages in background</p>
              </div>
              <Switch checked={swPrecache} onCheckedChange={setSwPrecache} />
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm">Client In-Memory Query Cache</div>
                <p className="text-xs text-muted-foreground">5-minute stale-while-revalidate for product lists</p>
              </div>
              <Switch checked={memoryCache} onCheckedChange={setMemoryCache} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              Image Cache Optimization
            </CardTitle>
            <CardDescription className="text-xs">WebP compression and LRU eviction policy</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">LRU (Least Recently Used) Eviction</div>
                <p className="text-xs text-muted-foreground">Automatically purge oldest product images when cap reaches 200MB</p>
              </div>
              <Badge variant="outline" className="text-xs">Active</Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('image-cache')}
              className="w-full text-xs font-semibold mt-2"
            >
              Configure Image Cache Parameters
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('cache-stats')} className="text-xs font-semibold">
          View Cache Hit Ratios & Metrics
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('purge-cache')} className="text-xs font-semibold">
          Targeted Cache Invalidation
        </Button>
      </div>
    </div>
  )
}
export default CacheSettingsPage
