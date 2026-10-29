'use client'

/**
 * Printable QR Code Generator (audit unit 29 — Task 174).
 *
 * Two defects fixed:
 * 1. Seeded with the phantom `clx8919` product id (the same phantom t173
 *    eliminated from link-generator and deep-link-handler). Now seeded with
 *    a REAL product id from /api/products?limit=1 on mount, or an honest
 *    templated placeholder when the catalog is empty.
 * 2. The QR was a decorative pseudo-random "QR-looking" grid — NOT a
 *    scannable code. A marketer printing it would ship a broken code. Now
 *    renders a REAL spec-compliant QR code (qrcode.react's QRCodeSVG,
 *    black on white for printability) that encodes the exact deep-link URL
 *    shown above it. The Print/Download buttons open the browser's print
 *    dialog so the user can save the page as PDF, which is the real
 *    "print this" path.
 *
 * The old `alert()` theater on Print/Download is gone — Print now calls
 * window.print() (the real browser print dialog) and Download copies the URL
 * with an honest toast.
 */
import React, { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, ArrowLeft, Printer, Copy, Check, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigationStore } from '@/store/navigation-store'
import { toast } from 'sonner'

export function QrDeeplinkPage() {
  const { navigate } = useNavigationStore()
  const [targetUrl, setTargetUrl] = useState('https://zylod.com/dl/product/{id}')
  const [copied, setCopied] = useState(false)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    // Seed with a REAL product id (no phantom clx8919)
    fetch('/api/products?limit=1')
      .then(res => res.json())
      .then(json => {
        const list = Array.isArray(json?.data) ? json.data : (json?.data?.products ?? [])
        if (list.length > 0 && list[0]?.id) {
          setTargetUrl(`https://zylod.com/dl/product/${list[0].id}`)
        }
      })
      .catch(() => { /* templated placeholder stays */ })
      .finally(() => setSeeded(true))
  }, [])

  const hasPlaceholder = targetUrl.includes('{id}')

  const copyUrl = () => {
    if (hasPlaceholder) {
      toast.error('The URL still has a placeholder — pick a real product first.')
      return
    }
    navigator.clipboard.writeText(targetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openLink = () => {
    if (hasPlaceholder) {
      toast.error('Pick a real product first.')
      return
    }
    // Extract the entity id and navigate the SPA
    const match = targetUrl.match(/\/dl\/product\/([^?]+)/)
    if (match) navigate('product-detail', { id: match[1] })
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('deep-link-handler')} className="gap-2 text-xs font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back to Deep Link Engine
        </Button>

        <div className="border-b pb-4">
          <h1 className="text-2xl font-black text-foreground">Printable QR Code Generator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate a printable QR preview for factory catalog banners and trade booths.
          </p>
        </div>

        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <QrCode className="h-5 w-5 text-primary" />
              QR Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Deep Link Destination</Label>
              <Input
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                className="text-xs font-mono"
                placeholder="https://zylod.com/dl/product/{id}"
              />
              {!seeded && (
                <p className="text-[11px] text-muted-foreground">Loading a real product id…</p>
              )}
              {seeded && hasPlaceholder && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  The URL has a placeholder — no products exist yet to seed a real id.
                </p>
              )}
              {seeded && !hasPlaceholder && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Seeded with a real product id from the catalog.
                </p>
              )}
            </div>

            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-background border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl space-y-4">
              <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-md">
                {/* Real, scannable QR — black on white for printability */}
                <QRCodeSVG
                  value={targetUrl}
                  size={180}
                  level="M"
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                  marginSize={2}
                  title={`QR code for ${targetUrl}`}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground break-all text-center max-w-xs">{targetUrl}</span>
              <p className="text-[10px] text-muted-foreground text-center max-w-xs">
                Real, scannable QR code — use Print to save the page as a PDF for production artwork.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                onClick={() => window.print()}
                disabled={hasPlaceholder}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold py-5 rounded-xl gap-2 shadow-sm disabled:opacity-50"
              >
                <Printer className="h-4 w-4 shrink-0" /> Print / Save as PDF
              </Button>
              <Button
                variant="outline"
                onClick={copyUrl}
                disabled={hasPlaceholder}
                className="flex-1 sm:flex-none text-xs font-bold py-5 rounded-xl gap-2 disabled:opacity-50"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy URL
              </Button>
              <Button
                variant="outline"
                onClick={openLink}
                disabled={hasPlaceholder}
                className="flex-1 sm:flex-none text-xs font-bold py-5 rounded-xl gap-2 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" /> Open
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export default QrDeeplinkPage
