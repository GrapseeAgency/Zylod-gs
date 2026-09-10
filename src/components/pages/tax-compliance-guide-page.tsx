'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, FileText, CheckCircle2, Building2,
  Receipt, ShieldCheck, DownloadCloud, ChevronRight
} from 'lucide-react'

export function TaxComplianceGuidePage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">VAT & Tax Compliance Guide</span>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">VAT & Tax Compliance Guide</h1>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-3xl mx-auto w-full pb-24">
        {/* Banner */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wide">
            <Receipt className="w-4 h-4" />
            National Board of Revenue (NBR) Compliance
          </div>
          <h1 className="text-lg sm:text-xl font-bold">Mushak-6.3 VAT Invoices & TDS</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Lawful commercial invoicing and tax deduction standards for B2B wholesale in Bangladesh.
          </p>
        </div>

        {/* Core Tax Rules */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2.5">
            Commercial Invoicing Standards
          </h2>

          <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-gray-100 space-y-1">
              <p className="font-bold text-gray-900">1. Mushak-6.3 (মূসক-৬.৩) Challan / Tax Invoice</p>
              <p className="text-gray-600">
                Verified VAT-registered suppliers issue official Mushak-6.3 invoices on every completed wholesale consignment, showing product HS Code, Base Value, and applicable 5%, 7.5%, or 15% VAT rate.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-gray-100 space-y-1">
              <p className="font-bold text-gray-900">2. Tax Deducted at Source (TDS)</p>
              <p className="text-gray-600">
                Corporate buyers with a valid Withholding Tax Entity status can deduct applicable Source Tax (AIT/TDS) by providing a copy of the Mushak-6.6 Certificate during checkout.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-gray-100 space-y-1">
              <p className="font-bold text-gray-900">3. Instant PDF Invoice Download</p>
              <p className="text-gray-600">
                Every order generates an itemized digital commercial invoice accessible from the Order Invoices tab in your dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* CTA: Invoice + Contact */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('order-invoice')}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Download Your Invoices →
          </button>
          <button
            onClick={() => navigate('contact-us', { topic: 'tax_vat' })}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            Contact Us for Tax Queries →
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaxComplianceGuidePage
