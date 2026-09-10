'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, FileText, Download, Printer,
  CheckCircle2, Clock, ChevronRight, Loader2,
  Building2, Receipt, ShieldCheck
} from 'lucide-react'

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

export function InvoiceManagementPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Commercial Invoices</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-4xl md:px-6 md:py-6 md:space-y-6 lg:max-w-5xl">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 md:p-6 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black">VAT &amp; Tax Commercial Invoices</h1>
              <p className="text-xs text-slate-300">
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
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Generating Invoice Documents...</span>
            </div>
          ) : invoices.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="space-y-3 md:hidden">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 relative"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black text-slate-900">{inv.invoiceNumber}</h3>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                            {inv.paymentStatus}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                          {inv.mushakNumber} • PO #{inv.orderNumber}
                        </span>
                      </div>

                      <span className="text-sm font-black font-mono text-slate-900">
                        {formatPrice(inv.grandTotal)}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 text-xs flex justify-between text-slate-600">
                      <span>Client: <strong className="text-slate-800">{inv.buyerName}</strong></span>
                      <span>Issued: <strong className="text-slate-800">{new Date(inv.date).toLocaleDateString()}</strong></span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => navigate('order-invoice', { orderId: inv.id })}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Mushak 6.3 Invoice
                      </Button>
                      <Button
                        onClick={() => navigate('order-invoice-download', { orderId: inv.id })}
                        variant="outline"
                        className="h-10 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50/50 text-left text-xs uppercase tracking-wider text-slate-500">
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
                            <span className="text-xs font-black text-slate-900">{inv.invoiceNumber}</span>
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                              {inv.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400 font-mono">
                          {inv.mushakNumber} • PO #{inv.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{inv.buyerName}</td>
                        <td className="px-4 py-3 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-black font-mono text-slate-900">{formatPrice(inv.grandTotal)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => navigate('order-invoice', { orderId: inv.id })}
                              className="bg-primary hover:bg-primary/90 text-white font-bold h-8 px-3 rounded-xl text-xs flex items-center gap-1.5"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              onClick={() => navigate('order-invoice-download', { orderId: inv.id })}
                              variant="outline"
                              className="h-8 px-2.5 rounded-xl border-slate-200 text-slate-700"
                            >
                              <Download className="h-3.5 w-3.5" />
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
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
              <FileText className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 block">No commercial invoices found</span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default InvoiceManagementPage
