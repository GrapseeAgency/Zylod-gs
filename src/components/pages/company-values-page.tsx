'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ShieldCheck, Zap, Scale, HeartHandshake, Eye, Sparkles } from 'lucide-react'

export function CompanyValuesPage() {
  const { navigate, goBack } = useNavigationStore()

  const values = [
    {
      title: 'Direct Factory Transparency',
      desc: 'No ghost suppliers or inflated retail markups. Every factory is physically visited, trade verified, and priced at factory-gate rates.',
      icon: Eye,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Uncompromised Escrow Security',
      desc: 'We treat merchant working capital with sacred fiduciary care. SafePay Escrow guarantees that suppliers get paid on time and buyers receive the exact quality ordered.',
      icon: ShieldCheck,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Speed & Operational Excellence',
      desc: 'Wholesale retail runs on inventory turnover. Our 48-72h dispatch guarantee ensures shopkeepers never miss seasonal demand.',
      icon: Zap,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      title: 'Win-Win Commercial Fairness',
      desc: 'We succeed only when local manufacturers thrive and retail merchants expand their bottom-line margins.',
      icon: HeartHandshake,
      color: 'text-rose-600 bg-rose-50',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Zylod Core Values</h1>
          <p className="text-xs text-gray-400">Guiding Principles for South Asian B2B Trade</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {values.map(v => (
            <div key={v.title} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${v.color}`}>
                  <v.icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">{v.title}</h3>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed pl-11">{v.desc}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('about-us')} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-3">
          Back to About Us
        </Button>
      </div>
    </div>
  )
}

export default CompanyValuesPage
