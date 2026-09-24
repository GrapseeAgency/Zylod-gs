'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, ShieldCheck, Lock, CheckCircle2, AlertTriangle,
  Award, Eye, FileText, ChevronRight, ShieldAlert
} from 'lucide-react'

interface SafetyTip {
  id: string
  category: string
  titleEn: string
  titleBn: string
  descriptionEn: string
  descriptionBn: string
  importance: string
}

export function SafetyCenterPage() {
  const { navigate, goBack } = useNavigationStore()
  const [tips, setTips] = useState<SafetyTip[]>([])
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<'en' | 'bn'>('en')

  useEffect(() => {
    fetch('/api/support/safety-tips')
      .then(res => res.json())
      .then(data => setTips(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const safetyPillars = [
    {
      title: 'Payment Verification',
      desc: 'An order stays UNPAID and does not reach the supplier until Zylod verifies your payment.',
      icon: Lock,
      page: 'escrow-protection-guide',
    },
    {
      title: 'Verified Supplier Badges',
      desc: 'Trade license, NID, and bank statements verified by our compliance team.',
      icon: Award,
      page: 'seller-verification-guide',
    },
    {
      title: 'Report Problems Early',
      desc: 'Test goods, count units, and report anything defective to support right away — every report is reviewed by the Zylod team.',
      icon: Eye,
      page: 'dispute-resolution-guide',
    },
    {
      title: 'Strict Anti-Fraud Shield',
      desc: 'Zero tolerance for counterfeit products or off-platform payment schemes.',
      icon: ShieldAlert,
      page: 'community-guidelines',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Hero Header */}
      <div className="bg-slate-900 text-white px-4 pt-4 pb-8 rounded-b-3xl shadow-lg md:px-6 md:pt-6 md:pb-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <button onClick={goBack} className="md:hidden p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="font-semibold text-sm sm:text-base">Zylod Trust & Safety Center</span>
          <button
            onClick={() => setLanguage(l => l === 'en' ? 'bn' : 'en')}
            className="px-2.5 py-1 bg-white/10 text-xs font-semibold rounded-full hover:bg-white/20 transition"
          >
            {language === 'en' ? 'বাংলা' : 'EN'}
          </button>
        </div>

        <div className="max-w-md mx-auto text-center space-y-2">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Wholesale Security & Trust</h1>
          <p className="text-xs text-slate-300">
            How we protect buyers, manufacturers, and transactions across Bangladesh
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-3xl mx-auto w-full pb-24 md:px-6 md:py-8 md:pb-10 lg:max-w-5xl">
        {/* 4 Pillars of Protection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {safetyPillars.map((p, idx) => {
            const Icon = p.icon
            return (
              <motion.button
                key={p.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(p.page)}
                className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-red-200 transition text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-2.5 group-hover:bg-red-600 group-hover:text-white transition">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-gray-900 group-hover:text-red-600 transition">{p.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{p.desc}</p>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-red-600 mt-3">
                  Read Policy <ChevronRight className="w-3 h-3" />
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Essential Safety Guidelines */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Safety Rules for Wholesale Buyers
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {tips.map((tip, idx) => (
                <div key={tip.id} className="p-3.5 bg-slate-50 rounded-2xl border border-gray-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-900">
                      {language === 'bn' ? tip.titleBn : tip.titleEn}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {tip.importance}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {language === 'bn' ? tip.descriptionBn : tip.descriptionEn}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report Suspicious Activity CTA */}
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-sm font-bold text-red-900">Spotted a Suspicious Seller or Scam?</p>
            <p className="text-xs text-red-700">
              Help keep the marketplace clean by reporting off-platform payment solicitations.
            </p>
          </div>
          <button
            onClick={() => navigate('report-user')}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition flex-shrink-0"
          >
            Report Violation
          </button>
        </div>
      </div>
    </div>
  )
}

export default SafetyCenterPage
