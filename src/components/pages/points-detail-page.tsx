'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Coins
} from 'lucide-react'

export function PointsDetailPage() {
  const { navigate, goBack } = useNavigationStore()

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Points System Rules</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:pb-8 md:px-6 lg:max-w-4xl">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-gray-900 dark:text-gray-100">How Points Work on Zylod</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">10 Points = ৳1.00 BDT Standard Ratio</p>
            </div>
          </div>

          <div className="space-y-3 text-xs md:text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
            <div className="space-y-1">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">1. Earning Formula</h3>
              <p>Every confirmed B2B order earns 1 Point for every ৳100 spent. Gamified check-ins and lucky wheel spins award up to 500 bonus points.</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">2. Validity &amp; Expiry</h3>
              <p>Loyalty points remain valid for 12 months from the date of earning. Unused points expire on rolling annual cycles.</p>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">3. Non-Transferable</h3>
              <p>Points are locked to your verified merchant account and cannot be transferred to third-party accounts.</p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => navigate('redeem-points')}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs"
            >
              Go to Points Redemption Center
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PointsDetailPage
