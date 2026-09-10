'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Coins, TrendingUp, TrendingDown,
  Clock, Filter, Gift
} from 'lucide-react'

export function PointsHistoryPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [activeType, setActiveType] = useState<string>('')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const query = activeType ? `?type=${activeType}` : ''
      const res = await fetch(`/api/rewards/history${query}`, { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setTransactions(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token, activeType])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-gray-900 text-base">Points Transaction Ledger</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('redeem-points')}
          className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
        >
          Redeem
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 md:px-6">
        {[
          { key: '', label: 'All Transactions' },
          { key: 'earn', label: 'Points Earned' },
          { key: 'redeem', label: 'Redemptions' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveType(tab.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeType === tab.key
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 px-4 py-4 max-w-xl mx-auto w-full space-y-3 pb-24 md:pb-8 md:px-6 md:max-w-3xl lg:max-w-5xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-2">
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-3 w-1/4 rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-gray-500 space-y-2">
            <Coins className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="font-bold text-sm text-gray-800">No point transactions found</p>
            <p className="text-xs">Earn points by making purchases or completing daily activities.</p>
          </div>
        ) : (
          <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
          {transactions.map(trx => {
            const isEarn = trx.type === 'earn'
            return (
              <div
                key={trx.id}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isEarn ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {isEarn ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {trx.description || (isEarn ? 'Points Earned' : 'Points Redeemed')}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(trx.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                <span className={`text-sm font-extrabold flex-shrink-0 ${
                  isEarn ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {isEarn ? `+${trx.points}` : trx.points} Pts
                </span>
              </div>
            )
          })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PointsHistoryPage
