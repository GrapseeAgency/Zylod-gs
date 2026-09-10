'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Menu, Search, Printer, Download, CheckCircle2,
  Building2, Truck, FileText, ArrowLeft
} from 'lucide-react'

export function OrderInvoicePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack } = useNavigationStore()

  const invoice = {
    number: 'INV-2023-8472',
    date: 'Oct 24, 2023',
    status: 'Paid',
    billedTo: {
      company: 'Tech Retailers Ltd.',
      contact: 'Abdul Rahman',
      address: '45 Tech Plaza, Ground Floor, Gulshan Avenue, Dhaka 1212, Bangladesh',
      email: 'accounts@techretailers.bd',
      phone: '+880 1711 000000',
    },
    shippedTo: {
      warehouse: 'Tech Retailers Warehouse',
      dock: 'Receiving Dock B, 78 Logistics Hub Road',
      area: 'Tongi Industrial Area, Gazipur, Bangladesh',
      carrier: 'Rapid Logistics BD',
      tracking: 'RLBD-99882233',
    },
    items: [
      {
        id: 1,
        name: 'Industrial Grade Surge Protectors',
        sku: 'SP-IG-442',
        spec: '6-Outlet, Heavy Duty',
      },
      {
        id: 2,
        name: 'Cat6 Ethernet Cable Roll (305m)',
        sku: 'NW-C6-305',
        spec: 'Blue, UTP Solid Copper',
      },
      {
        id: 3,
        name: '48-Port Managed Network Switch',
        sku: 'NW-SW-48M',
        spec: 'Gigabit, PoE+',
      },
    ],
    subtotal: 1000000,
    bulkDiscount: 50000,
    shipping: 15000,
    vat: 144750,
    total: 1109750,
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs print:hidden md:hidden">
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

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Top Invoice Actions Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs flex items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-sm md:text-base font-black text-slate-900">
              Invoice #{invoice.number}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Issued: {invoice.date}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              onClick={handlePrint}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white flex items-center gap-1.5 shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Main Tax Invoice Sheet */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
          {/* Document Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-black tracking-wider text-slate-900 uppercase">
                TAX INVOICE
              </h2>
              <div className="mt-1">
                <span className="bg-rose-50 text-primary text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-100 flex items-center gap-1 inline-flex">
                  <CheckCircle2 className="h-3 w-3" />
                  {invoice.status}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-black text-primary block">Zylod</span>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                123 Industrial Parkway<br />
                Warehouse District<br />
                Dhaka 1205, Bangladesh<br />
                VAT: 8934759238
              </p>
            </div>
          </div>

          {/* BILLED TO / SHIPPED TO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BILLED TO Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-1 text-xs">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              BILLED TO
            </span>
            <p className="font-bold text-slate-900">{invoice.billedTo.company}</p>
            <p className="text-slate-600">{invoice.billedTo.contact}</p>
            <p className="text-slate-600">{invoice.billedTo.address}</p>
            <div className="pt-2 text-[10px] text-slate-400 space-y-0.5 border-t border-slate-200/60 mt-2">
              <p>Email: {invoice.billedTo.email}</p>
              <p>Phone: {invoice.billedTo.phone}</p>
            </div>
          </div>

          {/* SHIPPED TO Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-1 text-xs">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              SHIPPED TO
            </span>
            <p className="font-bold text-slate-900">{invoice.shippedTo.warehouse}</p>
            <p className="text-slate-600">{invoice.shippedTo.dock}</p>
            <p className="text-slate-600">{invoice.shippedTo.area}</p>
            <div className="pt-2 text-[10px] text-slate-400 space-y-0.5 border-t border-slate-200/60 mt-2">
              <p>Carrier: {invoice.shippedTo.carrier}</p>
              <p>Tracking: {invoice.shippedTo.tracking}</p>
            </div>
          </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              <span className="w-8">#</span>
              <span className="flex-1">Item Description</span>
            </div>

            <div className="divide-y divide-slate-100 space-y-2">
              {invoice.items.map((item) => (
                <div key={item.id} className="flex pt-2 text-xs">
                  <span className="w-8 font-bold text-slate-400">{item.id}</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-[10px] text-slate-400">
                      SKU: {item.sku} | {item.spec}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">৳ {invoice.subtotal.toLocaleString()}.00</span>
            </div>
            <div className="flex justify-between text-primary font-semibold">
              <span>Bulk Discount (5%)</span>
              <span>- ৳ {invoice.bulkDiscount.toLocaleString()}.00</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping &amp; Handling</span>
              <span className="font-semibold text-slate-900">৳ {invoice.shipping.toLocaleString()}.00</span>
            </div>
            <div className="flex justify-between">
              <span>VAT (15%)</span>
              <span className="font-semibold text-slate-900">৳ {invoice.vat.toLocaleString()}.00</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-xl font-black text-primary">
                ৳ {invoice.total.toLocaleString()}.00
              </span>
            </div>
          </div>

          {/* Payment info footnote */}
          <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Payment Information</span>
            Payment processed via Wire Transfer (Ref: TR-WT-89384). Thank you for your business. For any discrepancies regarding this invoice, please contact billing@zylod.com within 14 days of receipt. All goods remain the property of Zylod until fully paid.
          </div>
        </div>
      </main>
    </div>
  )
}

export default OrderInvoicePage
