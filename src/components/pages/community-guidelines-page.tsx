'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, BookOpen, ShieldCheck, AlertOctagon, Scale,
  CheckCircle2, Ban, ChevronRight, FileText
} from 'lucide-react'

export function CommunityGuidelinesPage() {
  const { navigate, goBack } = useNavigationStore()

  const guidelines = [
    {
      title: '1. Transparent Wholesale Listings',
      desc: 'All products must accurately reflect actual factory specifications, unit dimensions, materials, and available warehouse inventory. False claims on certifications (ISO, CE) are strictly penalized.',
      icon: CheckCircle2,
    },
    {
      title: '2. Zero Off-Platform Transactions',
      desc: 'Asking buyers for direct bKash transfers, personal bank deposits, or cash handovers outside Zylod SafePay is grounds for permanent supplier suspension and legal blacklisting.',
      icon: Ban,
    },
    {
      title: '3. Respectful B2B Communication',
      desc: 'All negotiation, customer queries, and dispute arbitration conversations must remain professional. Threatening, abusive, or coercive language leads to instant account deactivation.',
      icon: Scale,
    },
    {
      title: '4. Genuine Reviews & Rating Integrity',
      desc: 'Review manipulation, paid ratings, or retaliatory negative feedback is prohibited. All reviews must represent genuine completed wholesale order experiences.',
      icon: ShieldCheck,
    },
    {
      title: '5. Fast Dispatch & Courier SLA',
      desc: 'Suppliers must confirm and dispatch orders within the agreed lead time (standard: 48 hours for ready stock). Unreasonable order cancellations harm seller ranking score.',
      icon: BookOpen,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Community Guidelines</span>
        </div>
        <button
          onClick={() => navigate('docs-browser')}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          All Policies
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8 max-w-3xl mx-auto lg:max-w-4xl w-full pb-24 md:pb-8">
        {/* Intro */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-red-600 text-xs font-bold uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            Bangladesh Wholesale Code of Conduct
          </div>
          <h1 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900">
            Rules for Fair, Safe, and Professional B2B Trade
          </h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            Zylod is committed to fostering trust among manufacturers, wholesale distributors, and retail business owners across Bangladesh. By using our platform, all members agree to uphold these standards in accordance with the Digital Commerce Guidelines (ডিজিটাল কমার্স পরিচালনা নির্দেশিকা).
          </p>
        </div>

        {/* Guidelines List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {guidelines.map((g, idx) => {
            const Icon = g.icon
            return (
              <motion.div
                key={g.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-900">{g.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{g.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Prohibited Items Link */}
        <div
          onClick={() => navigate('prohibited-items')}
          className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-3xl p-5 flex items-center justify-between cursor-pointer hover:border-red-300 transition"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center flex-shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Prohibited Products & Restricted Goods</h3>
              <p className="text-xs text-gray-600">Review the complete list of items banned by Bangladesh law.</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-red-600 flex-shrink-0" />
        </div>

        {/* Enforcement notice */}
        <div className="bg-slate-100 rounded-2xl p-4 text-[11px] text-gray-500 text-center leading-relaxed">
          Violations of these guidelines may result in listing removal, escrow forfeiture, supplier badge revocation, and referral to the Ministry of Commerce & Directorate of National Consumer Rights Protection (DNCRP).
        </div>
      </div>
    </div>
  )
}

export default CommunityGuidelinesPage
