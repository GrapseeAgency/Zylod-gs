'use client'

import React, { useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Download, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ─── Color Constants ─── */
const RED = 'primary'

interface ProductQRCodeProps {
  productId: string
  productName: string
  className?: string
  /** Size of the QR code SVG inside the dialog (default 220) */
  qrSize?: number
}

/**
 * Full QR Code Dialog component.
 * Opens a modal showing a QR code for the product URL with download & copy actions.
 * (framer-motion removed for OOM optimization - uses CSS animations instead)
 */
export function ProductQRCodeDialog({
  productId,
  productName,
  className,
  qrSize = 220,
}: ProductQRCodeProps) {
  const [copied, setCopied] = React.useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Real, scannable link — the app's own origin + SPA deep-link params
  // (AppEntry reads ?page=…&productId=… on boot and routes to the product).
  const productUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?page=product-detail&productId=${encodeURIComponent(productId)}`
    : `/?page=product-detail&productId=${encodeURIComponent(productId)}`

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(productUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = productUrl
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [productUrl])

  const handleDownload = useCallback(() => {
    const svgElement = svgRef.current
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `zylod-qr-${productId}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [productId])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 rounded-md hover:bg-red-50', className)}
          aria-label="Show QR code"
        >
          <QrCode className="h-4 w-4" style={{ color: 'primary' }} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" style={{ color: 'primary' }} />
            QR Code
          </DialogTitle>
          <DialogDescription>
            Scan this QR code to view &ldquo;{productName}&rdquo; on Zylod
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in zoom-in-95 duration-200">
          {/* QR Code SVG */}
          <div className="p-4 bg-card rounded-xl border shadow-sm">
            <QRCodeSVG
              ref={svgRef}
              value={productUrl}
              size={qrSize}
              level="H"
              fgColor={RED}
              bgColor="#FFFFFF"
              marginSize={2}
              title={`QR code for ${productName}`}
              imageSettings={{
                src: "data:image/svg+xml;base64," + btoa(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
                  '<rect width="96" height="96" rx="20" fill="#FFFFFF"/>' +
                  '<text x="48" y="63" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="bold" text-anchor="middle" fill="#C8102E">W</text>' +
                  '</svg>'
                ),
                height: Math.round(qrSize * 0.2),
                width: Math.round(qrSize * 0.2),
                excavate: true,
              }}
            />
          </div>

          {/* Product Name Label */}
          <p className="text-sm font-medium text-center max-w-[280px] line-clamp-2">
            {productName}
          </p>

          {/* URL Display */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-xs text-muted-foreground w-full max-w-[340px]">
            <span className="truncate flex-1">{productUrl}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCopyLink}
          >
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button
            className="flex-1"
            style={{ backgroundColor: RED }}
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Download QR Code
          </Button>
        </div>

        <DialogClose asChild>
          <Button variant="ghost" size="sm" className="mt-2 w-full sm:hidden">
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Trigger button for the QR Code dialog.
 * Can be used directly on product cards for the hover-reveal pattern.
 */
export function ProductQRCodeTrigger({
  productId,
  productName,
  className,
}: ProductQRCodeProps) {
  return (
    <ProductQRCodeDialog
      productId={productId}
      productName={productName}
      className={cn('h-6 w-6 rounded bg-card/90 shadow', className)}
    />
  )
}
