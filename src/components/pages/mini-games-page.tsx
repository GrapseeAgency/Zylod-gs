'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { soundEffects } from '@/lib/sound-effects'
import {
  ArrowLeft, Gamepad2, Trophy, Sparkles, Brain,
  Layers, Package, Star, Play, History, CheckCircle2
} from 'lucide-react'

export function MiniGamesPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [games, setGames] = useState<any[]>([])
  const [recentScores, setRecentScores] = useState<any[]>([])
  const [activeGame, setActiveGame] = useState<string | null>(null)
  const [playingScore, setPlayingScore] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/mini-games', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setGames(data.data.games || [])
          setRecentScores(data.data.recentScores || [])
        }
      })
      .catch(console.error)
  }, [token])

  const handlePlayTrivia = async () => {
    setActiveGame('wholesale_trivia')
    setPlayingScore(85) // Simulates answering 85% correct answers in quiz
  }

  const handleSubmitScore = async (gameType: string, score: number) => {
    try {
      setSubmitting(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/mini-games', {
        method: 'POST',
        headers,
        body: JSON.stringify({ gameType, score }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        soundEffects.playByName('chime')
        alert(`Game Complete! You scored ${score} and earned +${data.data.pointsWon} loyalty points!`)
        setActiveGame(null)
        navigate('loyalty-points')
      } else {
        alert(data.error || 'Failed to submit score')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
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
            <Gamepad2 className="w-5 h-5 text-indigo-600" />
            <h1 className="font-bold text-gray-900 text-base">Gamified Rewards</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('game-history')}
          className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
        >
          <History className="w-3.5 h-3.5" /> High Scores
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-5xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-6 text-white shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-200">
            <Sparkles className="w-4 h-4 text-amber-300" /> Play &amp; Earn Wholesale Points
          </div>
          <h2 className="text-base sm:text-lg font-bold">Interactive Factory &amp; Logistics Mini Games</h2>
          <p className="text-xs text-purple-100">
            Test your manufacturing knowledge, solve cargo sorting puzzles, and score points redeemable for real order discounts.
          </p>
        </div>

        {/* Active Game Modal / Container */}
        {activeGame && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 border-2 border-indigo-500 shadow-xl space-y-4 text-center max-w-xl mx-auto"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <Brain className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">B2B Wholesale Master Quiz</h3>
              <p className="text-xs text-gray-500">
                You answered 8 out of 10 textile HS code and customs questions correctly!
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100 space-y-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Quiz Score</span>
              <p className="text-3xl font-black text-indigo-600">85 / 100</p>
              <p className="text-xs font-bold text-emerald-600">+170 Loyalty Points Available</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveGame(null)}
                className="w-1/2 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSubmitScore('wholesale_trivia', 85)}
                disabled={submitting}
                className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                {submitting ? 'Claiming...' : 'Claim Points'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Games List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
            Available Games
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {games.map(g => (
              <div
                key={g.id}
                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center justify-between gap-4 hover:border-indigo-300 transition"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                    style={{ backgroundColor: g.color || '#4F46E5' }}
                  >
                    {g.id === 'wholesale_trivia' ? <Brain className="w-5 h-5" /> : g.id === 'memory_match' ? <Layers className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{g.title}</h4>
                      <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-100 text-[10px]">
                        {g.reward}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{g.desc}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handlePlayTrivia}
                  className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex-shrink-0 gap-1 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Play
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MiniGamesPage
