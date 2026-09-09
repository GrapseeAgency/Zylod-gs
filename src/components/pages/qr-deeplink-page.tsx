'use client'

import React, { useState } from 'react'
import { QrCode, ArrowLeft, Download, Printer, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigationStore } from '@/store/navigation-store'

export function QrDeeplinkPage() {
  const { navigate } = useNavigationStore()
  const [targetUrl, setTargetUrl] = useState('https://zylod.com/dl/product/clx8919')

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('deep-link-handler')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Deep Link Engine
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Printable QR Code Generator</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Generate high-density SVG/PNG QR barcodes for factory catalog banners and trade booths</p>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR Barcode Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold">Deep Link Destination</Label>
            <Input
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <div className="flex flex-col items-center justify-center p-8 bg-muted/20 border-2 border-dashed rounded-2xl space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-md">
              {/* High-contrast QR representation */}
              <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
                <rect width="180" height="180" fill="white" />
                <rect x="15" y="15" width="45" height="45" fill="#0F172A" rx="4" />
                <rect x="25" y="25" width="25" height="25" fill="white" rx="2" />
                <rect x="30" y="30" width="15" height="15" fill="#0F172A" rx="1" />

                <rect x="120" y="15" width="45" height="45" fill="#0F172A" rx="4" />
                <rect x="130" y="25" width="25" height="25" fill="white" rx="2" />
                <rect x="135" y="30" width="15" height="15" fill="#0F172A" rx="1" />

                <rect x="15" y="120" width="45" height="45" fill="#0F172A" rx="4" />
                <rect x="25" y="130" width="25" height="25" fill="white" rx="2" />
                <rect x="30" y="135" width="15" height="15" fill="#0F172A" rx="1" />

                <circle cx="90" cy="90" r="14" fill="#E11D48" />
                <rect x="70" y="20" width="15" height="15" fill="#0F172A" />
                <rect x="95" y="30" width="15" height="15" fill="#0F172A" />
                <rect x="70" y="120" width="20" height="20" fill="#0F172A" />
                <rect x="100" y="130" width="25" height="25" fill="#0F172A" />
                <rect x="140" y="80" width="20" height="20" fill="#0F172A" />
              </svg>
            </div>
            <span className="text-xs font-mono text-muted-foreground">{targetUrl}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => alert('Printing high-resolution 300 DPI QR code vector...')}
              className="w-full bg-primary text-primary-foreground text-xs font-bold py-5 rounded-xl gap-2 shadow-sm"
            >
              <Printer className="h-4 w-4" /> Print Trade Show QR Poster
            </Button>
            <Button
              variant="outline"
              onClick={() => alert('Downloading SVG vector for packaging print...')}
              className="w-full sm:w-auto text-xs font-bold py-5 rounded-xl gap-2"
            >
              <Download className="h-4 w-4" /> Download SVG
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default QrDeeplinkPage
