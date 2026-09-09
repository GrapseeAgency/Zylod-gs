'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, Target, Zap, Smile, Coffee, Heart } from 'lucide-react'

export function CareerCulturePage() {
  const { navigate, goBack } = useNavigationStore()

  const pillars = [
    { title: 'Extreme Ownership', desc: 'No micro-management. You own projects end-to-end from technical RFC to production monitoring and metric impact.' },
    { title: 'Field Grounding', desc: 'Every product manager and engineer visits textile mills in Gazipur and Narayanganj to understand real supplier friction.' },
    { title: 'Zero Ego, High Empathy', desc: 'We debate ideas rigorously on facts and telemetry, not hierarchy or job titles.' },
    { title: 'Work-Life Balance & Flexibility', desc: 'Hybrid schedule (3 days in our Banani collaborative space, 2 days remote) with flexible working hours.' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Life & Culture at Zylod</h1>
          <p className="text-xs text-gray-400">Values that Drive Our Daily Execution</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        <div className="bg-slate-900 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-400" />
            <h2 className="font-bold text-sm">High Autonomy, High Impact</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            We are solving hard problems at the intersection of B2B fintech, bulk freight logistics, and manufacturing digitisation in Bangladesh.
          </p>
        </div>

        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {pillars.map((p, idx) => (
            <div key={p.title} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                <h3 className="text-xs font-bold text-gray-900">{p.title}</h3>
              </div>
              <p className="text-xs text-gray-600 pl-8 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('careers-page')} className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold py-3">
          Join the Team
        </Button>
      </div>
    </div>
  )
}

export default CareerCulturePage
