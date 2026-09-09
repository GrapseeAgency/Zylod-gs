'use client'

import React, { useCallback } from 'react'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Share2,
  Copy,
  Check,
  Mail,
  Linkedin,
  Send,
} from 'lucide-react'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/* ─── Color Constants ─── */
const RED = 'primary'

/* ─── Social Media SVG Icons ─── */

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

interface ProductShareDialogProps {
  productId: string
  productName: string
  productPrice?: number
  className?: string
}

function getShareUrl(productId: string) {
  // Real, working link — the app's own origin + SPA deep-link params
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/?page=product-detail&productId=${encodeURIComponent(productId)}`
}

function getShareText(productName: string, productPrice?: number, formatPrice?: (amount: number) => string) {
  const pricePart = productPrice ? ` - ${formatPrice ? formatPrice(productPrice) : `৳${productPrice}`}` : ''
  return `Check out ${productName}${pricePart} on Zylod — Bangladesh's B2B Wholesale Marketplace!`
}

function getFacebookShareUrl(url: string, text: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`
}

function getTwitterShareUrl(url: string, text: string) {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

function getWhatsAppShareUrl(url: string, text: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
}

function getLinkedInShareUrl(url: string) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
}

function getTelegramShareUrl(url: string, text: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

function getEmailShareUrl(url: string, text: string, productName: string) {
  const subject = encodeURIComponent(`Zylod: ${productName}`)
  const body = encodeURIComponent(`${text}\n\n${url}`)
  return `mailto:?subject=${subject}&body=${body}`
}

/* ─── Social Share Button (CSS transitions only) ─── */

interface SocialButtonProps {
  icon: React.ReactNode
  label: string
  color: string
  url: string
}

function SocialShareButton({ icon, label, color, url }: SocialButtonProps) {
  return (
    <button
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border bg-card hover:shadow-md hover:scale-105 active:scale-95 transition-all min-w-[80px]"
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      aria-label={`Share on ${label}`}
    >
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <span className="text-white h-5 w-5 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  )
}

/**
 * Full Share Dialog component.
 * (framer-motion removed for OOM optimization - uses CSS animations instead)
 */
export function ProductShareDialog({
  productId,
  productName,
  productPrice,
  className,
}: ProductShareDialogProps) {
  const [copied, setCopied] = React.useState(false)
  const { formatPrice, currentCurrency } = useCurrencyStore()

  const productUrl = getShareUrl(productId)
  const shareText = getShareText(productName, productPrice, formatPrice)

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(productUrl)
      setCopied(true)
      toast.success('Link copied to clipboard!', {
        description: productUrl,
        duration: 3000,
      })
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
      toast.success('Link copied to clipboard!', { duration: 3000 })
      setTimeout(() => setCopied(false), 2000)
    }
  }, [productUrl])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 rounded-md hover:bg-red-50', className)}
          aria-label="Share this product"
        >
          <Share2 className="h-4 w-4" style={{ color: 'primary' }} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" style={{ color: 'primary' }} />
            Share Product
          </DialogTitle>
          <DialogDescription>
            Share &ldquo;{productName}&rdquo;
            {productPrice ? ` — ${formatPrice(productPrice)}` : ''} with your network
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Social Share Buttons Grid */}
          <div className="grid grid-cols-3 gap-3">
            <SocialShareButton
              icon={<FacebookIcon className="h-5 w-5" />}
              label="Facebook"
              color="#1877F2"
              url={getFacebookShareUrl(productUrl, shareText)}
            />
            <SocialShareButton
              icon={<TwitterIcon className="h-5 w-5" />}
              label="Twitter / X"
              color="#000000"
              url={getTwitterShareUrl(productUrl, shareText)}
            />
            <SocialShareButton
              icon={<WhatsAppIcon className="h-5 w-5" />}
              label="WhatsApp"
              color="#25D366"
              url={getWhatsAppShareUrl(productUrl, shareText)}
            />
            <SocialShareButton
              icon={<Linkedin className="h-5 w-5" />}
              label="LinkedIn"
              color="#0A66C2"
              url={getLinkedInShareUrl(productUrl)}
            />
            <SocialShareButton
              icon={<Send className="h-5 w-5" />}
              label="Telegram"
              color="#0088CC"
              url={getTelegramShareUrl(productUrl, shareText)}
            />
            <SocialShareButton
              icon={<Mail className="h-5 w-5" />}
              label="Email"
              color={RED}
              url={getEmailShareUrl(productUrl, shareText, productName)}
            />
          </div>

          {/* URL Display + Copy */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted text-xs text-muted-foreground flex-1 min-w-0">
              <span className="truncate">{productUrl}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 mr-1 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-1" />
              )}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
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
 * Trigger button for the Share dialog.
 */
export function ProductShareDialogTrigger({
  productId,
  productName,
  productPrice,
  className,
}: ProductShareDialogProps) {
  return (
    <ProductShareDialog
      productId={productId}
      productName={productName}
      productPrice={productPrice}
      className={cn('h-6 w-6 rounded bg-card/90 shadow', className)}
    />
  )
}
