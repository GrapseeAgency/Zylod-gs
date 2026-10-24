'use client'

/**
 * MAINTENANCE SCHEDULE — Task 176-c. The previous page shipped HARDCODED
 * maintenance rows ("Core PostgreSQL Database Vacuum & Indexing",
 * "Logistics Courier Webhook API Gateway Patch") with invented start times,
 * durations and impact statements — none of those windows existed in any
 * table. This rewrite wires the page to the REAL public
 * /api/app/maintenance rail (returns activeSchedule + upcomingSchedule from
 * the maintenanceSchedules table), with an honest empty state when no
 * windows are scheduled.
 *
 * The historical log of past windows is admin-only (GET /api/admin/maintenance),
 * so non-admin viewers see the active + upcoming windows plus an honest note
 * about where the full archive lives.
 */
import React, { useEffect, useState } from 'react'
import { Calendar, ArrowLeft, Clock, AlertCircle, Loader2, ServerCog } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

interface Schedule {
  title: string
  messageEn?: string | null
  scheduledStart: string
  scheduledEnd: string
  affectedServices?: string | null
}

export function MaintenanceSchedulePage() {
  const { navigate } = useNavigationStore()
  const [active, setActive] = useState<Schedule | null>(null)
  const [upcoming, setUpcoming] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/app/maintenance')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!mounted) return
        if (!res.ok || !json?.success) {
          setError(json?.error || `Failed to load maintenance status (${res.status}).`)
          return
        }
        const d = json.data || {}
        if (d.activeSchedule) setActive(d.activeSchedule)
        if (d.upcomingSchedule) setUpcoming(d.upcomingSchedule)
      })
      .catch(() => {
        if (mounted) setError('Could not reach the maintenance service. Try again shortly.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl lg:max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('maintenance-mode')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Maintenance Status
      </Button>

      <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-black text-foreground">Maintenance Calendar &amp; Window Log</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Active and upcoming windows — read live from the maintenanceSchedules table
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 flex items-start gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="font-bold text-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : !active && !upcoming ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <Calendar className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-bold text-foreground">No maintenance windows scheduled</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              There are no active or upcoming maintenance windows right now. The full historical log is
              admin-only — when a window is scheduled, it will appear here in real time, and the platform-wide
              banner is shown on the maintenance status page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {active && (
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-sm text-foreground">{active.title}</span>
                  <Badge className="bg-amber-600 text-white text-[10px] shrink-0">Active</Badge>
                </div>
                {active.affectedServices && active.affectedServices !== 'all' && (
                  <p className="text-xs text-muted-foreground">Affects: {active.affectedServices}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" /> {fmt(active.scheduledStart)}
                  </span>
                  <span>→</span>
                  <span className="font-mono">{fmt(active.scheduledEnd)}</span>
                </div>
                {active.messageEn && (
                  <p className="text-xs text-muted-foreground pt-1 border-t border-gray-100 dark:border-gray-800">
                    {active.messageEn}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {upcoming && (
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-sm text-foreground">{upcoming.title}</span>
                  <Badge className="bg-muted text-muted-foreground text-[10px] shrink-0">Upcoming</Badge>
                </div>
                {upcoming.affectedServices && upcoming.affectedServices !== 'all' && (
                  <p className="text-xs text-muted-foreground">Affects: {upcoming.affectedServices}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" /> {fmt(upcoming.scheduledStart)}
                  </span>
                  <span>→</span>
                  <span className="font-mono">{fmt(upcoming.scheduledEnd)}</span>
                </div>
                {upcoming.messageEn && (
                  <p className="text-xs text-muted-foreground pt-1 border-t border-gray-100 dark:border-gray-800">
                    {upcoming.messageEn}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-4 flex items-start gap-3 text-xs text-muted-foreground">
          <ServerCog className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            The full historical archive of past windows is admin-only. Admins can read every window that has ever
            been scheduled via the admin maintenance console.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
export default MaintenanceSchedulePage
