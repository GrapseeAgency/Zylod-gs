'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { soundEffects } from '@/lib/sound-effects'
import {
  ArrowLeft, Sparkles, Trophy, History,
  Gift, RefreshCw, Star, CheckCircle2
} from 'lucide-react'

const PRIZES = [
  { label: '৳100 Voucher', color: '#EF4444' },
  { label: '50 Points', color: '#3B82F6' },
  { label: '৳250 Off', color: '#10B981' },
  { label: 'Free Cargo', color: '#F59E0B' },
  { label: '200 Points', color: '#8B5CF6' },
  { label: '৳500 VIP', color: '#EC4899' },
  { label: '500 Points', color: '#6366F1' },
]

export function SpinWinPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [spinning, setSpinning] = useState(false)
  const [spinsRemaining, setSpinsRemaining] = useState(3)
  const [wonPrize, setWonPrize] = useState<any>(null)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/rewards/spin-history', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSpinsRemaining(data.spinsRemaining ?? 3)
        }
      })
      .catch(console.error)
  }, [token])

  const handleSpin = async () => {
    if (spinning || spinsRemaining <= 0) return

    try {
      setSpinning(true)
      setWonPrize(null)
      soundEffects.playByName('chime')

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/rewards/spin', { method: 'POST', headers })
      const data = await res.json()

      if (res.ok && data.success) {
        const segIdx = data.data.segmentIndex || 0
        const segmentAngle = 360 / PRIZES.length
        // Calculate target rotation (at least 5 full rotations + segment offset)
        const targetAngle = 360 * 5 + (PRIZES.length - 1 - segIdx) * segmentAngle + segmentAngle / 2
        setRotation(prev => prev + targetAngle)

        setTimeout(() => {
          setWonPrize(data.data.prize)
          setSpinsRemaining(data.data.spinsRemaining)
          setSpinning(false)
          soundEffects.playByName('default')
        }, 4000)
      } else {
        alert(data.error || 'Failed to spin wheel')
        setSpinning(false)
      }
    } catch (err) {
      console.error(err)
      setSpinning(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h1 className="font-bold text-base">Lucky Spin &amp; Win</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('spin-history')}
          className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:underline"
        >
          <History className="w-3.5 h-3.5" /> Past Wins
        </button>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full flex flex-col items-center justify-center space-y-6 pb-24 md:pb-10 text-center md:max-w-2xl">
        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-amber-400 via-rose-400 to-amber-200 bg-clip-text text-transparent">
            Spin the Lucky Wheel
          </h2>
          <p className="text-xs text-slate-400">
            Guaranteed discount vouchers or loyalty points on every turn!
          </p>
        </div>

        {/* Wheel Container */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center my-4">
          {/* Wheel Pointer */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-amber-400 drop-shadow-md" />

          {/* Rotating Wheel Canvas/SVG */}
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.15, 0.9, 0.2, 1] }}
            className="w-full h-full rounded-full border-4 border-amber-400 shadow-2xl overflow-hidden relative"
            style={{
              background: `conic-gradient(
                #EF4444 0deg 51.4deg,
                #3B82F6 51.4deg 102.8deg,
                #10B981 102.8deg 154.2deg,
                #F59E0B 154.2deg 205.6deg,
                #8B5CF6 205.6deg 257.0deg,
                #EC4899 257.0deg 308.4deg,
                #6366F1 308.4deg 360deg
              )`,
            }}
          >
            {/* Inner Center Hub */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border-4 border-amber-400 flex items-center justify-center shadow-lg">
                <Star className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Won Prize Popup Card */}
        {wonPrize && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-800/90 border border-amber-500/50 rounded-3xl p-5 w-full text-center space-y-2 shadow-xl"
          >
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Trophy className="w-4 h-4" /> Prize Unlocked
            </div>
            <h3 className="text-lg font-bold text-white">{wonPrize.label}</h3>
            <p className="text-xs text-slate-300">
              Reward has been deposited into your My Coupons / Points vault!
            </p>
          </motion.div>
        )}

        {/* Spin CTA Button & Counter */}
        <div className="w-full space-y-3 pt-2">
          <Button
            onClick={handleSpin}
            disabled={spinning || spinsRemaining <= 0}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-extrabold rounded-2xl shadow-xl text-sm sm:text-base tracking-wide transition-all transform active:scale-95 disabled:opacity-50"
          >
            {spinning ? 'Spinning the Wheel...' : spinsRemaining > 0 ? `SPIN NOW (Free)` : 'No Spins Remaining Today'}
          </Button>

          <p className="text-xs font-bold text-slate-400">
            Daily Spins Left: <strong className="text-amber-400">{spinsRemaining} of 3</strong>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SpinWinPage
