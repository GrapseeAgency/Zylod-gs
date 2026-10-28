'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, History, Trophy, Sparkles, Clock, Gift
} from 'lucide-react'

export function SpinHistoryPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [spins, setSpins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/rewards/spin-history', { headers })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return null
        }
        if (!res.ok) throw new Error('Request failed')
        return res.json()
      })
      .then(data => {
        if (data && data.success && data.data) {
          setSpins(data.data)
        } else if (data && !data.success) {
          setLoadError('Could not load your spin history. Please try again later.')
        }
      })
      .catch(() => {
        setLoadError('Something went wrong while loading your spin history. Please try again later.')
      })
      .finally(() => setLoading(false))
  }, [token, isAuthenticated])

  if (sessionExpired) return <AccountGate title="Session expired" message="Your session has expired. Sign in again to view your spin history." />
  if (!loading && !isAuthenticated) return <AccountGate title="Sign in to view your spin history" message="Spin & Win history shows the prizes won on your account. Sign in to continue." />

  return (
    <div className="flex flex-col min-h-screen bg-background text-gray-900 dark:text-white">
      <div className="md:hidden sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-card transition">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h1 className="font-bold text-base">Spin &amp; Win History</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('spin-win')}
          className="h-8 text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl"
        >
          Spin Wheel 🎡
        </Button>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Spin Win History</h1>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-4 pb-24">
        {loadError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm text-center">{loadError}</div>
        )}
        {loading ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 dark:text-slate-500">Loading spin results...</div>
        ) : spins.length === 0 && !loadError ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 dark:text-slate-500 space-y-2">
            <Gift className="w-12 h-12 text-slate-700 dark:text-slate-300 mx-auto" />
            <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No spin history recorded</p>
            <p className="text-xs">Take your free daily turns on the Lucky Wheel to unlock prizes.</p>
          </div>
        ) : (
          spins.map(s => (
            <div
              key={s.id}
              className="bg-white dark:bg-card/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">{s.prizeLabel}</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {new Date(s.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
                Claimed
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SpinHistoryPage
