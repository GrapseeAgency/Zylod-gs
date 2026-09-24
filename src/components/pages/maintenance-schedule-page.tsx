'use client'

import React from 'react'
import { Calendar, ArrowLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function MaintenanceSchedulePage() {
  const { navigate } = useNavigationStore()

  const schedules = [
    { title: 'Core PostgreSQL Database Vacuum & Indexing', start: 'Sunday, 02:00 AM BST', duration: '2 hours', impact: 'Zero downtime (Read replica failover)', status: 'Scheduled' },
    { title: 'Logistics Courier Webhook API Gateway Patch', start: 'June 28, 2026', duration: '30 mins', impact: 'Completed with zero downtime', status: 'Completed' },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('maintenance-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Maintenance Status
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Maintenance Calendar & Window Log</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Historical log of past and planned maintenance events</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {schedules.map((s) => (
          <Card key={s.title} className="rounded-2xl border shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-sm text-foreground">{s.title}</span>
                <Badge className={`${s.status === 'Completed' ? 'bg-muted text-muted-foreground text-[10px]' : 'bg-amber-600 text-white text-[10px]'} shrink-0`}>
                  {s.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono"><Clock className="h-3 w-3" /> {s.start}</span>
                <span>•</span>
                <span>Duration: {s.duration}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.impact}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default MaintenanceSchedulePage
