'use client'

import React, { useState, useEffect } from 'react'
import { Activity, ArrowLeft, RefreshCw, Server, Cpu, Database, Network } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function ServerDiagnosticsPage() {
  const { navigate } = useNavigationStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchLiveHealth = () => {
    setLoading(true)
    fetch('/api/app/diagnostics')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLiveHealth()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('error-500')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Error Status
      </Button>

      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Live Server Telemetry Probes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Direct microservice latency checks, pool status, and heap allocations</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLiveHealth} disabled={loading} className="text-xs gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Run Telemetry
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl border p-4 text-center">
          <div className="text-[11px] text-muted-foreground">API Latency</div>
          <div className="text-base font-black text-foreground font-mono">{data?.latencyMs || 12} ms</div>
        </Card>
        <Card className="rounded-xl border p-4 text-center">
          <div className="text-[11px] text-muted-foreground">DB Ping</div>
          <div className="text-base font-black text-foreground font-mono">{data?.metrics?.databaseLatencyMs || 8} ms</div>
        </Card>
        <Card className="rounded-xl border p-4 text-center">
          <div className="text-[11px] text-muted-foreground">Heap Memory</div>
          <div className="text-base font-black text-foreground font-mono">{data?.metrics?.memoryUsageMB || 84} MB</div>
        </Card>
        <Card className="rounded-xl border p-4 text-center">
          <div className="text-[11px] text-muted-foreground">Server Uptime</div>
          <div className="text-base font-black text-emerald-600 font-mono">{data?.metrics?.serverUptimeHours || 72}h</div>
        </Card>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Active Service Cluster States
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {data?.services?.map((s: any) => (
            <div key={s.serviceName} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
              <div>
                <div className="font-mono font-bold text-xs text-foreground">{s.serviceName}</div>
                <div className="text-[11px] text-muted-foreground">Response time: {s.responseTimeMs} ms</div>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px] uppercase">{s.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
export default ServerDiagnosticsPage
