'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { soundEffects } from '@/lib/sound-effects'
import {
  ArrowLeft, Flame, CheckCircle2, Gift,
  Calendar, Sparkles, Trophy, ChevronRight
} from 'lucide-react'

export function DailyCheckinPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [checkedInToday, setCheckedInToday] = useState(false)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [schedule, setSchedule] = useState<number[]>([50, 75, 100, 150, 200, 300, 500])
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  const fetchCheckinStatus = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/rewards/checkin', { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setCheckedInToday(data.data.checkedInToday)
        setCurrentStreak(data.data.currentStreak)
        if (data.data.schedule) setSchedule(data.data.schedule)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchCheckinStatus()
  }, [fetchCheckinStatus])

  const handleCheckin = async () => {
    try {
      setCheckingIn(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/rewards/checkin', { method: 'POST', headers })
      const data = await res.json()

      if (res.ok && data.success) {
        setCheckedInToday(true)
        setCurrentStreak(data.data.streakCount)
        soundEffects.playByName('chime')
        alert(`Checked in! You earned +${data.data.pointsAwarded} loyalty points.`)
      } else {
        alert(data.error || 'Failed to check in')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h1 className="font-bold text-gray-900 text-base">Daily Check-in</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('checkin-streak')}
          className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-0.5"
        >
          Streak Milestones →
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl lg:max-w-4xl mx-auto w-full space-y-6 pb-24 md:pb-8">
        {/* Streak Highlight Card */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 rounded-3xl p-6 text-white shadow-md text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto flex items-center justify-center shadow-inner">
            <Flame className="w-8 h-8 text-amber-200 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-amber-100 uppercase tracking-widest">Active Streak</p>
            <h2 className="text-3xl md:text-4xl font-black">{currentStreak} Days In A Row</h2>
          </div>
          <p className="text-xs text-amber-100 max-w-xs mx-auto">
            Check in every consecutive day to multiply your wholesale point rewards up to 500 points on Day 7.
          </p>
        </div>

        {/* 7-Day Schedule Grid */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              7-Day Reward Ladder
            </h3>
            <span className="text-xs font-bold text-orange-600">Cycle Resets Day 7</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-3">
            {schedule.map((pts, idx) => {
              const dayNum = idx + 1
              const isPastOrToday = dayNum <= currentStreak && checkedInToday
              const isToday = dayNum === currentStreak + 1 || (dayNum === currentStreak && !checkedInToday)

              return (
                <div
                  key={dayNum}
                  className={`p-3 rounded-2xl border text-center space-y-1.5 transition ${
                    isPastOrToday
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : isToday
                        ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm scale-105'
                        : 'bg-slate-50 border-gray-100 text-gray-500'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase">Day {dayNum}</p>
                  <p className="text-xs font-extrabold">+{pts}</p>
                  {isPastOrToday ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                  ) : (
                    <Gift className="w-4 h-4 text-gray-400 mx-auto" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Check-in Action */}
        <div className="space-y-3 pt-2 lg:max-w-xl lg:w-full lg:mx-auto">
          <Button
            onClick={handleCheckin}
            disabled={checkedInToday || checkingIn}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg text-sm transition-transform active:scale-95 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {checkedInToday ? 'Checked in Today (Come back tomorrow)' : checkingIn ? 'Claiming Points...' : 'Claim Today’s Check-in Points'}
          </Button>

          <p className="text-center text-xs text-gray-400">
            Points can be converted into discount vouchers or wallet funds in the Redeem center.
          </p>
        </div>
      </div>
    </div>
  )
}

export default DailyCheckinPage
