'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Search, Download, Headphones, Check, Truck,
  Warehouse, DollarSign, Package, AlertCircle
} from 'lucide-react'

export function ReturnDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const trackingId = pageParams.trackingId || '#RET-8849201A'

  const returnItems = [
    {
      id: 'ri-1',
      name: 'Enterprise Grade Modular Rack Servers (2U Chassis)',
      sku: 'ER-8992-G',
      reason: 'DAMAGED IN TRANSIT',
      qty: 24,
      amount: 3450.00,
      image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'ri-2',
      name: 'Heavy Duty Shipping Pallet Containers (Corrugated)',
      sku: 'BOX-HD-2418',
      reason: 'WRONG ITEM RECEIVED',
      qty: 500,
      amount: 850.00,
      image: 'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=500&auto=format&fit=crop&q=80',
    },
  ]

  const totalRefund = 4300.00

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          </div>
          <button className="p-1 text-slate-700 hover:text-slate-900">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        {/* Title & Top Action Buttons */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Return Details</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Tracking ID: {trackingId}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {}}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download Label
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('help-center')}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <Headphones className="h-3.5 w-3.5" />
              Support
            </Button>
          </div>
        </div>

        {/* Card 1: Status Stepper */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-5">
          <h2 className="text-xs font-black text-slate-900">Status</h2>

          <div className="space-y-6 pl-2 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {/* Step 1: Request Received */}
            <div className="relative flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shrink-0 z-10">
                <Check className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-xs font-bold text-slate-900">Request Received</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Oct 12, 2023 • 09:41 AM</p>
              </div>
            </div>

            {/* Step 2: Pickup Scheduled (Active) */}
            <div className="relative flex items-start gap-4">
              <div className="w-6 h-6 rounded-full border-2 border-primary bg-white flex items-center justify-center text-xs shrink-0 z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              </div>
              <div className="min-w-0 pt-0.5 space-y-2 flex-1">
                <h3 className="text-xs font-black text-primary">Pickup Scheduled</h3>
                <p className="text-[11px] text-slate-500">Estimated: Oct 15 between 9AM - 5PM</p>

                <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl flex items-center gap-2.5 text-xs text-slate-700">
                  <Truck className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-[11px]">Freight carrier &apos;Global Logistics&apos; will contact you prior to arrival.</span>
                </div>
              </div>
            </div>

            {/* Step 3: Warehouse Inspection */}
            <div className="relative flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs shrink-0 z-10">
                <Warehouse className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-xs font-bold text-slate-500">Warehouse Inspection</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Pending receipt at facility</p>
              </div>
            </div>

            {/* Step 4: Refund Issued */}
            <div className="relative flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs shrink-0 z-10">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-xs font-bold text-slate-500">Refund Issued</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Awaiting inspection clearance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Palletizing Instructions */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold text-slate-900">Palletizing Instructions</h2>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            To ensure safe transit and quick processing of your return, items must be palletized correctly. Failure to follow these guidelines may result in rejection by the freight carrier.
          </p>

          <div className="space-y-3 pt-1">
            {[
              { num: '1', title: 'Standard Pallet', desc: 'Use a standard 48" x 40" wooden pallet in good condition without broken boards.' },
              { num: '2', title: 'Weight Distribution', desc: 'Stack heaviest cartons on the bottom layer to ensure stability during transport.' },
              { num: '3', title: 'Shrink Wrap', desc: 'Wrap the entire pallet tightly with commercial-grade stretch film at least 4 times.' },
              { num: '4', title: 'Attach Labels', desc: 'Securely tape the printed return labels on two opposing sides of the wrapped pallet.' },
            ].map((step) => (
              <div key={step.num} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.num}
                </span>
                <div className="text-xs">
                  <h3 className="font-bold text-slate-800">{step.title}</h3>
                  <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Items in Return */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold text-slate-900">Items in Return</h2>

          <div className="space-y-3 pt-1">
            {returnItems.map((item) => (
              <div key={item.id} className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 flex gap-3 items-center">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{item.name}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">SKU: {item.sku}</p>
                  <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-wider">
                    REASON: {item.reason}
                  </p>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-[11px] text-slate-500 font-medium">Qty: {item.qty}</span>
                    <span className="text-xs font-black text-slate-900">{formatPrice(item.amount)}</span>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800">Estimated Refund Total</span>
              <span className="text-base font-black text-slate-900">{formatPrice(totalRefund)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ReturnDetailPage
