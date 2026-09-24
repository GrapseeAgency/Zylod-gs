'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Crown, Sparkles, CheckCircle2,
  ShieldCheck, Percent, Truck, PhoneCall, ChevronRight
} from 'lucide-react'

export function VipMembershipPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [vipData, setVipData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/vip', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setVipData(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h1 className="font-bold text-base">VIP Wholesale Club</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('membership-tiers')}
          className="h-8 text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl"
        >
          All Tiers →
        </Button>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">VIP Wholesale Club</h1>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24">
        {/* VIP Status Card */}
        <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-700 rounded-3xl p-6 text-slate-950 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-black text-amber-300 hover:bg-black uppercase tracking-widest text-[10px] font-bold px-3 py-1">
              {vipData?.currentTier || 'Standard'} Member
            </Badge>
            <Crown className="w-6 h-6 text-slate-950" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Annual Wholesale Volume</p>
            <h2 className="text-3xl font-black">{formatPrice(vipData?.totalSpendBDT ?? 0)}</h2>
            <p className="text-xs text-slate-900 font-medium">
              Cumulative purchase turnover recorded on Zylod
            </p>
          </div>
        </div>

        {/* Exclusive VIP Privileges */}
        <div className="bg-slate-800/80 rounded-3xl p-5 border border-slate-700/80 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Your VIP Enterprise Privileges
          </h3>

          <div className="space-y-3">
            {[
              { icon: Percent, title: 'Factory Direct Volume Rebate', desc: 'Automatic 2% to 8% deduction on direct mill consignments.' },
              { icon: Truck, title: 'Dedicated Fleet Dispatch', desc: 'Zero-cost return freight and priority nationwide road cargo.' },
              { icon: ShieldCheck, title: 'Documented Order Records', desc: 'Every order keeps its payment verification status and history on your account.' },
              { icon: PhoneCall, title: 'Key Account Director', desc: 'Direct WhatsApp and direct phone access to wholesale trading heads.' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => navigate('exclusive-deals')}
          className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold rounded-2xl shadow-xl text-sm sm:text-base tracking-wide"
        >
          Browse VIP Exclusive Deals 💎
        </Button>
      </div>
    </div>
  )
}

export default VipMembershipPage
