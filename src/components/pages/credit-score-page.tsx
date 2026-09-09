'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, ShieldCheck, Award, TrendingUp,
  CheckCircle2, AlertCircle, FileText, ChevronRight,
  Loader2, Building2, Landmark, DollarSign
} from 'lucide-react'

export function CreditScorePage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()

  const [data, setData] = useState<{
    score: number
    maxScore: number
    tier: string
    riskRating: string
    repaymentTimeliness: string
    tradeHistoryLength: string
    creditUtilization: string
    factors: Array<{ name: string; impact: string; description: string }>
  }>({
    score: 750,
    maxScore: 850,
    tier: 'Tier A (Excellent Commercial)',
    riskRating: 'Low Risk',
    repaymentTimeliness: '99.4%',
    tradeHistoryLength: '5 orders recorded',
    creditUtilization: '18.5%',
    factors: [],
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadScore() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/credits/score', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setData(json.data)
        }
      } finally {
        setLoading(false)
      }
    }
    loadScore()
  }, [token])

  const scorePct = Math.round((data.score / data.maxScore) * 100)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Trade Credit Score</span>
        <button
          onClick={() => navigate('credit-limit')}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
          title="Limit"
        >
          <ShieldCheck className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg lg:max-w-4xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* Score Gauge Card */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 rounded-3xl p-6 text-white text-center shadow-2xl space-y-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">
            {data.tier}
          </span>

          <div className="py-2">
            <div className="text-5xl font-black font-mono tracking-tight text-white">
              {data.score}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Out of {data.maxScore} Commercial Rating Index
            </span>
          </div>

          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-1000"
              style={{ width: `${scorePct}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-slate-300 pt-2 border-t border-white/10">
            <span>Risk Rating: <strong className="text-emerald-400">{data.riskRating}</strong></span>
            <span>Settlement SLA: <strong className="text-white">{data.repaymentTimeliness}</strong></span>
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
        {/* Credit Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Credit Utilization</span>
            <span className="text-base font-black text-slate-900 block font-mono">{data.creditUtilization}</span>
            <span className="text-[10px] text-emerald-600 font-bold block">Optimal wholesale range</span>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Trade History</span>
            <span className="text-base font-black text-slate-900 block font-mono">{data.tradeHistoryLength}</span>
            <span className="text-[10px] text-slate-500 font-bold block">Verified fulfillment</span>
          </div>
        </div>

        {/* Credit Factors */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Credit Rating Evaluation Factors
          </h2>

          <div className="divide-y divide-slate-50 text-xs">
            {data.factors.map((f) => (
              <div key={f.name} className="py-3 flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{f.name}</span>
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      {f.impact}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
        </div>

        {/* Limit Action CTA */}
        <Button
          onClick={() => navigate('credit-limit')}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" />
          View Revolving Credit Line
        </Button>
      </main>
    </div>
  )
}

export default CreditScorePage
