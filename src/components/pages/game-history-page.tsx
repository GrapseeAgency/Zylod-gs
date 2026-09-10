'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Gamepad2, Trophy, Coins, Brain, Layers, Package
} from 'lucide-react'

export function GameHistoryPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/mini-games', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setScores(data.data.recentScores || [])
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-600" />
            <h1 className="font-bold text-gray-900 text-base">Mini Games Score History</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('mini-games')}
          className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
        >
          Play Again
        </Button>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-4 pb-24 md:max-w-3xl md:px-6 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Mini Games Score History</h1>
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading your game records...</div>
        ) : scores.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-400 text-xs">
            No mini game scores submitted yet. Play trivia or puzzles to start earning points!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scores.map(s => (
            <div
              key={s.id}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 capitalize">
                    {s.gameType?.replace('_', ' ')}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Score: {s.score} • {new Date(s.playedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              <span className="text-xs font-extrabold text-indigo-600">
                +{s.pointsWon} Pts
              </span>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default GameHistoryPage
