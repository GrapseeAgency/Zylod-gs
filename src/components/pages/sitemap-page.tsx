'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Map, Search, ShoppingBag, Truck,
  User, Gift, Shield, Building, HelpCircle, ChevronRight
} from 'lucide-react'

interface SitemapSection {
  label: string
  pages: Array<{
    id: string
    label: string
    description: string
  }>
}

interface SitemapResponse {
  shopping: SitemapSection
  orders: SitemapSection
  account: SitemapSection
  marketing: SitemapSection
  legal: SitemapSection
  company: SitemapSection
  support: SitemapSection
}

export function SitemapPage() {
  const { navigate, goBack } = useNavigationStore()
  const [sitemap, setSitemap] = useState<SitemapResponse | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sitemap-data')
      .then(res => res.json())
      .then(res => {
        if (res.success) setSitemap(res.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const sectionIcons: Record<string, any> = {
    shopping: ShoppingBag,
    orders: Truck,
    account: User,
    marketing: Gift,
    legal: Shield,
    company: Building,
    support: HelpCircle,
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Platform Sitemap</h1>
          <p className="text-xs text-gray-400">Complete Directory of Platform Architecture</p>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Platform Sitemap</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24">
        {/* Search filter */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pages and directories..."
            className="w-full pl-9 pr-4 py-2.5 bg-white rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : !sitemap ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Sitemap is unavailable right now.</div>
        ) : (
          <div className="space-y-5">
            {Object.entries(sitemap).map(([key, section]) => {
              const Icon = sectionIcons[key] || Map
              const filteredPages = search.trim()
                ? section.pages.filter(
                    p =>
                      p.label.toLowerCase().includes(search.toLowerCase()) ||
                      p.description.toLowerCase().includes(search.toLowerCase())
                  )
                : section.pages

              if (filteredPages.length === 0) return null

              return (
                <div
                  key={key}
                  className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3"
                >
                  <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3">
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{section.label}</h3>
                      <p className="text-[11px] text-gray-400">{filteredPages.length} active routes</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {filteredPages.map(page => (
                      <button
                        key={page.id}
                        onClick={() => navigate(page.id)}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition text-left group"
                      >
                        <div>
                          <p className="text-xs font-bold text-gray-800 group-hover:text-blue-600 transition">
                            {page.label}
                          </p>
                          <p className="text-[11px] text-gray-400">{page.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 transition flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default SitemapPage
