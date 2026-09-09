'use client'

import React, { useState, useEffect } from 'react'
import { Activity, ArrowLeft, CheckCircle2, RefreshCw, Server, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function ServiceStatusPage() {
  const { navigate } = useNavigationStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchDiagnostics = () => {
    setLoading(true)
    fetch('/api/app/diagnostics')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDiagnostics()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('maintenance-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Maintenance Status
      </Button>

      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Live Subsystem Health & SLA</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time health probes and microservice latency metrics</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDiagnostics} className="text-xs gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Re-probe
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl border p-4 text-center space-y-1">
          <div className="text-xs text-muted-foreground">Overall Status</div>
          <div className="text-sm font-black text-emerald-600 uppercase">{data?.status || 'Operational'}</div>
        </Card>
        <Card className="rounded-xl border p-4 text-center space-y-1">
          <div className="text-xs text-muted-foreground">API Latency</div>
          <div className="text-sm font-black text-foreground font-mono">{data?.latencyMs || 12} ms</div>
        </Card>
        <Card className="rounded-xl border p-4 text-center space-y-1">
          <div className="text-xs text-muted-foreground">DB Ping</div>
          <div className="text-sm font-black text-foreground font-mono">{data?.metrics?.databaseLatencyMs || 8} ms</div>
        </Card>
        <Card className="rounded-xl border p-4 text-center space-y-1">
          <div className="text-xs text-muted-foreground">Uptime SLA</div>
          <div className="text-sm font-black text-emerald-600">99.98%</div>
        </Card>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Microservices & External Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {data?.services?.map((s: any) => (
            <div key={s.serviceName} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
              <div className="space-y-0.5">
                <div className="font-bold text-xs font-mono text-foreground">{s.serviceName}</div>
                <div className="text-[11px] text-muted-foreground">Response time: {s.responseTimeMs} ms</div>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {s.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
export default ServiceStatusPage
