'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle2, ShieldCheck, FileText, ShoppingBag } from 'lucide-react'

export function BuyerTermsPage() {
  const { navigate, goBack } = useNavigationStore()

  const terms = [
    {
      title: 'Commercial Purpose Representation',
      desc: 'All purchase orders must be executed strictly for retail resale, manufacturing input, or commercial enterprise usage.',
    },
    {
      title: 'Order Payment & Verification',
      desc: 'Orders are created UNPAID. Pay by bank transfer or mobile banking (bKash/Nagad) using only the details shown on your order — the order advances to the supplier once Zylod verifies the payment.',
    },
    {
      title: 'Inspection & Defect Reporting Protocol',
      desc: 'Defects, shortages, or discrepancies should be documented with unboxing video/photos and reported to support@zylod.com as early as possible. Return eligibility follows the supplier\u2019s published return policy.',
    },
    {
      title: 'Cancellation & Order Amendments',
      desc: 'Ready-stock orders may be cancelled prior to warehouse dispatch. Custom RFQ production orders cannot be cancelled once raw material cutting begins.',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Buyer Terms & Obligations</h1>
          <p className="text-xs text-gray-400">Rules Governing Wholesale Purchasers</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        <div className="bg-blue-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            <h2 className="font-bold text-sm">Wholesale Buyer Code of Conduct</h2>
          </div>
          <p className="text-xs text-blue-100 leading-relaxed">
            These terms set honest expectations: orders are created UNPAID, payments go only to the official details shown on your order, and an order advances to the supplier only after payment is verified by Zylod.
          </p>
        </div>

        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {terms.map((t, idx) => (
            <div key={t.title} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                <h3 className="text-sm font-bold text-gray-900">{t.title}</h3>
              </div>
              <p className="text-xs text-gray-600 pl-8 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('terms-of-service')} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-3">
          Back to Main Terms of Service
        </Button>
      </div>
    </div>
  )
}

export default BuyerTermsPage
