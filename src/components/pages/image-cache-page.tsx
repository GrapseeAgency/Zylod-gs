'use client'

import React from 'react'
import { Image as ImageIcon, ArrowLeft, CheckCircle2, Smartphone, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavigationStore } from '@/store/navigation-store'
import { useDevicePrefs } from '@/hooks/use-device-prefs'

export function ImageCachePage() {
  const { navigate } = useNavigationStore()
  const { prefs, update } = useDevicePrefs()
  const [saved, setSaved] = React.useState(false)

  const handleSave = () => {
    // Device-local — persisted to localStorage by the setter; the "saved"
    // indicator is honest because the write is synchronous and verified.
    update('imageQuality', prefs.imageQuality)
    update('imageCacheMaxMb', prefs.imageCacheMaxMb)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const usageKb = typeof window !== 'undefined'
    ? Math.round(((window.localStorage.getItem('zylod:device-prefs:v1') ?? '').length * 2) / 1024)
    : 0

  return (
    <div className="overflow-x-hidden container mx-auto px-4 py-8 max-w-3xl lg:max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('cache-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Cache Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Image Cache Configuration</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Control image thumbnail resolution, compression profiles, and maximum disk cap
        </p>
      </div>

      {/* Honest device-local banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <Smartphone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Saved on this device</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Image cache rules apply only to this browser. The Zylod Android app stores its own
            cache settings on-device through its native settings panel.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Image Decoding &amp; Compression
          </CardTitle>
          <CardDescription className="text-xs">Adjust parameters to balance visual fidelity with device storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold">Factory Fabric Swatch Quality</Label>
            <Select
              value={prefs.imageQuality}
              onValueChange={(v: 'ultra' | 'high' | 'medium') => update('imageQuality', v)}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ultra">Ultra (Lossless WebP — best for textile thread counts)</SelectItem>
                <SelectItem value="high">High (Standard wholesale swatches — recommended)</SelectItem>
                <SelectItem value="medium">Medium (Compressed for low-bandwidth networks)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold">Max Disk Cache Allocation</Label>
            <Select
              value={String(prefs.imageCacheMaxMb)}
              onValueChange={(v) => update('imageCacheMaxMb', Number(v))}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select disk cap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 MB (Compact)</SelectItem>
                <SelectItem value="200">200 MB (Recommended)</SelectItem>
                <SelectItem value="500">500 MB (Power Wholesale Buyers)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <Badge variant="outline" className="text-[10px] font-mono py-1">
              Prefs blob: {usageKb} KB
            </Badge>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
              {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? 'Saved on this device' : 'Save Image Cache Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default ImageCachePage
