'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Gamepad2, Trophy, Coins, Brain, Layers, Package
} from 'lucide-react'

export function GameHistoryPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Deep links can mount before the boot session probe settles — keep loading briefly.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !token) return
    fetch('/api/mini-games', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json().catch(() => null))
      .then(data => {
        if (data?.success && data.data) {
          setScores(data.data.recentScores || [])
        } else {
          setLoadError('Could not load your game history right now — please try again later.')
        }
      })
      .catch(() => {
        setLoadError('Network error while loading your game history. Check your connection and retry.')
      })
      .finally(() => setLoading(false))
  }, [token, isAuthenticated])

  if (sessionExpired) {
    return (
      <AccountGate
        title="Session expired"
        message="Your session has expired. Sign in again to see your real mini game scores."
      />
    )
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view game history"
        message="Score history shows your real mini game plays and points. Sign in to continue."
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Mini Games Score History</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('mini-games')}
          className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-xl"
        >
          Play Again
        </Button>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-4 pb-24 md:max-w-3xl md:px-6 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 dark:text-gray-100">Mini Games Score History</h1>
        {loading ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 dark:text-gray-400">Loading your game records...</div>
        ) : loadError ? (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 text-xs text-red-700 dark:text-red-300">
            {loadError}
          </div>
        ) : scores.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">
            No mini game scores submitted yet. Play trivia or puzzles to start earning points!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scores.map(s => (
            <div
              key={s.id}
              className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 capitalize">
                    {s.gameType?.replace('_', ' ')}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400">
                    Score: {s.score} • {new Date(s.playedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              <span className="text-xs font-extrabold text-primary">
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
