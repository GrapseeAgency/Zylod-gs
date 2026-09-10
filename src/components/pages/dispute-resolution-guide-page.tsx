'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Scale, Clock, ShieldCheck, FileCheck,
  CheckCircle2, AlertTriangle, ChevronRight, Video, Camera
} from 'lucide-react'

export function DisputeResolutionGuidePage() {
  const { navigate, goBack } = useNavigationStore()

  const steps = [
    {
      time: 'Step 1: Within 48h of Delivery',
      title: 'Inspect & Open Dispute',
      desc: 'Count all units, test product operation, and record clear unboxing video/photos. If discrepancies exist, click Raise Dispute in your Order Detail page to immediately lock escrow funds.',
      icon: Clock,
    },
    {
      time: 'Step 2: 24h Supplier Response',
      title: 'Direct Merchant Negotiation',
      desc: 'The supplier is given 24 hours to review your evidence and offer a free batch replacement, partial discount refund, or accept full return.',
      icon: Scale,
    },
    {
      time: 'Step 3: Zylod Arbitration',
      title: 'Official Platform Mediation',
      desc: 'If the supplier refuses to cooperate or fails to respond within 24 hours, Zylod Dispute Specialists step in and evaluate photographic proof against product listing specifications.',
      icon: ShieldCheck,
    },
    {
      time: 'Step 4: Escrow Resolution',
      title: 'Instant Refund or Reshipment',
      desc: 'Upon dispute validation, 100% of escrow funds are released back to your Zylod Wallet / bKash / Bank account within 1-2 business days.',
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Dispute & Arbitration Guide</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8 max-w-3xl mx-auto lg:max-w-4xl w-full pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wide">
            <Scale className="w-4 h-4" />
            Fair Wholesale Arbitration
          </div>
          <h1 className="text-lg md:text-2xl font-bold">How Zylod Resolves Order Disputes</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Our SafePay Escrow and independent arbitration standards guarantee that you never pay for damaged, counterfeit, or short-shipped goods.
          </p>
        </div>

        {/* Timeline Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {steps.map((s, idx) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                    {s.time}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 pt-0.5">{s.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Required Evidence Checklist */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <FileCheck className="w-4 h-4 text-red-600" />
            Evidence Required to Win a Dispute
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Video className="w-3.5 h-3.5 text-red-600" />
                Unboxing Video
              </div>
              <p className="text-[11px] text-gray-500">Continuous video showing sealed shipping label and opening parcel.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Camera className="w-3.5 h-3.5 text-red-600" />
                Defect Photographs
              </div>
              <p className="text-[11px] text-gray-500">Close-ups of broken parts, missing units, or incorrect color/specs.</p>
            </div>
          </div>
        </div>

        {/* CTA: Dispute + Report */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('submit-ticket', { category: 'seller_issue' })}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition"
          >
            File Formal Dispute Claim
          </button>
          <button
            onClick={() => navigate('report-user')}
            className="px-6 py-3 bg-white border border-red-200 hover:bg-red-50 text-red-700 font-bold rounded-xl text-xs shadow-sm transition"
          >
            Report Seller Misconduct →
          </button>
        </div>
      </div>
    </div>
  )
}

export default DisputeResolutionGuidePage
