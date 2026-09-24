'use client'

import React from 'react'
import { FileCode2, ArrowLeft, CheckCircle2, Sparkles, ShieldCheck, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function UpdateChangelogPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-update')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Updates
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Official Release Notes — v2.4.0</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Comprehensive changelog, security patches, and engine improvements</p>
      </div>

      <div className="space-y-4">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Key Highlights
              </CardTitle>
              <Badge className="bg-primary text-white text-xs">Major Release</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div className="p-3 bg-muted/30 rounded-xl border space-y-1">
              <div className="font-bold text-foreground">🎥 Live Factory Shopping Engine</div>
              <p>Hardware-accelerated live video stream player for factory mill tours with live bidding and sample requests.</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-xl border space-y-1">
              <div className="font-bold text-foreground flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Offline Wholesale Catalogue</div>
              <p>Download complete local SQLite snapshot of verified suppliers and product specs for off-grid operations.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export default UpdateChangelogPage
