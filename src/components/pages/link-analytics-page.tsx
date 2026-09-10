'use client'

import React from 'react'
import { BarChart2, ArrowLeft, TrendingUp, Smartphone, Globe, MousePointerClick } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function LinkAnalyticsPage() {
  const { navigate } = useNavigationStore()

  const campaigns = [
    { name: 'Dhaka RMG Expo 2026', clicks: '4,280', conversions: '312 orders', scheme: 'zylod://product/clx8919', ctr: '7.3%' },
    { name: 'Chittagong Textile Trade Fair', clicks: '2,950', conversions: '184 orders', scheme: 'zylod://supplier/sup201', ctr: '6.2%' },
    { name: 'SafePay Escrow Launch Promo', clicks: '8,120', conversions: '640 signups', scheme: 'zylod://deals/exclusive', ctr: '7.9%' },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('deep-link-handler')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Deep Link Engine
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Deep Link Click Telemetry & Attribution</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Real-time attribution tracking across Android App Links and SMS/Email campaigns</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border p-4 text-center space-y-1">
          <div className="text-xs text-muted-foreground">Total Inbound Deep Clicks</div>
          <div className="text-2xl font-black text-foreground font-mono">15,350</div>
        </Card>
        <Card className="rounded-2xl border p-4 text-center space-y-1">
          <div className="text-xs text-muted-foreground">App Open Rate</div>
          <div className="text-2xl font-black text-emerald-600 font-mono">82.4%</div>
        </Card>
        <Card className="rounded-2xl border p-4 text-center space-y-1">
          <div className="text-xs text-muted-foreground">Escrow Conversions</div>
          <div className="text-2xl font-black text-primary font-mono">1,136</div>
        </Card>
      </div>

      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.name} className="rounded-2xl border shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-bold text-sm text-foreground">{c.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{c.scheme}</div>
                <div className="text-xs text-emerald-600 font-bold">Conversion Rate: {c.ctr} ({c.conversions})</div>
              </div>
              <Badge variant="outline" className="text-sm font-mono font-bold px-3 py-1">
                {c.clicks} clicks
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default LinkAnalyticsPage
