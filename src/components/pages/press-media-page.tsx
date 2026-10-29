'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Newspaper, Download, Calendar, Eye,
  ChevronRight, ExternalLink, Sparkles, FolderDown
} from 'lucide-react'

interface PressRelease {
  id: string
  slug: string
  title: string
  summary: string
  category: string
  imageUrl?: string
  authorName: string
  publishedAt: string
  views: number
}

export function PressMediaPage() {
  const { navigate, goBack } = useNavigationStore()
  const [releases, setReleases] = useState<PressRelease[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/press')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setReleases(res.data.releases)
          setCategories(res.data.categories)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filteredReleases = selectedCat === 'all'
    ? releases
    : releases.filter(r => r.category === selectedCat)

  return (
    <div className="overflow-x-hidden flex flex-col min-h-screen bg-background">
      <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Press & Media Hub</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">Official News, Announcements & Media Assets</p>
          </div>
        </div>
        <button
          onClick={() => navigate('media-kit')}
          className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/5 px-2.5 py-1.5 rounded-xl border border-primary/20"
        >
          <FolderDown className="w-3.5 h-3.5" />
          Media Kit
        </button>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24 md:max-w-5xl md:px-6 md:py-8 md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Press &amp; Media Hub</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">Official News, Announcements &amp; Media Assets</p>
          </div>
          <button
            onClick={() => navigate('media-kit')}
            className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/5 px-3 py-2 rounded-xl border border-primary/20"
          >
            <FolderDown className="w-3.5 h-3.5" />
            Media Kit
          </button>
        </div>
        {/* Hero */}
        <div className="bg-gradient-to-r from-slate-100 via-slate-100 to-slate-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 rounded-3xl p-6 text-gray-900 dark:text-white space-y-3">
          <Badge className="bg-primary/10 text-primary/60 border-primary/30 text-xs">
            Corporate Newsroom
          </Badge>
          <h2 className="text-xl md:text-2xl font-black leading-tight">
            Latest Headlines & Industry Breakthroughs
          </h2>
          <p className="text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
            Stay updated with corporate milestones, funding announcements, product innovations, and strategic logistics partnerships across Bangladesh.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1 [&>button]:w-full sm:[&>button]:w-auto">
            <Button
              onClick={() => navigate('media-kit')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold py-2"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download Media Kit
            </Button>
            <Button
              onClick={() => navigate('investor-relations')}
              variant="outline"
              className="bg-black/5 dark:bg-gray-900/10 hover:bg-white dark:bg-gray-900/20 border-black/10 dark:border-white/20 text-gray-900 dark:text-white rounded-xl text-xs font-bold py-2"
            >
              Investor Relations →
            </Button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedCat === 'all'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            All News ({releases.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap capitalize transition ${
                selectedCat === cat
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Press Releases List */}
        <div className="space-y-3.5 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 md:space-y-0">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-3xl" />)}
            </div>
          ) : filteredReleases.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 text-center text-gray-400 dark:text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800">
              No press releases found in this category.
            </div>
          ) : (
            filteredReleases.map(pr => (
              <div
                key={pr.id}
                onClick={() => navigate('press-release-detail', { slug: pr.slug })}
                className="bg-white dark:bg-gray-900 rounded-3xl p-4.5 border border-gray-100 dark:border-gray-800 shadow-sm hover:border-primary/40 hover:shadow-md transition cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <Badge className="bg-primary/5 text-primary border-primary/30 text-[10px] font-bold uppercase">
                      {pr.category.replace('_', ' ')}
                    </Badge>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                      {pr.title}
                    </h3>
                  </div>
                  {pr.imageUrl && (
                    <img
                      src={pr.imageUrl}
                      alt={pr.title}
                      className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-gray-100 dark:border-gray-800"
                    />
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-2 leading-relaxed">
                  {pr.summary}
                </p>

                <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-50">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(pr.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs font-bold text-primary flex items-center gap-0.5">
                    Read Release <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default PressMediaPage
