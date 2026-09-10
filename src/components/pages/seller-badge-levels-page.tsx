'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Award, CheckCircle2, ShieldCheck, Zap,
  TrendingUp, Sparkles, Star, ChevronRight, Lock
} from 'lucide-react'

interface TierLevel {
  level: string
  name: string
  badgeColor: string
  badgeBg: string
  borderColor: string
  minSalesBDT: string
  orderFulfillmentRate: string
  minRating: string
  perks: string[]
  current?: boolean
}

const TIERS: TierLevel[] = [
  {
    level: 'Tier 1',
    name: 'Standard Wholesale Supplier',
    badgeColor: 'text-neutral-300',
    badgeBg: 'bg-neutral-800',
    borderColor: 'border-neutral-700',
    minSalesBDT: '৳0 - ৳50,000/mo',
    orderFulfillmentRate: '90%+',
    minRating: '3.5 ★',
    perks: [
      'Standard listing in search results',
      'Standard 7-day payout cycle',
      'Basic seller dashboard & analytics',
      'Standard 5% platform commission'
    ]
  },
  {
    level: 'Tier 2',
    name: 'Verified Zylod Supplier',
    badgeColor: 'text-sky-400',
    badgeBg: 'bg-sky-950/40',
    borderColor: 'border-sky-800/60',
    minSalesBDT: '৳50,000 - ৳250,000/mo',
    orderFulfillmentRate: '95%+',
    minRating: '4.2 ★',
    current: true,
    perks: [
      'Verified Supplier blue trust shield badge',
      '1.5x search ranking boost across catalog',
      '48-hour expedited payout processing',
      'Reduced 4.2% platform commission rate',
      'Priority seller chat support'
    ]
  },
  {
    level: 'Tier 3',
    name: 'Gold Star Wholesaler',
    badgeColor: 'text-amber-400',
    badgeBg: 'bg-amber-950/40',
    borderColor: 'border-amber-700/60',
    minSalesBDT: '৳250,000 - ৳1,000,000/mo',
    orderFulfillmentRate: '98%+',
    minRating: '4.6 ★',
    perks: [
      'Exclusive Gold Supplier storefront crown badge',
      'Featured on Zylod wholesale homepage & flash sales',
      'Same-day instant payout clearance',
      'Reduced 3.5% platform commission rate',
      'Dedicated B2B account growth manager',
      'Direct RFQ leads auto-assignment'
    ]
  },
  {
    level: 'Tier 4',
    name: 'Diamond Export Partner',
    badgeColor: 'text-purple-400',
    badgeBg: 'bg-purple-950/40',
    borderColor: 'border-purple-700/60',
    minSalesBDT: '৳1,000,000+/mo',
    orderFulfillmentRate: '99.5%+',
    minRating: '4.8 ★',
    perks: [
      'Diamond Tier global export badge',
      'Top search placement guarantee',
      'Zero payout fees & instant withdrawal',
      'Lowest 2.8% VIP platform commission rate',
      'Cross-border LC & Customs freight coordination',
      'Custom marketing campaigns sponsored by Zylod'
    ]
  }
]

export function SellerBadgeLevelsPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('seller-dashboard')}
            className="p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Supplier Badges & Tier Progression
            </h1>
            <p className="text-xs text-neutral-400">Unlock lower fees and premium wholesale visibility</p>
          </div>
        </div>

        <Button
          onClick={() => navigate('seller-verification')}
          className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs font-semibold h-8 px-3"
        >
          Verification Hub
        </Button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Current Tier Overview Banner */}
        <div className="bg-gradient-to-r from-sky-950/60 via-neutral-900 to-neutral-900 border border-sky-800/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs py-0.5">
                  Current Level: Tier 2
                </Badge>
                <ShieldCheck className="w-4 h-4 text-sky-400" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-neutral-100">Verified Zylod Supplier</h2>
              <p className="text-xs text-neutral-400 max-w-md">
                You are currently enjoying a 1.5x search visibility multiplier and 48-hour expedited payouts. Next target: Gold Star Wholesaler.
              </p>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 flex items-center gap-4 shrink-0">
              <div>
                <p className="text-[10px] text-neutral-400 uppercase font-semibold">Tier Progress</p>
                <p className="text-base font-bold text-amber-400">72% Completed</p>
              </div>
              <Button
                onClick={() => navigate('seller-analytics')}
                size="sm"
                className="bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200"
              >
                Track Stats
              </Button>
            </div>
          </div>
        </div>

        {/* Tier Cards Grid */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-neutral-300 uppercase tracking-wider">
            All Merchant Tier Levels & Benefits
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TIERS.map((tier, idx) => (
              <Card
                key={idx}
                className={`bg-neutral-900 border transition-all ${
                  tier.current 
                    ? 'border-sky-500 ring-1 ring-sky-500/30 shadow-sky-950/20 shadow-xl' 
                    : tier.borderColor
                }`}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">{tier.level}</span>
                      <h4 className={`text-base font-bold ${tier.badgeColor}`}>{tier.name}</h4>
                    </div>
                    {tier.current ? (
                      <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px]">
                        Active Tier
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-neutral-500 border-neutral-800 text-[10px]">
                        {idx > 1 ? 'Locked' : 'Unlocked'}
                      </Badge>
                    )}
                  </div>

                  {/* Requirements Row */}
                  <div className="grid grid-cols-3 gap-2 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800/80 text-center">
                    <div>
                      <p className="text-[9px] text-neutral-500 font-semibold uppercase">Min Volume</p>
                      <p className="text-xs font-bold text-neutral-200">{tier.minSalesBDT}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-500 font-semibold uppercase">Fulfillment</p>
                      <p className="text-xs font-bold text-emerald-400">{tier.orderFulfillmentRate}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-500 font-semibold uppercase">Rating</p>
                      <p className="text-xs font-bold text-amber-400">{tier.minRating}</p>
                    </div>
                  </div>

                  {/* Perks List */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Unlocked Privileges</p>
                    <ul className="space-y-1.5">
                      {tier.perks.map((perk, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-2 text-xs text-neutral-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SellerBadgeLevelsPage
