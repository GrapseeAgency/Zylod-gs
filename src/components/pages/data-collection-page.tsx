'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Database, Shield, Lock, Globe, Server, Eye } from 'lucide-react'

export function DataCollectionPage() {
  const { navigate, goBack } = useNavigationStore()

  const categories = [
    {
      title: 'Enterprise Identity Data',
      items: ['Company Trade License Number', 'National ID (NID) of Directors', 'Tax Identification Number (e-TIN)', 'Factory / Warehouse Physical Location'],
      reason: 'Statutory compliance with Bangladesh Bank & National Board of Revenue (NBR).',
    },
    {
      title: 'Transactional & Commercial Data',
      items: ['Purchase Order SKUs and quantities', 'Payment gateway logs & escrow references', 'Courier tracking telemetry', 'Bank account routing numbers'],
      reason: 'Execution of bulk order contracts and multi-sign SafePay escrow settlement.',
    },
    {
      title: 'Device & Telemetry Data',
      items: ['IP address & approximate geo-location', 'Browser agent & OS version', 'App crash telemetry', 'Session security tokens'],
      reason: 'Detect unauthorized login attempts, account takeover prevention, and CSRF protection.',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Data Collection Transparency</h1>
          <p className="text-xs text-gray-400">What We Collect and Why</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl md:max-w-5xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:px-6 md:py-8 md:pb-8 md:space-y-6">
        <div className="bg-emerald-700 rounded-3xl p-5 md:p-6 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <h2 className="font-bold text-sm">Transparency in B2B Data Governance</h2>
          </div>
          <p className="text-xs text-emerald-100 leading-relaxed">
            We only collect data strictly necessary to execute commercial wholesale trade, prevent merchant fraud, and fulfill tax reporting requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {categories.map((c) => (
            <div key={c.title} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-gray-900">{c.title}</h3>
              <ul className="space-y-1.5 pl-2">
                {c.items.map((i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {i}
                  </li>
                ))}
              </ul>
              <div className="p-2.5 bg-emerald-50 rounded-2xl">
                <p className="text-[11px] text-emerald-800 font-medium">
                  <strong>Why we need this:</strong> {c.reason}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('privacy-policy')} className="w-full md:w-auto md:px-10 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold py-3">
          Back to Privacy Policy
        </Button>
      </div>
    </div>
  )
}

export default DataCollectionPage
