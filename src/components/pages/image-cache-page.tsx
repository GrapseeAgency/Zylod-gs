'use client'

import React, { useState } from 'react'
import { Image as ImageIcon, ArrowLeft, CheckCircle2, Sliders } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavigationStore } from '@/store/navigation-store'

export function ImageCachePage() {
  const { navigate } = useNavigationStore()
  const [quality, setQuality] = useState('high')
  const [maxCacheMb, setMaxCacheMb] = useState('200')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('cache-settings')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Cache Settings
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Image Cache Configuration</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Control image thumbnail resolution, compression profiles, and maximum disk cap</p>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Image Decoding & Compression
          </CardTitle>
          <CardDescription className="text-xs">Adjust parameters to balance visual fidelity with device storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold">Factory Fabric Swatch Quality</Label>
            <Select value={quality} onValueChange={setQuality}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ultra">Ultra (Lossless WebP - Best for textile thread counts)</SelectItem>
                <SelectItem value="high">High (Standard wholesale swatches - Recommended)</SelectItem>
                <SelectItem value="medium">Medium (Compressed for low-bandwidth networks)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold">Max Disk Cache Allocation</Label>
            <Select value={maxCacheMb} onValueChange={setMaxCacheMb}>
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

          <div className="pt-3 flex justify-end">
            <Button onClick={handleSave} className="bg-primary text-primary-foreground text-xs font-bold">
              {saved ? 'Updated!' : 'Save Image Cache Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default ImageCachePage
