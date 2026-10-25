'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/page-loader'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Printer, Download, CheckCircle2, Clock, AlertTriangle, FileText, RefreshCw, XCircle
} from 'lucide-react'

// ── Real API types (GET /api/orders/[id]/invoice — the purpose-built invoice
//    document endpoint; Task 132 swapped the old order-detail fetch for it so
//    every number on this sheet is SERVER-computed: VAT, discount derivation,
//    platform billing identity, buyer of record) ────────────────────────────
interface InvoiceApiItem {
  id: string
  productName: string
  productImage: string | null
  variant: string | null
  quantity: number
  unitPrice: number
  total: number
  supplier: string
}
interface InvoiceApiCompany {
  name: string
  address: string
  city: string
  country: string
  phone: string
  email: string
  taxId: string
}
interface InvoiceApiData {
  invoiceNumber: string
  orderNumber: string
  orderDate: string
  invoiceDate: string
  status: string
  company: InvoiceApiCompany
  buyer: {
    name: string
    businessName: string | null
    address: string
    city: string
    district: string
    country: string
  }
  items: InvoiceApiItem[]
  subtotal: number
  shipping: number
  tax: number
  discount: number
  grandTotal: number
  paymentMethod: string
  paymentStatus: string
}

export function OrderInvoicePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || pageParams.id || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceApiData | null>(null)

  const loadInvoice = useCallback(async () => {
    if (!orderId) { setLoading(false); return }
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    setNotFound(false)
    setForbidden(false)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/invoice`, { credentials: 'include' })
      if (res.status === 401) { setNeedsAuth(true); setInvoice(null); return }
      if (res.status === 404) { setNotFound(true); setInvoice(null); return }
      if (res.status === 403) { setForbidden(true); setInvoice(null); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load invoice (HTTP ${res.status})`)
        setInvoice(null)
        return
      }
      setInvoice(json.data as InvoiceApiData)
    } catch {
      setError('Network error while loading the invoice. Check your connection and retry.')
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { loadInvoice() }, [loadInvoice])

  const handlePrint = () => { window.print() }

  // ── Honest guard states ───────────────────────────────────────────────
  if (!loading && !orderId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">No order selected</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Open an order from your order history to view its invoice.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-base font-black">Sign in required</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">You need to be signed in to view invoices.</p>
          <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
        </div>
      </div>
    )
  }

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <XCircle className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">Invoice not found</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">This order does not exist or has no invoice.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && forbidden) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <XCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-base font-black">Not authorized</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Only the order's buyer, a supplier on the order, or an admin can view this invoice.</p>
        </div>
      </div>
    )
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-base font-black">Could not load invoice</h1>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={loadInvoice} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <PageLoader />
  }

  if (!invoice) return null

  const isPaid = invoice.paymentStatus === 'paid'
  const issuedDate = new Date(invoice.invoiceDate)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs print:hidden md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100 active:scale-95 transition-transform" aria-label="Go back">
              ←
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Top Invoice Actions Card */}
        <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3 print:hidden">
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-black truncate">
              Invoice — Order #{invoice.orderNumber || '--'}
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">
              Issued: {issuedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {invoice.invoiceNumber}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 dark:border-slate-700 flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              onClick={handlePrint}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white flex items-center gap-1.5 shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Save PDF
            </Button>
          </div>
        </div>

        {/* Main Invoice Sheet */}
        <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          {/* Document Header — company identity from the endpoint, not hardcoded */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-black tracking-wider uppercase">TAX INVOICE</h2>
              <div className="mt-1">
                {isPaid ? (
                  <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900 flex items-center gap-1 inline-flex">
                    <CheckCircle2 className="h-3 w-3" />
                    PAID
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-100 dark:border-amber-900 flex items-center gap-1 inline-flex">
                    <Clock className="h-3 w-3" />
                    {(invoice.paymentStatus || 'unpaid').toUpperCase()} — PAYMENT PENDING VERIFICATION
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-black text-primary block">{invoice.company.name}</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                {invoice.company.address}<br />
                {invoice.company.city}, {invoice.company.country}<br />
                {invoice.company.taxId}
              </p>
            </div>
          </div>

          {/* BILLED TO (real buyer of record from the endpoint) / SHIPPED TO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50/80 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 dark:text-slate-400 block mb-1">
                BILLED TO
              </span>
              <p className="font-bold">{invoice.buyer.businessName || invoice.buyer.name}</p>
              <p className="text-slate-600 dark:text-slate-400 dark:text-slate-500">{invoice.buyer.address}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 pt-1">Buyer of record on this order.</p>
            </div>

            <div className="bg-slate-50/80 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 dark:text-slate-400 block mb-1">
                SHIP TO
              </span>
              <p className="font-bold">{invoice.buyer.city}{invoice.buyer.district ? `, ${invoice.buyer.district}` : ''}</p>
              <p className="text-slate-600 dark:text-slate-400 dark:text-slate-500">{invoice.buyer.address}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 pt-1">{invoice.buyer.country}</p>
            </div>
          </div>

          {/* Items Table — per-line supplier from the endpoint */}
          <div className="space-y-2">
            <div className="flex text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="w-8">#</span>
              <span className="flex-1">Item Description</span>
              <span className="w-14 text-right">Qty</span>
              <span className="w-24 text-right">Amount</span>
            </div>

            {invoice.items.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 py-4 text-center">No items recorded on this order.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-2">
                {invoice.items.map((item, idx) => (
                  <div key={item.id} className="flex pt-2 text-xs">
                    <span className="w-8 font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400">{idx + 1}</span>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold truncate">{item.productName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                        {item.variant || ''}
                        {item.supplier ? `${item.variant ? ' · ' : ''}${item.supplier}` : ''}
                      </p>
                    </div>
                    <span className="w-14 text-right font-semibold">{item.quantity}</span>
                    <span className="w-24 text-right font-bold">{formatPrice(item.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Breakdown — EVERY number server-computed. VAT is a
              regulatory REFERENCE line, never summed into the charged total
              (the platform's wholesale prices carry no separate VAT charge —
              pretending otherwise, or netting it back as a fake "discount",
              would both be lies). */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping &amp; Handling</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(invoice.shipping)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discounts applied</span>
                <span className="font-semibold">− {formatPrice(invoice.discount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 dark:border-slate-700 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total (as charged)</span>
              <span className="text-xl font-black text-primary">{formatPrice(invoice.grandTotal)}</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
              VAT (15%) regulatory reference: {formatPrice(invoice.tax)}. This total is the amount actually charged for the order.
            </p>
          </div>

          {/* Payment info footnote — from the endpoint's real payment records */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed space-y-2">
            <span className="font-bold text-slate-600 dark:text-slate-400 dark:text-slate-500 dark:text-slate-300 uppercase tracking-wider block mb-0.5">Payment Information</span>
            <p>
              Method: <span className="font-bold uppercase">{invoice.paymentMethod || '—'}</span> · Status:{' '}
              <span className="font-bold uppercase">{invoice.paymentStatus || '--'}</span> · Reference: Order #{invoice.orderNumber || '--'}
            </p>
            <p>For any discrepancies regarding this invoice, contact {invoice.company.email} within 14 days of receipt. All goods remain the property of the supplier until fully paid.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default OrderInvoicePage
