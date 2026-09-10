'use client'

import React, { useState } from 'react'
import { Link2, ArrowLeft, Copy, Check, Sparkles, QrCode } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavigationStore } from '@/store/navigation-store'

export function LinkGeneratorPage() {
  const { navigate } = useNavigationStore()
  const [destination, setDestination] = useState('product-detail')
  const [paramId, setParamId] = useState('clx8919')
  const [campaign, setCampaign] = useState('dhaka_expo_2026')
  const [copied, setCopied] = useState(false)

  const generatedCustomUrl = `zylod://${destination.replace('-detail', '')}/${paramId}?utm_campaign=${campaign}`
  const generatedWebUrl = `https://zylod.com/dl/${destination.replace('-detail', '')}/${paramId}?utm_source=app_link&utm_campaign=${campaign}`

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('deep-link-handler')} className="gap-2 text-xs font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to Deep Link Engine
      </Button>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-black text-foreground">Campaign Deep Link Generator</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Generate tracked Universal Links and custom scheme URLs for marketing promotions</p>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Link Configuration
          </CardTitle>
          <CardDescription className="text-xs">Specify target page destination and campaign attribution tokens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold">Target Destination</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Choose page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product-detail">Product Detail Page</SelectItem>
                <SelectItem value="supplier-storefront">Supplier Factory Storefront</SelectItem>
                <SelectItem value="exclusive-deal-detail">Exclusive Wholesale Deal</SelectItem>
                <SelectItem value="live-shopping-detail">Live Factory Stream</SelectItem>
                <SelectItem value="rfq-list">Instant RFQ Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Entity ID / SKU Slug</Label>
              <Input
                value={paramId}
                onChange={e => setParamId(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">UTM Campaign Tag</Label>
              <Input
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Result Box */}
          <div className="pt-4 border-t space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-foreground">Universal Web App Link (HTTPS):</span>
              <div className="p-3 bg-muted/30 rounded-xl border font-mono text-xs break-all flex items-center justify-between gap-2">
                <span className="text-primary">{generatedWebUrl}</span>
                <Button size="sm" variant="ghost" onClick={() => copyUrl(generatedWebUrl)} className="h-7 shrink-0 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-foreground">Native Android Scheme (ZYLOD://):</span>
              <div className="p-3 bg-muted/30 rounded-xl border font-mono text-xs break-all flex items-center justify-between gap-2">
                <span className="text-foreground">{generatedCustomUrl}</span>
                <Button size="sm" variant="ghost" onClick={() => copyUrl(generatedCustomUrl)} className="h-7 shrink-0 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default LinkGeneratorPage
