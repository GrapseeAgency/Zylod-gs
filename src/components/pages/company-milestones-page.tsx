'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Milestone, Star, Rocket, Users, Package, Globe, Award, Building2, TrendingUp,
} from 'lucide-react'

interface MilestoneRow {
  id: string
  year: number
  month: number | null
  title: string
  description: string
  iconType: string | null
  sortOrder: number
  isPublished: boolean
  createdAt: string
}

/** The eight glyphs the admin console offers; anything else renders the honest Star default. */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  rocket: Rocket,
  users: Users,
  package: Package,
  globe: Globe,
  award: Award,
  building: Building2,
  trending: TrendingUp,
}

function milestoneIcon(iconType: string | null | undefined) {
  return ICON_MAP[iconType ?? ''] ?? Star
}

function monthLabel(month: number | null) {
  if (!month || month < 1 || month > 12) return ''
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' })
}

export function CompanyMilestonesPage() {
  const { navigate, goBack } = useNavigationStore()
  const [milestones, setMilestones] = useState<MilestoneRow[]>([])
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Zylod Journey &amp; Milestones</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">Real Milestones, Published As They Happen</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-3xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : milestones.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm text-center space-y-2">
            <div className="w-14 h-14 rounded-3xl bg-blue-50 flex items-center justify-center mx-auto">
              <Milestone className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">No milestones published yet</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed max-w-sm mx-auto">
              Milestones will be posted here as the platform grows — only real, verifiable ones.
              Zylod does not invent dates or achievements to look established.
            </p>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-blue-100">
            {milestones.map(m => {
              const Icon = milestoneIcon(m.iconType)
              const month = monthLabel(m.month)
              return (
                <div key={m.id} className="relative flex items-start gap-4 pl-1">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 ring-white z-10 shadow-sm flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-3xl p-4.5 border border-gray-100 dark:border-gray-800 shadow-sm flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs md:text-sm font-bold text-gray-900 dark:text-gray-100">{m.title}</h3>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold shrink-0">
                        {month ? `${month} ${m.year}` : m.year}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed">{m.description}</p>
                  </div>
                </div>
              )
            })}
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
