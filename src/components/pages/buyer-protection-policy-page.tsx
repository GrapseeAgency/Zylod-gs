'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, ShieldCheck, CheckCircle2, Clock,
  RefreshCw, DollarSign, ChevronRight, HelpCircle
} from 'lucide-react'

export function BuyerProtectionPolicyPage() {
  const { navigate, goBack } = useNavigationStore()

  const protections = [
    {
      title: 'Report Delivery Problems',
      desc: 'If products arrive broken, non-functional, or damaged in courier transit, report it with photos/video and your order number — the Zylod team reviews every case with the supplier.',
      icon: DollarSign,
    },
    {
      title: 'Specification Mismatch Guarantee',
      desc: 'If the delivered product does not match the listed material, grade, wattage, or technical parameters, you are entitled to a full refund.',
      icon: CheckCircle2,
    },
    {
      title: '48-Hour Inspection Window',
      desc: 'Every order gives you 48 hours after delivery to inspect carton counts and product build quality before payment is released.',
      icon: Clock,
    },
    {
      title: 'Guaranteed Dispatch Timeframes',
      desc: 'If a seller fails to ship goods within the committed SLA timeframe, you can cancel the order for an instant 100% wallet/bKash refund.',
      icon: RefreshCw,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Buyer Protection Policy</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 max-w-3xl mx-auto w-full pb-24 md:pb-8 lg:max-w-4xl">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-200 uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4 text-white" />
            Guaranteed Wholesale Safety
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Buyer Protection Policy</h1>
          <p className="text-xs text-red-100 leading-relaxed">
            Zylod does not hold funds in escrow. Our commitment: honest order status you can check at any time, payments verified before the supplier ships, and a human review of every reported problem.
          </p>
        </div>

        {/* Protections List */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {protections.map((p, idx) => {
            const Icon = p.icon
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900">{p.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{p.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-2">
          <h3 className="text-sm font-bold text-gray-900">Have an active order with an issue?</h3>
          <p className="text-xs text-gray-500">You can open an official support ticket or check dispute guidelines.</p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => navigate('submit-ticket')}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow hover:bg-red-700 transition"
            >
              Open Ticket
            </button>
            <button
              onClick={() => navigate('dispute-resolution-guide')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition"
            >
              Dispute Guidelines
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BuyerProtectionPolicyPage
