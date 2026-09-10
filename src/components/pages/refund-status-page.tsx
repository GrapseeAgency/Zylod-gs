'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, HelpCircle, Check, RotateCw, Landmark,
  Info, Clock, ArrowRight, ShieldCheck
} from 'lucide-react'

export function RefundStatusPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const refundId = pageParams.refundId || '#RF-2023-88291'

  const refund = {
    id: refundId,
    title: 'Industrial Steel Shelving Unit (x2)',
    orderNumber: '#ORD-9938-A',
    amount: 1240.00,
    steps: [
      {
        id: 1,
        title: 'Refund Requested',
        subtitle: 'Request submitted by WholesaleBD Partner',
        time: 'Oct 24, 09:30 AM',
        done: true,
      },
      {
        id: 2,
        title: 'Approved',
        subtitle: 'Return inspected and refund authorized.',
        time: 'Oct 25, 02:15 PM',
        done: true,
      },
      {
        id: 3,
        title: 'Bank Processing',
        subtitle: 'Funds have been released to your financial institution. Processing times vary by bank.',
        time: 'Oct 26, 08:00 AM',
        active: true,
        tag: 'Credit to Business Line #4492',
      },
      {
        id: 4,
        title: 'Funds Credited',
        subtitle: 'Estimated completion.',
        time: 'Est. Oct 28 - Oct 30',
        pending: true,
      },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5 text-primary" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Refund Status</h1>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-700" title="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Refund Status</h1>
          <button className="p-1 text-slate-400 hover:text-slate-700" title="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
        {/* Card 1: Refund Header & Amount */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 font-mono block">
              Refund ID: {refund.id}
            </span>
            <h2 className="text-sm font-black text-slate-900 mt-0.5">
              {refund.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Original Order: {refund.orderNumber}
            </p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Refund Amount
            </span>
            <span className="text-2xl font-black text-primary mt-1 block">
              {formatPrice(refund.amount)}
            </span>
          </div>
        </div>

        {/* Card 2: Status Timeline */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-5">
          <h2 className="text-xs font-black text-slate-900">Status Timeline</h2>

          <div className="space-y-6 pl-2 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {refund.steps.map((step) => (
              <div key={step.id} className="relative flex items-start gap-4">
                {/* Node icon */}
                {step.done && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 z-10">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
                {step.active && (
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shrink-0 z-10 shadow-md shadow-primary/25">
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  </div>
                )}
                {step.pending && (
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center text-xs shrink-0 z-10">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                )}

                {/* Step info */}
                <div className="min-w-0 pt-0.5 space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-xs ${step.active ? 'font-black text-primary' : 'font-bold text-slate-800'}`}>
                      {step.title}
                    </h3>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {step.subtitle}
                  </p>

                  {step.tag && (
                    <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Landmark className="h-3.5 w-3.5 text-slate-500" />
                      <span>{step.tag}</span>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                    {step.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Assistance Box */}
        <div className="bg-slate-100/60 rounded-3xl p-4 border border-slate-200/80 flex gap-3 items-start">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h3 className="font-bold text-slate-900">Need assistance with this refund?</h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              If the funds have not appeared in your account after 5 business days, please contact your bank or reach out to our dedicated disputes desk.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default RefundStatusPage
