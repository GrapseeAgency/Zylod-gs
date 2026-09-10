'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Users, Copy, Check, Share2,
  Gift, Sparkles, TrendingUp, ChevronRight
} from 'lucide-react'

export function ReferralProgramPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [refData, setRefData] = useState<any>(null)
  const [friendCode, setFriendCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/referrals', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setRefData(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const copyInvite = () => {
    if (!refData) return
    navigator.clipboard.writeText(refData.shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClaimFriendCode = async () => {
    if (!friendCode.trim()) return
    try {
      setClaiming(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/referrals/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ referralCode: friendCode.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert(data.message || 'Referral code claimed!')
        setFriendCode('')
      } else {
        alert(data.error || 'Failed to claim referral code')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h1 className="font-bold text-gray-900 text-base">Refer &amp; Earn</h1>
          </div>
        </div>

        <button
          onClick={() => navigate('referral-earnings')}
          className="text-xs font-bold text-indigo-600 hover:underline"
        >
          Earnings History →
        </button>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:px-6 md:py-8 md:max-w-3xl md:space-y-8 md:pb-10">
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Refer &amp; Earn</h1>
          </div>
          <button
            onClick={() => navigate('referral-earnings')}
            className="text-xs font-bold text-indigo-600 hover:underline"
          >
            Earnings History
          </button>
        </div>
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-800 rounded-3xl p-6 text-white shadow-md text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Merchant Referral Network
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black">Give ৳200, Get 500 Points</h2>
          <p className="text-xs text-indigo-100 max-w-sm mx-auto">
            Invite fellow wholesale retailers and factory buyers. They get ৳200 voucher + 300 points, and you receive 500 points per registered business!
          </p>
        </div>

        {/* Your Invite Code Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 text-center">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Your Unique Invite Code
          </h3>

          <div className="p-3.5 bg-slate-50 border border-dashed border-indigo-200 rounded-2xl flex items-center justify-between gap-3">
            <span className="font-mono font-black text-base sm:text-lg text-indigo-600 tracking-wider">
              {refData?.code || 'LOADING...'}
            </span>

            <Button
              size="sm"
              onClick={copyInvite}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Link' : 'Copy Link'}
            </Button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="bg-slate-50 rounded-2xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Invited Businesses</p>
              <p className="text-lg font-black text-gray-900">{refData?.totalInvited ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Points Earned</p>
              <p className="text-lg font-black text-indigo-600">+{refData?.totalPointsEarned ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Claim Friend's Referral Code Card */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Have an Invite Code?
          </h3>
          <p className="text-xs text-gray-500">
            Enter a colleague&apos;s code below to claim your ৳200 welcome voucher and 300 bonus points.
          </p>

          <div className="flex gap-2 pt-1">
            <Input
              placeholder="e.g. ZY-8492"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
              className="text-xs font-bold uppercase"
            />
            <Button
              onClick={handleClaimFriendCode}
              disabled={claiming || !friendCode.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 rounded-xl shadow-sm"
            >
              {claiming ? 'Applying...' : 'Apply Code'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReferralProgramPage
