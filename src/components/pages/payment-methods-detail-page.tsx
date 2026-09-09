'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CreditCard, Smartphone, Building2, Wallet, ShieldCheck } from 'lucide-react'

export function PaymentMethodsDetailPage() {
  const { navigate, goBack } = useNavigationStore()

  const methods = [
    {
      name: 'bKash Merchant Direct',
      category: 'MFS (Mobile Financial Services)',
      fee: '1.85% Processing',
      limits: '৳1,00,000 / transaction · ৳5,00,000 / month',
      instant: true,
      desc: 'Instant escrow funding via official bKash Payment Gateway. Immediate payment confirmation and SMS token.',
    },
    {
      name: 'Nagad Business Gateway',
      category: 'MFS (Mobile Financial Services)',
      fee: '1.50% Processing',
      limits: '৳50,000 / transaction · ৳3,00,000 / month',
      instant: true,
      desc: 'Instant checkout through Nagad digital wallet with PIN authorization and immediate escrow reserve.',
    },
    {
      name: 'Corporate BEFTN Bank Transfer',
      category: 'Commercial Banking (Bangladesh Bank)',
      fee: '0% Platform Fee',
      limits: 'Unlimited Bulk Orders',
      instant: false,
      desc: 'Direct electronic funds transfer between all scheduled commercial banks in Bangladesh. Cleared in 1 banking day.',
    },
    {
      name: 'Real-Time NPSB / RTGS Bank Transfer',
      category: 'Commercial Banking (Bangladesh Bank)',
      fee: '0% Platform Fee',
      limits: 'Minimum ৳1,00,000 (RTGS) · Instant settlement',
      instant: true,
      desc: 'High-value real-time gross settlement for factory volume consignments (৳1 Lakh to ৳10 Crore).',
    },
    {
      name: 'Zylod SafePay Escrow Wallet',
      category: 'Platform Balance',
      fee: '0% Processing Fee',
      limits: 'Based on prepaid wallet balance',
      instant: true,
      desc: '1-click checkout from your preloaded Zylod wholesale balance with instant supplier reservation.',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Payment Methods Breakdown</h1>
          <p className="text-xs text-gray-400">Fees, Transaction Limits & Gateway SLAs</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:pb-8 md:px-6 md:py-6 lg:max-w-4xl">
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {methods.map(m => (
            <div key={m.name} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs md:text-sm font-bold text-gray-900">{m.name}</h3>
                  <p className="text-[10px] text-gray-400 font-semibold">{m.category}</p>
                </div>
                <Badge className={`text-[10px] font-bold ${m.fee.startsWith('0%') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                  {m.fee}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{m.desc}</p>
              <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-500">
                <span>Limits: {m.limits}</span>
                <span className="font-bold text-violet-700">{m.instant ? '⚡ Instant' : '⏳ 1 Day'}</span>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('payment-terms')} className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold py-3 md:w-auto md:max-w-xs md:mx-auto md:flex md:px-8">
          Back to Payment Terms
        </Button>
      </div>
    </div>
  )
}

export default PaymentMethodsDetailPage
