'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Heart, DollarSign, Laptop, Coffee, Sparkles, Umbrella, GraduationCap } from 'lucide-react'

export function CareerBenefitsPage() {
  const { navigate, goBack } = useNavigationStore()

  const benefits = [
    { title: 'Market-Leading Compensation', desc: 'Top 10th percentile benchmarked compensation in BDT with quarterly performance bonuses.', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'Equity & Stock Options', desc: 'Own a piece of South Asia’s fastest growing B2B marketplace with ESOP grants.', icon: Sparkles, color: 'text-amber-600 bg-amber-50' },
    { title: 'Comprehensive Medical Coverage', desc: 'Full hospitalization, OPD, and dental coverage for you, your spouse, and children.', icon: Heart, color: 'text-rose-600 bg-rose-50' },
    { title: 'Equipment & Workstation Stipend', desc: 'Latest Apple MacBook Pro / high-end Linux dev box + 4K dual monitor setup.', icon: Laptop, color: 'text-blue-600 bg-blue-50' },
    { title: 'Two Festival Bonuses', desc: 'Full month base salary bonuses on Eid-ul-Fitr and Eid-ul-Adha / Puja.', icon: Umbrella, color: 'text-indigo-600 bg-indigo-50' },
    { title: 'Learning & Conference Fund', desc: 'Annual $1,000 USD budget for books, online courses, and international developer conferences.', icon: GraduationCap, color: 'text-teal-600 bg-teal-50' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Perks & Benefits</h1>
          <p className="text-xs text-gray-400">Why Engineers & Operators Love Working at Zylod</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {benefits.map(b => (
            <div key={b.title} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm flex items-start gap-3.5">
              <div className={`p-2.5 rounded-2xl ${b.color} flex-shrink-0`}>
                <b.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900">{b.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('careers-page')} className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold py-3">
          Explore Open Roles
        </Button>
      </div>
    </div>
  )
}

export default CareerBenefitsPage
