'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  X, Printer, Check, CreditCard, Loader2, AlertCircle, LogIn, Search, Package,
} from 'lucide-react'

/**
 * REAL order receipt — replaces the fabricated "Industrial Grade Steel
 * Bearings / Conveyor Belt Sections" receipt with invented money math
 * (subtotal 3460, shipping 150, a fake "Tax (8.25%)" the platform never
 * charges — the real rate is 15% VAT), a fake "Corporate Visa ending in
 * 4242", a fake "Oct 24, 2023 14:32 PST" date, and a decorative QR block
 * with an invented "TXN: 0x9a8f…" string.
 *
 * Source of truth: GET /api/orders/[id]/receipt (the purpose-built receipt
 * endpoint — buyer, a supplier on the order, or admin; every number
 * server-computed: subtotal from real line items, shipping from real
 * subOrder legs, tax at the platform VAT rate).
 *
 * pageParams.orderId required. Print/Save-PDF is the browser print dialog —
 * honest, no fabricated PDF generation.
 */

interface ApiReceipt {
  orderNumber: string
  orderDate: string
  paymentMethod: string
  paymentStatus: string
  items: { id: string; productName: string; sku: string; quantity: number; unitPrice: number; total: number }[]
  subtotal: number
  shipping: number
  tax: number
  total: number
  currency: string
  buyer: { name: string; businessName: string | null }
  shippingAddress: { address: string; city: string; district: string; country: string } | null
}

type Phase = 'loading' | 'anon' | 'notfound' | 'error' | 'ready'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

const METHOD_LABEL: Record<string, string> = {
  mobile_banking: 'Mobile banking',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cod: 'Cash on delivery',
  wallet: 'Wallet',
}

const PAYMENT_BADGE: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  failed: 'bg-red-50 text-red-700 border border-red-100',
  unpaid: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800',
}

export function OrderReceiptPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || pageParams.id || ''

  const [phase, setPhase] = useState<Phase>('loading')
  const [receipt, setReceipt] = useState<ApiReceipt | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const load = React.useCallback(async () => {
    if (!orderId) { setPhase('notfound'); return }
    setPhase('loading')
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/receipt`, { credentials: 'include' })
      if (res.status === 401) { setPhase('anon'); return }
      const json = await res.json().catch(() => null)
      if (res.status === 404) { setPhase('notfound'); return }
      if (res.status === 403) { setPhase('notfound'); return } // no existence leak
      if (!res.ok) { setPhase('error'); setErrorMsg(json?.error || `HTTP ${res.status}`); return }
      setReceipt(json?.data ?? null)
      setPhase('ready')
    } catch {
      setPhase('error'); setErrorMsg('Network error — check your connection and retry.')
    }
  }, [orderId])

  useEffect(() => { load() }, [load])

  const handlePrint = () => { window.print() }

  // ── gates ──
  if (!orderId || phase === 'notfound') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
            <Search className="h-6 w-6 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">No receipt selected</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
            Open an order from your order history to view or print its receipt.
          </p>
          <Button onClick={() => navigate('orders-history')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
            <Package className="h-4 w-4" /> Go to orders
          </Button>
        </div>
      </div>
    )
  }
  if (phase === 'anon') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
            <LogIn className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sign in required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Receipts are visible to the order's buyer, its suppliers, or an admin.</p>
          <Button onClick={() => navigate('login')} className="bg-primary text-primary-foreground text-xs font-bold gap-2">
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
        </div>
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Couldn't load the receipt</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 break-words">{errorMsg}</p>
          <Button onClick={load} variant="outline" className="text-xs font-bold gap-2">
            <Loader2 className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    )
  }
  if (phase === 'loading' || !receipt) {
    return (
      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <PageLoader className="min-h-0" />
      </div>
    )
  }

  const isPaid = ['paid', 'success'].includes((receipt.paymentStatus || '').toLowerCase())

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between print:hidden md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back" aria-label="Back">
          <X className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Zylod</span>
        <button onClick={handlePrint} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Print receipt" aria-label="Print receipt">
          <Printer className="h-5 w-5" />
        </button>
      </header>

      <main className="px-4 py-6 md:px-6 md:py-8 space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Desktop header row */}
        <div className="hidden md:flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Order receipt</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{receipt.orderNumber}</p>
          </div>
          <Button onClick={handlePrint} variant="outline" className="text-xs font-bold gap-2 print:hidden">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>

        {/* Status heading — reflects the REAL payment status, not an invented success */}
        <div className="text-center space-y-2 print:hidden">
          <div
            className={
              'w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-md ' +
              (isPaid ? 'bg-emerald-600 text-white shadow-emerald-600/20' : 'bg-amber-500 text-white shadow-amber-500/20')
            }
          >
            {isPaid ? (
              <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>
            ) : (
              <CreditCard className="h-7 w-7" />
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {isPaid ? 'Payment received' : 'Payment pending'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
            {isPaid
              ? 'Payment verified — the order is moving through fulfilment.'
              : 'This receipt reflects the current order state. The seller confirms payment before dispatch.'}
          </p>
        </div>

        {/* Receipt card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
          <div className="text-center">
            <h2 className="text-base font-black tracking-wider text-slate-900 dark:text-slate-100 uppercase">Digital receipt</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">Zylod Wholesale Hub · Dhaka, Bangladesh</p>
          </div>

          {/* Meta */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 text-xs">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">Order</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono break-all">{receipt.orderNumber}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">Date</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtDate(receipt.orderDate)}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">Payment</span>
              <span
                className={
                  'inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md ' +
                  (PAYMENT_BADGE[(receipt.paymentStatus || '').toLowerCase()] || PAYMENT_BADGE.unpaid)
                }
              >
                {(receipt.paymentStatus || 'unpaid').toUpperCase()}
              </span>
              <span className="block text-slate-600 dark:text-slate-400 dark:text-slate-500 mt-1">{METHOD_LABEL[receipt.paymentMethod] || receipt.paymentMethod}</span>
            </div>
          </div>

          {/* Buyer + address */}
          <div className="text-xs space-y-1">
            <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">Billed to</h3>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {receipt.buyer?.businessName || receipt.buyer?.name || 'N/A'}
              {receipt.buyer?.businessName && receipt.buyer?.name && (
                <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-normal"> · {receipt.buyer.name}</span>
              )}
            </p>
            {receipt.shippingAddress && (
              <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 break-words">
                {[receipt.shippingAddress.address, receipt.shippingAddress.city, receipt.shippingAddress.district, receipt.shippingAddress.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* Items */}
          <div className="space-y-4 pt-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              Order details
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-3">
              {receipt.items.map((item) => (
                <div key={item.id} className="space-y-1 pt-1 first:pt-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">{item.productName}</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono">SKU: {item.sku}</p>
                  <div className="flex justify-between items-baseline text-xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      Qty: {item.quantity} &nbsp; Price: {formatPrice(item.unitPrice)}
                    </span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{formatPrice(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Money — server-computed. VAT is a REGULATORY REFERENCE line, never
              summed into the charged total (the same honest presentation as the
              invoice page, Task 132: the platform's wholesale prices carry no
              separate VAT charge — pretending otherwise would be a lie). */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping (freight)</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {receipt.shipping > 0 ? formatPrice(receipt.shipping) : 'FREE'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">Total (as charged)</span>
              <span className="text-2xl font-black text-primary">{formatPrice(receipt.total)}</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
              VAT (15%) regulatory reference: {formatPrice(receipt.tax)}. This total is the amount
              actually charged for the order.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <Button
            onClick={handlePrint}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md gap-2"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
          <Button
            onClick={() => navigate('order-detail', { orderId })}
            variant="outline"
            className="flex-1 bg-white dark:bg-gray-900 text-slate-800 dark:text-slate-200 font-bold h-12 rounded-2xl text-xs"
          >
            View full order
          </Button>
        </div>
      </main>
    </div>
  )
}

export default OrderReceiptPage
import { PageLoader } from '@/components/ui/page-loader'
