'use client'

/**
 * EarnCouponsPage — the buyer side of the Task 111 reward rail.
 * The server PROVES each task from the buyer's real rows before a voucher
 * exists, so this page shows the honest progress (count / required), the
 * claimed state, and the server's own refusal wording — no blind Claim
 * button, no alert() popups (house toasts), no fake success.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  ArrowLeft, Sparkles, Gift, CheckCircle2,
  ShoppingBag, Star, Heart, Package, Milestone, Flame, LogIn,
} from 'lucide-react'

interface Task {
  id: string
  type: string
  title: string
  description: string
  rewardLabel: string
  rewardBDT: number
  iconColor: string
  targetCount?: number
  claimed?: boolean
  progress?: { count: number; required: number; met: boolean }
}

const TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  first_order: ShoppingBag,
  review: Star,
  wishlist: Heart,
  bulk: Package,
  milestone: Milestone,
  spin: Sparkles,
  checkin: Flame,
}

export function EarnCouponsPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [completingId, setCompletingId] = useState<string | null>(null)

  // Deep links can mount before the boot session probe settles — keep loading briefly.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  const loadTasks = useCallback(async () => {
    if (!isAuthenticated || !token) return
    try {
      const res = await fetch('/api/coupons/earn', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (!res.ok || !data?.success) {
        setLoadError(data?.error || `Could not load reward tasks (HTTP ${res.status}).`)
        return
      }
      setLoadError('')
      setTasks(data.data || [])
    } catch (err) {
      console.error(err)
      setLoadError('Network error while loading reward tasks. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }, [token, isAuthenticated])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCompleteTask = async (task: Task) => {
    if (!token) {
      toast.error('Sign in to claim rewards — vouchers are personal')
      navigate('login')
      return
    }
    try {
      setCompletingId(task.id)
      const res = await fetch('/api/coupons/earn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId: task.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Reward unlocked: ${task.rewardLabel} — the voucher is in your vault`)
        await loadTasks()
      } else {
        toast.error(data.error || 'Could not claim this reward')
      }
    } catch (err) {
      console.error(err)
      toast.error('Could not reach the rewards service')
    } finally {
      setCompletingId(null)
    }
  }

  const getTaskIcon = (type: string) => {
    const Icon = TASK_ICONS[type] ?? Sparkles
    return <Icon className="w-5 h-5 text-red-600" />
  }

  if (sessionExpired) {
    return (
      <AccountGate
        title="Session expired"
        message="Your session has expired. Sign in again to see your real reward progress and vouchers."
      />
    )
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to earn vouchers"
        message="Rewards are verified against your real account activity — sign in to see your actual progress and claim vouchers."
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Earn Free Vouchers</h1>
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">Earn Free Vouchers</h1>
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
            Every reward is verified against your real account activity — orders placed, reviews written, check-ins kept — before the voucher lands in your vault.
          </p>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
            Available Tasks ({tasks.length})
          </h2>

          {!loading && loadError && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-3 text-xs text-red-700 dark:text-red-300">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 animate-pulse space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-10 text-center">
              <Gift className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No reward tasks are live right now</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">Check back soon — new ways to earn are added by the platform team.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {tasks.map(task => {
              const target = task.targetCount ?? 1
              const prog = task.progress
              const claimed = task.claimed === true
              return (
                <div
                  key={task.id}
                  className={`bg-white dark:bg-gray-900 rounded-2xl p-4 border shadow-sm flex items-center justify-between gap-4 transition ${
                    claimed ? 'border-green-200' : 'border-gray-100 dark:border-gray-800 hover:border-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-background border border-gray-100 dark:border-gray-800 flex items-center justify-center flex-shrink-0">
                      {getTaskIcon(task.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">{task.title}</h3>
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px] flex-shrink-0">
                          {task.rewardLabel}
                        </Badge>
                        {claimed && (
                          <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                            Claimed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-2 mt-0.5">{task.description}</p>
                      {prog && !claimed && target > 1 && (
                        <div className="mt-2 space-y-1">
                          <Progress value={Math.min(100, Math.round((prog.count / target) * 100))} className="h-1.5" aria-label={`Progress ${prog.count} of ${target}`} />
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400">{prog.count} of {target} completed</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {claimed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('my-coupons')}
                      className="h-8 px-4 text-xs font-bold text-green-700 border-green-300 hover:bg-green-50 rounded-xl flex-shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> In vault
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={completingId === task.id}
                      onClick={() => handleCompleteTask(task)}
                      className="h-8 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex-shrink-0 shadow-sm"
                    >
                      {completingId === task.id ? 'Checking…' : token ? 'Claim' : (
                        <span className="flex items-center gap-1"><LogIn className="w-3 h-3" /> Sign in</span>
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EarnCouponsPage
