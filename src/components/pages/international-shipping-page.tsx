'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Globe, Plane, Anchor, ShieldCheck, FileCheck } from 'lucide-react'

export function InternationalShippingPage() {
  const { navigate, goBack } = useNavigationStore()

  const modes = [
    {
      title: 'Air Cargo Express (3–7 Days)',
      desc: 'Ideal for high-value apparel samples, urgently needed fabric yardage, and sample swatches via DHL, FedEx, and Emirates SkyCargo.',
      icon: Plane,
    },
    {
      title: 'Ocean Freight FCL/LCL (15–35 Days)',
      desc: 'Full Container Load (20ft/40ft) and Less Container Load shipping from Chittagong Port (CTG) and Mongla to global ports (Middle East, Europe, North America).',
      icon: Anchor,
    },
    {
      title: 'Export Documentation & Customs Clearance',
      desc: 'Zylod coordinates commercial invoices, packing lists, Certificate of Origin (EPB), EXP issuance, and Bill of Lading documentation.',
      icon: FileCheck,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">International Wholesale Export</h1>
          <p className="text-xs text-gray-400">Cross-Border Freight from Bangladesh Manufacturing Hubs</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:px-6 md:py-6 md:pb-8 md:space-y-6 lg:max-w-5xl">
        <div className="bg-slate-900 rounded-3xl p-5 md:p-6 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-sm md:text-base">Global RMG & Wholesale Export</h2>
          </div>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Direct mill export solutions connecting international apparel buying houses directly to Bangladesh garment factories with FOB and CIF terms.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {modes.map(m => (
            <div key={m.title} className="bg-white rounded-3xl p-4.5 md:p-5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-blue-50 text-blue-600">
                  <m.icon className="w-4 h-4" />
                </div>
                <h3 className="text-xs md:text-sm font-bold text-gray-900">{m.title}</h3>
              </div>
              <p className="text-xs md:text-sm text-gray-600 pl-10 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('shipping-policy')} className="w-full md:w-auto md:mx-auto md:block md:px-10 bg-slate-900 text-white rounded-xl text-xs md:text-sm font-bold py-3">
          Back to Shipping Policy
        </Button>
      </div>
    </div>
  )
}

export default InternationalShippingPage
