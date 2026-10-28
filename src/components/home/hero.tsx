'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { HeroIntelligentSearch } from './hero-intelligent-search'

/* ════════════════════════════════════════════════════════════════════
   Hero — Intelligent Wholesale Product Search Hub
   Dedicated to products only with natural language parsing (price limits,
   wholesale MOQ constraints, sorting intent), live predictive typeahead,
   and zero-state search history & prompts.
   ════════════════════════════════════════════════════════════════════ */

const TRENDING_TAGS = ['Cotton Fabric', 'Jute Bag', 'Rice', 'Towel', 'Smartphone', 'Packaging']

export function Hero() {
  const { navigate } = useNavigationStore()

  return (
    <section
      aria-label="Zylod wholesale marketplace"
      data-theme-lock="light"
      className="relative z-20 rounded-2xl"
      style={{ background: 'linear-gradient(100deg, #FFF7F7 0%, #FDF0F1 55%, #FBE9EC 100%)' }}
    >
      <div className="relative flex">
        {/* ── Left column: Intelligent Product Search & Trending Pills ── */}
        <div className="relative z-10 flex flex-col justify-center w-full max-w-[680px] py-3 md:py-4 pl-5 sm:pl-7 lg:pl-10 pr-5 sm:pr-8">
          {/* Most Advanced Intelligent Search for Products Only */}
          <HeroIntelligentSearch />

          {/* Trending pills */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Trending:</span>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => navigate('search-results', { query: tag })}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-gray-700 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-md hover:text-[#E31C3D] hover:border-red-200 active:scale-95 transition-all whitespace-nowrap border border-transparent"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
