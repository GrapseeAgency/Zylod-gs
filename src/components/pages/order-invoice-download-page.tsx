'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Download, Mail, Printer, HelpCircle,
  FileText, CheckCircle2
} from 'lucide-react'

export function OrderInvoiceDownloadPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const invoiceId = pageParams.invoiceId || 'INV-2023-88291'
  const orderRef = pageParams.orderRef || 'ORD-992-A'

  const [downloading, setDownloading] = useState(false)
  const [emailed, setEmailed] = useState(false)

  const handleDownload = () => {
    setDownloading(true)
    setTimeout(() => {
      setDownloading(false)
      window.print()
    }, 600)
  }

  const handleEmail = () => {
    setEmailed(true)
    setTimeout(() => setEmailed(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-primary">Invoice Details</h1>
        </div>
      </header>

      <main className="px-4 py-6 space-y-5 max-w-lg mx-auto md:px-6 md:py-8 md:max-w-3xl lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        {/* Document Preview Frame */}
        <div className="bg-white rounded-3xl p-6 border-2 border-rose-100 shadow-2xs space-y-4 lg:col-span-2 lg:row-span-2">
          <div className="w-24 h-6 bg-slate-200 rounded-lg animate-pulse" />
          <div className="space-y-2 pt-2">
            <div className="w-full h-3 bg-slate-200/80 rounded-md" />
            <div className="w-3/4 h-3 bg-slate-200/80 rounded-md" />
            <div className="w-1/2 h-3 bg-slate-200/80 rounded-md" />
          </div>
          <div className="h-28 border-b border-dashed border-slate-200" />
          <div className="flex justify-end pt-4">
            <div className="w-28 h-6 bg-slate-200 rounded-lg" />
          </div>
        </div>

        {/* Document Info Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 lg:col-start-3 lg:row-start-1">
          <h2 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400">
            Document Info
          </h2>

          <div className="space-y-2 text-xs divide-y divide-slate-50">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Invoice #</span>
              <span className="font-bold text-slate-900 font-mono">{invoiceId}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Date Issued</span>
              <span className="font-semibold text-slate-800">Oct 24, 2023</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Order Ref</span>
              <span className="font-black text-primary font-mono">{orderRef}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">File Size</span>
              <span className="font-semibold text-slate-700">1.2 MB (PDF)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1 lg:col-start-3 lg:row-start-2 lg:pt-0">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs md:text-sm shadow-md flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </Button>

          <Button
            variant="outline"
            onClick={handleEmail}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs md:text-sm flex items-center justify-center gap-2"
          >
            {emailed ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Sent to Finance!</span>
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                <span>Email to Finance</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs md:text-sm flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>

        {/* Dispute link */}
        <div className="text-center pt-2 lg:col-span-3 lg:pt-0">
          <button
            onClick={() => navigate('dispute-center')}
            className="text-xs md:text-sm text-slate-500 hover:text-primary flex items-center justify-center gap-1.5 mx-auto font-medium"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Dispute this invoice
          </button>
        </div>
      </main>
    </div>
  )
}

export default OrderInvoiceDownloadPage
