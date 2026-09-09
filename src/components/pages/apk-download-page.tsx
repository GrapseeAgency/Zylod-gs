'use client'

import React from 'react'
import { Download, ArrowLeft, ShieldCheck, Smartphone, QrCode, HardDrive } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function ApkDownloadPage() {
  const { navigate } = useNavigationStore()

  const handleDownload = () => {
    window.open('/api/app/version', '_blank')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('app-update')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to App Updates
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Direct Android APK Download</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Signed release package for Android 10+ devices with SHA-256 verification hash</p>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Production Release Package
            </CardTitle>
            <Badge className="bg-emerald-600 text-white text-xs">v2.4.0 Final</Badge>
          </div>
          <CardDescription className="text-xs">Package name: `com.zylod.wholesale` • Size: 28.5 MB</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="p-4 bg-muted/30 rounded-xl border space-y-2 lg:col-span-3 self-start">
            <div className="text-xs font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              SHA-256 Checksum Hash
            </div>
            <div className="p-2 bg-background rounded-lg border font-mono text-[11px] text-muted-foreground break-all">
              e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-3 lg:col-span-2">
            <Button
              onClick={handleDownload}
              className="w-full sm:w-auto lg:w-full flex-1 lg:flex-none bg-primary text-primary-foreground text-xs font-bold py-5 rounded-xl gap-2 shadow-sm"
            >
              <Download className="h-4 w-4" />
              Download APK Now (28.5 MB)
            </Button>
            <Button
              variant="outline"
              onClick={() => alert('Scan QR Code with your Android camera to download directly to your mobile device.')}
              className="w-full sm:w-auto lg:w-full text-xs font-bold gap-2 py-5 rounded-xl border-primary/30 text-primary"
            >
              <QrCode className="h-4 w-4" />
              Scan QR to Install
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default ApkDownloadPage
