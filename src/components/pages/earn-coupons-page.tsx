'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Sparkles, Gift, CheckCircle2,
  Users, ShoppingBag, Star, Flame, ChevronRight
} from 'lucide-react'

interface Task {
  id: string
  type: string
  title: string
  description: string
  rewardLabel: string
  rewardBDT: number
  iconColor: string
}

export function EarnCouponsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coupons/earn')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setTasks(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleCompleteTask = async (task: Task) => {
    try {
      setCompletingId(task.id)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/coupons/earn', {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskId: task.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert(`Congratulations! You earned ${task.rewardLabel}! The voucher has been added to your vault.`)
        navigate('my-coupons')
      } else {
        alert(data.error || 'Failed to complete task')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCompletingId(null)
    }
  }

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'first_order': return <ShoppingBag className="w-5 h-5 text-blue-600" />
      case 'review_photo': return <Star className="w-5 h-5 text-emerald-600" />
      case 'referral': return <Users className="w-5 h-5 text-amber-600" />
      case 'checkin': return <Flame className="w-5 h-5 text-purple-600" />
      default: return <Sparkles className="w-5 h-5 text-red-600" />
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-gray-900 text-base">Earn Free Vouchers</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('my-coupons')}
          className="h-8 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl"
        >
          My Vault
        </Button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-3xl mx-auto lg:max-w-5xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Desktop Page Header */}
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Earn Free Vouchers</h1>
          <Button
            size="sm"
            onClick={() => navigate('my-coupons')}
            className="h-9 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl"
          >
            My Vault
          </Button>
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-3xl p-6 text-white shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-100">
            <Gift className="w-4 h-4 text-amber-200" />
            Wholesale Merchant Rewards
          </div>
          <h2 className="text-base sm:text-lg md:text-2xl font-bold">Complete Business Milestones to Earn Vouchers</h2>
          <p className="text-xs text-amber-100">
            Unlock exclusive discounts for order placements, verifying packaging quality, and inviting retailers.
          </p>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
            Available Tasks ({tasks.length})
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {tasks.map(task => (
              <div
                key={task.id}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-4 hover:border-amber-200 transition"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    {getTaskIcon(task.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{task.title}</h3>
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px] flex-shrink-0">
                        {task.rewardLabel}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{task.description}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={completingId === task.id}
                  onClick={() => handleCompleteTask(task)}
                  className="h-8 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex-shrink-0 shadow-sm"
                >
                  {completingId === task.id ? 'Claiming...' : 'Claim'}
                </Button>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EarnCouponsPage
