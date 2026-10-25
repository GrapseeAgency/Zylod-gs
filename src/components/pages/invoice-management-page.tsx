'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, FileText, Download, Printer,
  CheckCircle2, Clock, ChevronRight, Loader2,
  Building2, Receipt, ShieldCheck, X
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

interface InvoiceItem {
  id: string
  invoiceNumber: string
  mushakNumber: string
  orderNumber: string
  date: string
  dueDate: string
  subtotal: number
  vatAmount: number
  shipping: number
  grandTotal: number
  paymentStatus: string
  buyerName: string
  itemsCount: number
}

// Task 132: the Mushak 6.3 document from GET /api/invoices/[id] — a DIFFERENT
// real document from the order invoice (NBR-style 5% VAT + MUSHAK number vs
// the 15% VAT company invoice on the order-invoice page).
interface MushakDoc {
  invoiceNumber: string
  mushakNumber: string
  orderNumber: string
  date: string
  buyer: { name: string; email: string | null; phone: string | null; address: string; tin: string }
  seller: { name: string; tin: string; bin: string; address: string }
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; unit: string }>
  subtotal: number
  vatRate: string
  vatAmount: number
  shippingCost: number
  grandTotal: number
  paymentStatus: string
  paymentMethod: string
}

export function InvoiceManagementPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // Task 132: the Mushak 6.3 detail dialog — consumes GET /api/invoices/[id],
  // which had ZERO consumers since it shipped.
  const [mushakDoc, setMushakDoc] = useState<MushakDoc | null>(null)
  const [mushakLoading, setMushakLoading] = useState(false)
  const [mushakError, setMushakError] = useState('')

  const openMushak = useCallback(async (orderId: string) => {
    setMushakDoc(null)
    setMushakError('')
    setMushakLoading(true)
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setMushakError(json?.error || `Could not load the Mushak document (HTTP ${res.status}).`)
        return
      }
      setMushakDoc(json.data as MushakDoc)
    } catch {
      setMushakError('Network error while loading the Mushak document. Check your connection and retry.')
    } finally {
      setMushakLoading(false)
    }
  }, [token])

  useEffect(() => {
    async function loadInvoices() {
      if (!token) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/invoices?status=${filter}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setInvoices(json.data)
        }
      } finally {
        setLoading(false)
      }
    }
    loadInvoices()
  }, [token, filter])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Commercial Invoices</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-4xl md:px-6 md:py-6 md:space-y-6 lg:max-w-5xl">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-slate-900 dark:to-rose-950 rounded-3xl p-5 md:p-6 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black">VAT &amp; Tax Commercial Invoices</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Mushak 6.3 compliant tax documents for corporate audit filing.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Invoices' },
            { id: 'paid', label: 'Settled / Paid' },
            { id: 'pending', label: 'Unpaid / Invoiced' },
          ].map(({ id, label }) => {
            const isSelected = filter === id
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Invoice List */}
        <div>
          {loading ? (
            <PageLoader label="Generating Invoice Documents…" />
          ) : invoices.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="space-y-3 md:hidden">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 relative"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</h3>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                            {inv.paymentStatus}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                          {inv.mushakNumber} • PO #{inv.orderNumber}
                        </span>
                      </div>

                      <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-100">
                        {formatPrice(inv.grandTotal)}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-3 text-xs flex justify-between text-slate-600 dark:text-slate-400 dark:text-slate-500">
                      <span>Client: <strong className="text-slate-800 dark:text-slate-200">{inv.buyerName}</strong></span>
                      <span>Issued: <strong className="text-slate-800 dark:text-slate-200">{new Date(inv.date).toLocaleDateString()}</strong></span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => openMushak(inv.id)}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        View Mushak 6.3
                      </Button>
                      <Button
                        onClick={() => navigate('order-invoice', { orderId: inv.id })}
                        variant="outline"
                        className="h-10 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                        title="Full tax invoice"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50/50 text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      <th className="px-4 py-3 font-semibold">Invoice</th>
                      <th className="px-4 py-3 font-semibold">Mushak / PO</th>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Issued</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-red-50/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</span>
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                              {inv.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono">
                          {inv.mushakNumber} • PO #{inv.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 dark:text-slate-500">{inv.buyerName}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 dark:text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-black font-mono text-slate-900 dark:text-slate-100">{formatPrice(inv.grandTotal)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => openMushak(inv.id)}
                              className="bg-primary hover:bg-primary/90 text-white font-bold h-8 px-3 rounded-xl text-xs flex items-center gap-1.5"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Mushak 6.3
                            </Button>
                            <Button
                              onClick={() => navigate('order-invoice', { orderId: inv.id })}
                              variant="outline"
                              className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                              title="Full tax invoice"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <FileText className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">No commercial invoices found</span>
            </div>
          )}
        </div>
      </main>

      {/* Task 132: Mushak 6.3 document dialog — the /api/invoices/[id] consumer */}
      <Dialog open={mushakLoading || !!mushakDoc || !!mushakError} onOpenChange={(o) => { if (!o) { setMushakDoc(null); setMushakError('') } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="mushak-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Mushak 6.3 — Commercial Invoice
            </DialogTitle>
            <DialogDescription className="text-xs">
              NBR-compliant tax document for corporate audit filing.
            </DialogDescription>
          </DialogHeader>

          {mushakLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
            </div>
          )}

          {!mushakLoading && mushakError && (
            <div className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
              {mushakError}
            </div>
          )}

          {!mushakLoading && mushakDoc && (
            <div className="space-y-4 text-xs" data-testid="mushak-doc">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <p className="font-black text-sm">{mushakDoc.invoiceNumber}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-mono">{mushakDoc.mushakNumber} · PO #{mushakDoc.orderNumber}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Issued {new Date(mushakDoc.date).toLocaleDateString()}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${mushakDoc.paymentStatus === 'paid' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
                  {mushakDoc.paymentStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 space-y-0.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 dark:text-slate-400">Seller</p>
                  <p className="font-bold">{mushakDoc.seller.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">{mushakDoc.seller.address}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">TIN {mushakDoc.seller.tin} · BIN {mushakDoc.seller.bin}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 space-y-0.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 dark:text-slate-400">Buyer</p>
                  <p className="font-bold">{mushakDoc.buyer.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">{mushakDoc.buyer.address}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">TIN {mushakDoc.buyer.tin}</p>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="text-left text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-1.5">Item</th>
                    <th className="py-1.5 text-right">Qty</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {mushakDoc.items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 font-bold">{it.name}<span className="block text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">৳{it.unitPrice} / {it.unit}</span></td>
                      <td className="py-1.5 text-right font-semibold">{it.quantity}</td>
                      <td className="py-1.5 text-right font-bold">{formatPrice(it.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 dark:text-slate-500">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(mushakDoc.subtotal)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(mushakDoc.shippingCost)}</span></div>
                <div className="flex justify-between"><span>VAT ({mushakDoc.vatRate})</span><span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(mushakDoc.vatAmount)}</span></div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Grand Total</span>
                  <span className="text-lg font-black text-primary">{formatPrice(mushakDoc.grandTotal)}</span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 pt-1">Payment method: {mushakDoc.paymentMethod || '—'} · status {mushakDoc.paymentStatus}.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default InvoiceManagementPage
