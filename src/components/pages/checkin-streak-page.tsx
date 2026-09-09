'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Flame, Calendar, Trophy, CheckCircle2, Gift
} from 'lucide-react'

export function CheckinStreakPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [history, setHistory] = useState<any[]>([])
  const [currentStreak, setCurrentStreak] = useState(0)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/rewards/checkin', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setCurrentStreak(data.data.currentStreak || 0)
          setHistory(data.data.history || [])
        }
      })
      .catch(console.error)
  }, [token])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 md:px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h1 className="font-bold text-gray-900 text-base md:text-lg">Streak Milestones &amp; Logs</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('daily-checkin')}
          className="h-8 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
        >
          Check-in Now
        </Button>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6 max-w-xl lg:max-w-4xl mx-auto w-full space-y-6 pb-24 md:pb-8">
        {/* Streak summary */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm text-center space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Consecutive Streak</p>
          <h2 className="text-4xl font-black text-orange-600">{currentStreak} Days</h2>
          <p className="text-xs text-gray-500">
            Keep opening Zylod daily without breaking the chain to maximize bonus payouts.
          </p>
        </div>

        {/* Checkin Log History */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
            Recent Check-in Ledger
          </h3>

          {history.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-400 text-xs">
              No previous check-in records found. Start today!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map(item => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Day {item.streakCount} Streak Milestone</p>
                      <p className="text-[10px] text-gray-400">{item.checkinDate}</p>
                    </div>
                  </div>

                  <span className="text-xs font-extrabold text-orange-600">
                    +{item.pointsAwarded} Pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckinStreakPage
