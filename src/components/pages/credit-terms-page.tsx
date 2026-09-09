'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Clock, ShieldCheck, FileSpreadsheet, CheckCircle2 } from 'lucide-react'

export function CreditTermsPage() {
  const { navigate, goBack } = useNavigationStore()

  const creditTiers = [
    {
      tier: 'Net-15 Trade Credit',
      eligible: 'Silver VIP & Above',
      limit: 'Up to ৳3,00,000',
      tenor: '15 Days from Dispatch',
      criteria: '3+ successful completed orders with zero disputes',
    },
    {
      tier: 'Net-30 Enterprise Credit',
      eligible: 'Gold VIP & Above',
      limit: 'Up to ৳10,00,000',
      tenor: '30 Days from Dispatch',
      criteria: 'Monthly GMV > ৳5,00,000 + Valid CIB credit report',
    },
    {
      tier: 'Net-60 Institutional Financing',
      eligible: 'Platinum & Enterprise',
      limit: 'Up to ৳50,00,000',
      tenor: '60 Days + Milestone installments',
      criteria: 'Bank solvency certificate + Corporate board resolution',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Trade Credit & Net Terms</h1>
          <p className="text-xs text-gray-400">Institutional Financing Facilities for Accredited Buyers</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl md:max-w-5xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:px-6 md:py-8 md:pb-8 md:space-y-6">
        <div className="bg-violet-700 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <h2 className="font-bold text-sm">Grow Your Wholesale Inventory on Credit</h2>
          </div>
          <p className="text-xs text-violet-100 leading-relaxed">
            Accredited retail shopkeepers and commercial chains can purchase factory stock with flexible Net-15, Net-30, and Net-60 post-paid terms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {creditTiers.map(c => (
            <div key={c.tier} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-gray-900">{c.tier}</h3>
                  <p className="text-[10px] text-violet-700 font-semibold">{c.eligible}</p>
                </div>
                <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] font-bold">
                  {c.limit}
                </Badge>
              </div>
              <p className="text-xs text-gray-600"><strong>Tenor:</strong> {c.tenor}</p>
              <div className="p-2.5 bg-slate-50 rounded-2xl">
                <p className="text-[11px] text-gray-500">
                  <strong>Requirements:</strong> {c.criteria}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('vip-membership')} className="w-full md:w-auto md:px-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold py-3">
          Apply via VIP Membership
        </Button>
      </div>
    </div>
  )
}

export default CreditTermsPage
