'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, CheckCircle2, Clock, Download,
  HelpCircle, Landmark, Info
} from 'lucide-react'

export function RefundDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || 'ORD-8922-WX'

  const creditNote = {
    refNumber: 'REF-2910-A',
    processedDate: 'OCT 24, 2023',
    returnValue: 1450.00,
    restockingFee: 145.00,
    shippingReimbursement: 25.00,
    totalRefund: 1330.00,
    creditTarget: 'Corporate Visa ending in ••42',
  }

  const handleDownloadPdf = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-primary">Refund Details</h1>
        </div>
      </header>

      <main className="px-4 py-6 space-y-5 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <h1 className="hidden md:block text-2xl font-bold text-primary">Refund Details</h1>
        {/* Approved Status Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Refund Approved</h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Your refund for order #{orderId} has been processed and is being credited to your original payment method.
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>Processed On: {creditNote.processedDate}</span>
          </div>
        </div>

        {/* Credit Note Breakdown Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">Credit Note</h3>
            <span className="bg-slate-100 text-slate-600 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
              {creditNote.refNumber}
            </span>
          </div>

          {/* Pricing Breakdown */}
          <div className="p-5 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Return Value (3x Premium Widgets)</span>
              <span className="font-semibold text-slate-900">{formatPrice(creditNote.returnValue)}</span>
            </div>

            <div className="flex justify-between text-primary font-semibold">
              <span className="flex items-center gap-1">
                Restocking Fee (deducted) <span className="text-[10px]">ⓘ</span>
              </span>
              <span>-{formatPrice(creditNote.restockingFee)}</span>
            </div>

            <div className="flex justify-between">
              <span>Shipping Reimbursement</span>
              <span className="font-semibold text-slate-900">{formatPrice(creditNote.shippingReimbursement)}</span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Total Refund Amount</span>
              <span className="text-xl font-black text-primary">
                {formatPrice(creditNote.totalRefund)}
              </span>
            </div>
          </div>

          {/* Credited destination box */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-start gap-3 text-xs">
            <Landmark className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">Credited to {creditNote.creditTarget}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Please allow 3-5 business days for funds to appear on your statement.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('dispute-center')}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            Dispute Center
          </Button>
        </div>
      </main>
    </div>
  )
}

export default RefundDetailPage
