'use client'

import React, { useState, useEffect } from 'react'
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Activity,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function MaintenanceModePage() {
  const { navigate } = useNavigationStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/app/maintenance')
      .then(res => res.json())
      .then(json => {
        if (json.data) setData(json.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">Platform Maintenance & Status</h1>
              <p className="text-sm text-muted-foreground">Scheduled platform downtime, database migrations, and operational health</p>
            </div>
          </div>
        </div>

        <Badge
          className={data?.isMaintenanceActive ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}
        >
          {data?.isMaintenanceActive ? 'Maintenance Mode In Effect' : 'All Core Systems Operational'}
        </Badge>
      </div>

      {/* Main Status Hero */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Scheduled Maintenance Window
          </CardTitle>
          <CardDescription className="text-xs">Routine platform health updates and database index optimizations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.upcomingSchedule ? (
            <div className="p-4 bg-muted/30 rounded-xl border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">{data.upcomingSchedule.title}</span>
                <Badge variant="outline" className="text-xs font-mono">Upcoming</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.upcomingSchedule.messageEn}</p>
              <div className="flex items-center gap-2 pt-2 text-xs font-mono text-primary">
                <Clock className="h-3.5 w-3.5" />
                {new Date(data.upcomingSchedule.scheduledStart).toUTCString()} — {new Date(data.upcomingSchedule.scheduledEnd).toUTCString()}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              No disruptive maintenance scheduled for the next 7 days.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-tools */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('maintenance-schedule')} className="text-xs font-semibold">
          Maintenance Calendar & History
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('service-status')} className="text-xs font-semibold">
          Live Subsystem Status & SLA (99.98%)
        </Button>
      </div>
    </div>
  )
}
export default MaintenanceModePage
