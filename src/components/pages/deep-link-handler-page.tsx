'use client'

import React, { useState, useEffect } from 'react'
import {
  Link2,
  ExternalLink,
  QrCode,
  BarChart2,
  Copy,
  Check,
  Zap,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Plus
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'

export function DeepLinkHandlerPage() {
  const { navigate } = useNavigationStore()
  const [routes, setRoutes] = useState<any[]>([])
  const [testUrl, setTestUrl] = useState('zylod://product/clx8919')
  const [resolveResult, setResolveResult] = useState<any>(null)
  const [resolving, setResolving] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/app/deep-links')
      .then(res => res.json())
      .then(json => {
        if (json.data) setRoutes(json.data)
      })
      .catch(console.error)
  }, [])

  const handleTestResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    setResolving(true)
    try {
      const res = await fetch(`/api/app/deep-links?url=${encodeURIComponent(testUrl)}`)
      const json = await res.json()
      setResolveResult(json.data)
    } finally {
      setResolving(false)
    }
  }

  const copyLink = (text: string, slug: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">Deep Link Routing Engine</h1>
              <p className="text-sm text-muted-foreground">Universal App Links, custom schemes (`zylod://`), and marketing campaign resolvers</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('link-generator')}
            className="bg-primary text-primary-foreground text-xs font-bold gap-1.5"
          >
            <Plus className="h-4 w-4" /> Create Campaign Deep Link
          </Button>
        </div>
      </div>

      {/* Interactive Tester Hero */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Live Deep Link Intent Simulator
          </CardTitle>
          <CardDescription className="text-xs">Test URI resolution and target page mapping</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <form onSubmit={handleTestResolve} className="flex gap-2">
            <Input
              value={testUrl}
              onChange={e => setTestUrl(e.target.value)}
              placeholder="e.g. zylod://product/123 or https://zylod.com/deals"
              className="text-xs font-mono"
            />
            <Button type="submit" disabled={resolving} className="text-xs font-bold shrink-0">
              {resolving ? 'Resolving...' : 'Simulate Intent'}
            </Button>
          </form>

          {resolveResult && (
            <div className="p-4 bg-muted/40 rounded-xl border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Resolved Target:</span>
                <Badge className={resolveResult.matched ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}>
                  {resolveResult.matched ? 'Match Found' : 'Fallback Home'}
                </Badge>
              </div>
              <div className="font-mono text-primary font-bold">
                Target Page ID: {resolveResult.targetPage}
              </div>
              {resolveResult.paramValue && (
                <div className="text-muted-foreground font-mono">
                  Extracted Parameter: id = {resolveResult.paramValue}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(resolveResult.targetPage as any, resolveResult.paramValue ? { id: resolveResult.paramValue } : undefined)}
                className="text-xs font-semibold mt-2 gap-1.5"
              >
                Execute Navigation <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registered Deep Link Schemes */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Registered App Link Routes & Handlers
            </CardTitle>
            <Badge variant="outline" className="text-xs">{routes.length} Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {routes.map((r) => {
            const sampleUrl = `zylod://${r.slug}`
            const isCopied = copiedSlug === r.slug

            return (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/20 rounded-xl border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-foreground">{r.pathPattern}</span>
                    <Badge variant="outline" className="text-[10px]">{r.targetPage}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">{r.clickCount} clicks</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyLink(sampleUrl, r.slug)}
                    className="h-8 text-xs font-semibold gap-1 text-primary"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {isCopied ? 'Copied' : 'Copy Scheme'}
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Quick Navigation to sub-tools */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('link-generator')} className="text-xs font-semibold">
          Campaign Deep Link Generator
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('link-analytics')} className="text-xs font-semibold">
          Deep Link Click Telemetry & Analytics
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('qr-deeplink')} className="text-xs font-semibold">
          Printable QR Code Generator
        </Button>
      </div>
    </div>
  )
}
export default DeepLinkHandlerPage
