'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Store, ShieldCheck, Truck, Scale } from 'lucide-react'

export function SellerTermsPage() {
  const { navigate, goBack } = useNavigationStore()

  const rules = [
    {
      title: 'Merchant Verification & Compliance',
      desc: 'Suppliers must provide valid e-TIN, Trade License, and NID of authorized directors prior to receiving order disbursements.',
    },
    {
      title: 'Fulfillment & Dispatch SLA (48-72h)',
      desc: 'Ready-stock orders must be packaged to industrial standards and dispatched with approved courier tracking within 72 hours.',
    },
    {
      title: 'Quality & BSTI Standards Compliance',
      desc: 'All items must strictly correspond to uploaded product images, fabric GSM measurements, and stated material specifications.',
    },
    {
      title: 'Payment Verification & Commission Payouts',
      desc: 'Supplier payouts are calculated from verified, fulfilled orders minus the standard platform commission recorded on each order.',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Supplier & Factory Terms</h1>
          <p className="text-xs text-gray-400">Rules Governing Verified Mill Storefronts</p>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Supplier & Factory Terms</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
        <div className="bg-indigo-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            <h2 className="font-bold text-sm">Verified Manufacturer Protocol</h2>
          </div>
          <p className="text-xs text-indigo-100 leading-relaxed">
            Supplying direct to wholesale retailers requires compliance with quality standards, packaging integrity, and strict fulfillment SLAs.
          </p>
        </div>

        <div className="space-y-3">
          {rules.map((r, idx) => (
            <div key={r.title} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                <h3 className="text-sm font-bold text-gray-900">{r.title}</h3>
              </div>
              <p className="text-xs text-gray-600 pl-8 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('terms-of-service')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold py-3">
          Back to Main Terms of Service
        </Button>
      </div>
    </div>
  )
}

export default SellerTermsPage
