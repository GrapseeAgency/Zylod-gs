'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Target, Eye, Award, Users,
  Sparkles, ChevronRight
} from 'lucide-react'

interface AboutData {
  stats: {
    verifiedSuppliers: number
    registeredBuyers: number
    activeProducts: number
  }
  milestones: Array<{
    id: string
    year: number
    month?: number
    title: string
    description: string
    iconType?: string
  }>
  companyInfo: {
    name: string
    hq: string
    mission: string
    vision: string
    values: Array<{ title: string; desc: string }>
  }
}

export function AboutUsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [data, setData] = useState<AboutData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/about')
      .then(res => res.json())
      .then(res => {
        if (res.success) setData(res.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">About Zylod</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">B2B Wholesale Marketplace</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-6 space-y-5 md:space-y-8 pb-24 md:pb-8 lg:max-w-4xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : !data ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Company profile unavailable right now</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">We could not load the company story. Please try again in a moment.</p>
          </div>
        ) : (
          <>
            {/* Hero Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 via-slate-100 to-slate-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 rounded-3xl p-6 text-gray-900 dark:text-white space-y-3">
              <Badge className="bg-primary/10 text-primary/60 border-primary/30 text-xs font-semibold max-w-full whitespace-normal text-center leading-relaxed">
                {data.companyInfo.hq} · B2B Wholesale Marketplace
              </Badge>
              <h2 className="text-xl md:text-2xl font-black leading-tight">
                A Wholesale Marketplace Built for Real Businesses
              </h2>
              <p className="text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
                {data.companyInfo.mission}
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="text-center">
                  <p className="text-lg md:text-2xl font-black text-primary/70">{data.stats.verifiedSuppliers.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400">Verified Suppliers</p>
                </div>
                <div className="text-center">
                  <p className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400">{data.stats.registeredBuyers.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400">Registered Buyers</p>
                </div>
                <div className="text-center">
                  <p className="text-lg md:text-2xl font-black text-amber-600 dark:text-amber-400">{data.stats.activeProducts.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400">Live Products</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400 leading-relaxed">
                These are live counts from our database. Zylod has just launched, so they start at zero — no demo or placeholder figures.
              </p>
            </div>

            {/* Quick Nav Sub-pages */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Company Links</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { label: 'Company Milestones', id: 'company-milestones' },
                  { label: 'Leadership Team', id: 'leadership-team' },
                  { label: 'Core Values', id: 'company-values' },
                  { label: 'Careers at Zylod', id: 'careers-page' },
                  { label: 'Press & Media', id: 'press-media' },
                  { label: 'Investor Relations', id: 'investor-relations' },
                ].map(link => (
                  <button
                    key={link.id}
                    onClick={() => navigate(link.id)}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-background rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-primary/5 hover:text-primary transition"
                  >
                    {link.label}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Mission & Vision */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Target className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Our Mission</h3>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
                  {data.companyInfo.mission}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Eye className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Our Vision</h3>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
                  {data.companyInfo.vision}
                </p>
              </div>
            </div>

            {/* Core Values */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Operating Values</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {data.companyInfo.values.map(val => (
                  <div key={val.title} className="p-3 bg-slate-50 dark:bg-background rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{val.title}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed">{val.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones Timeline */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Journey & Milestones</h3>
                </div>
                {data.milestones.length > 0 && (
                  <button
                    onClick={() => navigate('company-milestones')}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    View All
                  </button>
                )}
              </div>
              {data.milestones.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
                  No milestones published yet. Zylod only posts real milestones — they will appear here as the platform grows.
                </p>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-primary/10">
                  {data.milestones.slice(0, 4).map(m => (
                    <div key={m.id} className="relative flex items-start gap-3 pl-1">
                      <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center ring-4 ring-white z-10">
                        {m.year.toString().slice(-2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{m.title} ({m.year})</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{m.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => navigate('careers-page')} variant="outline" className="rounded-xl text-xs font-bold py-2.5">
                <Users className="w-4 h-4 mr-1.5" />
                Join Our Team
              </Button>
              <Button onClick={() => navigate('contact-us')} className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold py-2.5">
                Contact HQ →
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AboutUsPage
