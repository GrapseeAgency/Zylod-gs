'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Crown, ShieldCheck, Percent, Truck,
  Headphones, Lock, Sparkles, ChevronRight
} from 'lucide-react'

export function VipBenefitsPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      <div className="md:hidden sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h1 className="font-bold text-base">VIP Wholesale Enterprise Club</h1>
          </div>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">VIP Wholesale Enterprise Club</h1>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-amber-400">Enterprise Procurement Privileges</h2>
          <p className="text-xs text-slate-400">
            Engineered exclusively for volume buyers and industrial manufacturing plants in Bangladesh.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              icon: Percent,
              title: 'Direct Mill Volume Rebate',
              desc: 'Up to 8% deducted from wholesale yarn, fabric, and packaging factory prices directly.',
            },
            {
              icon: ShieldCheck,
              title: 'Dedicated Quality Assurance (QA) Officers',
              desc: 'Free pre-shipment lot inspection and GSM verification at factory gates before dispatch.',
            },
            {
              icon: Truck,
              title: 'Guaranteed Road Freight Priority',
              desc: 'Dedicated covered van allocation with real-time GPS courier tracking and zero return freight fees.',
            },
            {
              icon: Headphones,
              title: '24/7 Relationship Concierge',
              desc: 'Direct hotline with Zylod executive trading desks for urgent custom sourcing.',
            },
          ].map(b => (
            <div key={b.title} className="bg-slate-800/90 border border-slate-700 rounded-3xl p-5 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
                  <b.icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">{b.title}</h3>
              </div>
              <p className="text-xs text-slate-400 pl-13 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>

        <Button
          onClick={() => navigate('exclusive-deals')}
          className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl text-sm"
        >
          View Exclusive Mill Deals →
        </Button>
      </div>
    </div>
  )
}

export default VipBenefitsPage
