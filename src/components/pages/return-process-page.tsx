'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, RotateCcw, Camera, ShieldCheck, Truck, Clock, CheckCircle2 } from 'lucide-react'

export function ReturnProcessPage() {
  const { navigate, goBack } = useNavigationStore()

  const steps = [
    {
      step: '1',
      title: 'Inspect & Document Within 7 Days',
      desc: 'Carefully inspect the delivered bulk shipment. Take high-resolution photos or video logs of any fabric defects, color mismatches, or packaging tears.',
      icon: Camera,
    },
    {
      step: '2',
      title: 'Submit Online Claim with Proof',
      desc: 'Go to My Orders > Order Details > Request Return. Select claim reason, enter affected quantity, and attach documentation.',
      icon: RotateCcw,
    },
    {
      step: '3',
      title: 'Supplier Review & Escrow Pause',
      desc: 'The supplier has 48 hours to accept, propose a partial credit refund, or counter. SafePay Escrow disbursement is frozen automatically.',
      icon: ShieldCheck,
    },
    {
      step: '4',
      title: 'Reverse Logistics Pickup',
      desc: 'Our logistics carrier (Steadfast/RedX) collects the packed parcel from your warehouse with automated return tracking.',
      icon: Truck,
    },
    {
      step: '5',
      title: 'Instant Refund Disbursement',
      desc: 'Upon warehouse verification, escrow funds are refunded immediately to your Zylod Wallet or original bank account in 3–5 days.',
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base md:text-xl">Step-by-Step Return Process</h1>
          <p className="text-xs text-gray-400">Complete Guide to Lodging Wholesale Return Claims</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24 md:px-6 md:py-8 md:space-y-6 md:pb-10 lg:max-w-4xl">
        <div className="space-y-3">
          {steps.map(s => (
            <div key={s.step} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-2xl bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">
                  {s.step}
                </div>
                <h3 className="text-xs font-bold text-gray-900">{s.title}</h3>
              </div>
              <p className="text-xs text-gray-600 pl-9 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button onClick={() => navigate('return-request')} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold py-3">
            Start Return Claim
          </Button>
          <Button onClick={() => navigate('return-policy')} variant="outline" className="rounded-xl text-xs font-bold py-3">
            Back to Return Policy
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ReturnProcessPage
