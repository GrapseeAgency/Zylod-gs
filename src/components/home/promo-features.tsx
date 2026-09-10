'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Scissors,
  Globe,
  Clock,
  Zap,
} from 'lucide-react'

/* ─── Color Constants ─── */

const BLUE = '#1976D2'

const PROMO_FEATURES = [
  { icon: Scissors, title: 'Daily Deals', color: 'primary', desc: 'Bulk discounts on selected items' },
  { icon: Globe, title: 'Cross-border', color: BLUE, desc: 'International sourcing made easy' },
  { icon: Clock, title: 'Flash Sale', color: 'primary', desc: 'Limited time bulk offers' },
  { icon: Zap, title: 'Lightning Deal', color: 'primary', desc: 'Deep-discount bulk deals' },
]

export function PromoFeatures() {
  const { setCurrentPage } = useNavigationStore()

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {PROMO_FEATURES.map((feature, i) => {
        const IconComp = feature.icon
        return (
          <div
            key={i}
            className="bg-card rounded-lg border border-gray-100 p-3.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            onClick={() => {
              if (feature.title === 'Daily Deals') setCurrentPage('daily-deals')
              else if (feature.title === 'Cross-border') setCurrentPage('cross-border')
              else if (feature.title === 'Flash Sale') setCurrentPage('flash-sale')
              else setCurrentPage('factory-direct')
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ background: `${feature.color}10` }}
              >
                <IconComp className="h-5 w-5" style={{ color: feature.color }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: feature.color }}>{feature.title}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{feature.desc}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
