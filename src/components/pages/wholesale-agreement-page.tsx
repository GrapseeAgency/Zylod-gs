'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileSignature, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react'

export function WholesaleAgreementPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Master B2B Trade Agreement</h1>
          <p className="text-xs text-gray-400">Institutional Purchase Framework & Commercial Standards</p>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Master B2B Trade Agreement</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
        <div className="bg-rose-700 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5" />
            <h2 className="font-bold text-sm">Sale of Goods Framework (Bangladesh)</h2>
          </div>
          <p className="text-xs text-rose-100 leading-relaxed">
            All executed purchase orders on Zylod constitute valid commercial contracts governed by the Sale of Goods Act, 1930 and the Arbitration Act, 2001.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Key Contractual Terms</h3>
          <div className="space-y-2.5 text-xs text-gray-600 leading-relaxed">
            <p>
              <strong>1. Binding Force of Purchase Orders:</strong> A confirmed order locks product specifications, MOQ quantities, and wholesale pricing.
            </p>
            <p>
              <strong>2. Warranty of Title & Merchantability:</strong> The supplier warrants that it holds unencumbered title to the goods and that the items are free from latent manufacturing defects.
            </p>
            <p>
              <strong>3. Force Majeure:</strong> Neither party is liable for shipping delays caused by natural disasters, port blockades, or government regulatory halts.
            </p>
            <p>
              <strong>4. Jurisdiction:</strong> All arbitrations and legal notices shall be served within the territorial jurisdiction of Dhaka, Bangladesh.
            </p>
          </div>
        </div>

        <Button onClick={() => navigate('wholesale-terms')} className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold py-3">
          Back to Wholesale Terms
        </Button>
      </div>
    </div>
  )
}

export default WholesaleAgreementPage
