'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Award, Rocket, Shield, Users, Star, Sparkles } from 'lucide-react'

export function CompanyMilestonesPage() {
  const { navigate, goBack } = useNavigationStore()
  const [milestones, setMilestones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/about/milestones')
      .then(res => res.json())
      .then(res => {
        if (res.success) setMilestones(res.data.milestones)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Zylod Journey & Milestones</h1>
          <p className="text-xs text-gray-400">Our Growth from 2020 to Present</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-3xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-blue-100">
            {milestones.map((m, idx) => (
              <div key={m.id} className="relative flex items-start gap-4 pl-1">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center ring-4 ring-white z-10 shadow-sm flex-shrink-0">
                  {m.year.toString().slice(-2)}
                </div>
                <div className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900">{m.title}</h3>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                      {m.year}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button onClick={() => navigate('about-us')} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-3">
          Back to About Zylod
        </Button>
      </div>
    </div>
  )
}

export default CompanyMilestonesPage
