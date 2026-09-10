'use client'

import React from 'react'
import { History, ArrowLeft, Download, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function VersionHistoryPage() {
  const { navigate } = useNavigationStore()

  const versions = [
    { version: 'v2.4.0', code: 240, date: 'August 2026', tag: 'Latest', notes: 'Native Live Factory streaming, SafePay Biometrics, Offline Room sync.' },
    { version: 'v2.3.1', code: 231, date: 'July 2026', tag: 'Stable', notes: 'Bluetooth barcode scanner integration & bKash webhook optimization.' },
    { version: 'v2.2.0', code: 220, date: 'June 2026', tag: 'Legacy', notes: 'Customs & Port clearance tracking, Mushak 6.3 VAT tax invoices.' },
    { version: 'v2.1.0', code: 210, date: 'May 2026', tag: 'Legacy', notes: 'Wholesale RFQ bidding engine & SafePay multi-tier escrow launch.' },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-update')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Updates
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Version History & Release Archive</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Historical Android APK releases, maintenance rollouts, and changelog snapshots</p>
      </div>

      <div className="space-y-3">
        {versions.map((v) => (
          <Card key={v.version} className="rounded-2xl border shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-base text-foreground">{v.version}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">Build {v.code}</Badge>
                  <span className="text-xs text-muted-foreground">• {v.date}</span>
                </div>
                <p className="text-xs text-muted-foreground">{v.notes}</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('apk-download')}
                className="text-xs font-bold gap-1 shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> APK
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default VersionHistoryPage
