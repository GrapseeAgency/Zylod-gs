'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Award, Crown, Check, Sparkles, ChevronRight
} from 'lucide-react'

export function MembershipTiersPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [tiers, setTiers] = useState<any[]>([])
  const [currentTier, setCurrentTier] = useState('standard')

  useEffect(() => {
    fetch('/api/vip')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setTiers(data.data.tiers || [])
          setCurrentTier(data.data.currentTier || 'standard')
        }
      })
      .catch(console.error)
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <h1 className="font-bold text-gray-900 text-base">Membership Tiers</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-2xl mx-auto lg:max-w-6xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">Wholesale Volume Tiers</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Higher procurement volume automatically unlocks deeper factory discounts and extended escrow protection.
          </p>
        </div>

        {/* Tiers List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {tiers.map(tier => {
            const isCurrent = currentTier.toLowerCase() === tier.id.toLowerCase()
            return (
              <div
                key={tier.id}
                className={`bg-white rounded-3xl p-5 border shadow-sm space-y-3 transition ${
                  isCurrent ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-gray-900">{tier.name}</h3>
                      {isCurrent && (
                        <Badge className="bg-amber-500 text-white text-[10px] uppercase font-bold">
                          Your Active Tier
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Spend Threshold: <strong>{formatPrice(tier.minSpendBDT)} / year</strong>
                    </p>
                  </div>

                  <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {tier.benefits.map((b: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MembershipTiersPage
