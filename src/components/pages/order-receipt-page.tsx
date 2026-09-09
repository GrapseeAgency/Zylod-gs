'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  X, Printer, Download, Check, QrCode, CreditCard,
  Building2, ArrowRight
} from 'lucide-react'

export function OrderReceiptPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || 'WBD-2023-8902A'

  const items = [
    {
      name: 'Industrial Grade Steel Bearings (SKU: SB-892)',
      packaging: 'Pallet: 100 units / pallet',
      qty: 5,
      unitPrice: 245.00,
      total: 1225.00,
    },
    {
      name: 'Heavy Duty Conveyor Belt Sections (SKU: CB-014)',
      packaging: 'Length: 50m rolls',
      qty: 2,
      unitPrice: 890.00,
      total: 1780.00,
    },
    {
      name: 'Safety Work Gloves (Bulk Pack) (SKU: WG-B20)',
      packaging: 'Size: Large, 50 pairs/box',
      qty: 10,
      unitPrice: 45.50,
      total: 455.00,
    },
  ]

  const subtotal = 3460.00
  const shipping = 150.00
  const tax = 297.83
  const total = subtotal + shipping + tax

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between print:hidden md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Close">
          <X className="h-5 w-5" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="p-1 text-slate-700 hover:text-slate-900" title="Print">
            <Printer className="h-5 w-5" />
          </button>
          <button onClick={handlePrint} className="p-1 text-slate-700 hover:text-slate-900" title="Download">
            <Download className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 md:px-6 md:py-8 space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Success Circle & Heading */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center mx-auto shadow-md shadow-primary/20">
            <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center">
              <Check className="h-6 w-6 stroke-[3]" />
            </div>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Payment Successful</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Your order is being processed for dispatch.
          </p>
        </div>

        {/* Digital Receipt Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
          <div className="text-center">
            <h2 className="text-base font-black tracking-wider text-slate-900 uppercase">
              DIGITAL RECEIPT
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Zylod Wholesale Hub</p>
          </div>

          {/* Meta Info Box */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 text-xs">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                ORDER ID
              </span>
              <span className="font-bold text-slate-900 font-mono">#{orderId}</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                DATE &amp; TIME
              </span>
              <span className="font-semibold text-slate-700">Oct 24, 2023 • 14:32 PST</span>
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                PAYMENT METHOD
              </span>
              <span className="font-semibold text-slate-700">Corporate Visa ending in 4242</span>
            </div>
          </div>

          {/* Order Details List */}
          <div className="space-y-4 pt-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              ORDER DETAILS
            </h3>

            <div className="divide-y divide-slate-100 space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className={`space-y-1 ${idx > 0 ? 'pt-3' : ''}`}>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{item.name}</h4>
                  <p className="text-[11px] text-slate-400">{item.packaging}</p>
                  <div className="flex justify-between items-baseline text-xs pt-1">
                    <span className="text-slate-500">
                      Qty: {item.qty} &nbsp;&nbsp; Price: {formatPrice(item.unitPrice)}
                    </span>
                    <span className="font-black text-slate-900">{formatPrice(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping (Freight)</span>
              <span className="font-semibold text-slate-900">{formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8.25%)</span>
              <span className="font-semibold text-slate-900">{formatPrice(tax)}</span>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-base font-bold text-slate-900">Total</span>
              <span className="text-2xl font-black text-primary">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          {/* Warehouse Scan Code Box */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-center space-y-3">
            <div className="w-24 h-24 bg-white border-2 border-slate-900 rounded-xl mx-auto flex items-center justify-center p-2 shadow-2xs">
              <div className="w-full h-full border-4 border-slate-900 flex items-center justify-center relative">
                <div className="w-6 h-6 bg-slate-900" />
                <div className="w-3 h-3 bg-slate-900 absolute top-1 left-1" />
                <div className="w-3 h-3 bg-slate-900 absolute top-1 right-1" />
                <div className="w-3 h-3 bg-slate-900 absolute bottom-1 left-1" />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900">Warehouse Scan Code</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                Present this code at loading dock B for expedited pickup.
              </p>
            </div>

            <p className="text-[9px] font-mono text-slate-400 truncate px-2 bg-white rounded-lg py-1 border border-slate-200">
              TXN: 0x9a8f7c6d5e4b3a2f189876543...
            </p>
          </div>
        </div>

        {/* Return to Dashboard */}
        <Button
          onClick={() => navigate('buyer-dashboard')}
          className="w-full md:w-auto md:px-10 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md print:hidden"
        >
          Return to Dashboard
        </Button>
      </main>
    </div>
  )
}

export default OrderReceiptPage
