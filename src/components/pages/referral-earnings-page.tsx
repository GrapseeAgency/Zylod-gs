'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Users, Coins, Gift, CheckCircle2, Clock
} from 'lucide-react'

export function ReferralEarningsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [refData, setRefData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/referrals', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setRefData(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600" />
            <h1 className="font-bold text-gray-900 text-base">Referral Earnings Ledger</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('referral-program')}
          className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
        >
          Share Code →
        </Button>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-3xl md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Referral Earnings Ledger</h1>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('referral-program')}
            className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
          >
            Share Code
          </Button>
        </div>
        {/* Earnings Stats */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-3xl p-6 text-white shadow-md space-y-2">
          <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Total Referral Reward Points</p>
          <h2 className="text-3xl md:text-4xl font-black">+{refData?.totalPointsEarned ?? 0} Pts</h2>
          <p className="text-xs text-indigo-100">
            Earned from {refData?.successfulReferrals ?? 0} verified business onboarding events.
          </p>
        </div>

        {/* Referred Users List */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 md:col-span-2">
            Invited Merchants ({refData?.referralHistory?.length ?? 0})
          </h3>

          {!refData?.referralHistory?.length ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-400 text-xs">
              No colleagues have registered with your invite code yet.
            </div>
          ) : (
            refData.referralHistory.map((item: any) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">
                      {item.referredUser?.email ? item.referredUser.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Verified Merchant'}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Joined {new Date(item.createdAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  +500 Pts Credited
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ReferralEarningsPage
