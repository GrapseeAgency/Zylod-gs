'use client'

import React from 'react'
import { Activity, ArrowLeft, BarChart2, CheckCircle2, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'

export function CacheStatsPage() {
  const { navigate } = useNavigationStore()

  const stats = [
    { label: 'Edge CDN Cache Hit Ratio', value: '94.2%', desc: 'Cloudflare / Fastly static asset hits' },
    { label: 'Client In-Memory Hit Ratio', value: '88.6%', desc: 'Instant navigation between category & products' },
    { label: 'Average Payload Latency Saved', value: '280 ms', desc: 'Saved roundtrips per page transition' },
    { label: 'Bandwidth Saved this Month', value: '1.42 GB', desc: 'Through local WebP image caching' },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('cache-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Cache Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Cache Telemetry & Hit Ratios</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Real-time cache performance metrics from client and edge nodes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl border shadow-sm">
            <CardContent className="p-5 space-y-1">
              <div className="text-xs font-bold text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{s.value}</div>
              <p className="text-xs text-muted-foreground pt-1">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default CacheStatsPage
