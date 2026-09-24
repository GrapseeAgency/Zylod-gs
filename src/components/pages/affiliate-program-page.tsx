'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, TrendingUp, DollarSign, Share2,
  CheckCircle2, Copy, Check, BarChart3, ChevronRight
} from 'lucide-react'

export function AffiliateProgramPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [affiliate, setAffiliate] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/affiliate', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.enrolled && data.data) {
          setAffiliate(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const handleEnroll = async () => {
    try {
      setEnrolling(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/affiliate', { method: 'POST', headers })
      const data = await res.json()
      if (res.ok && data.success) {
        setAffiliate(data.data)
        alert('Enrolled in Wholesale Affiliate Partner Program!')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setEnrolling(false)
    }
  }

  const copyLink = () => {
    if (!affiliate?.trackingLink) return
    navigator.clipboard.writeText(affiliate.trackingLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h1 className="font-bold text-gray-900 text-base">Affiliate Partner Program</h1>
          </div>
        </div>

        {affiliate && (
          <Button
            size="sm"
            onClick={() => navigate('affiliate-dashboard')}
            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </Button>
        )}
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-2xl mx-auto lg:max-w-5xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Desktop page title */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Affiliate Partner Program</h1>
            <p className="text-sm text-gray-500 mt-1">Earn 5% commission on every wholesale order you refer</p>
          </div>
          {affiliate && (
            <Button
              size="sm"
              onClick={() => navigate('affiliate-dashboard')}
              className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </Button>
          )}
        </div>

        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 rounded-3xl p-6 md:p-8 text-white shadow-md space-y-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
            5% Commission on Bulk Orders
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black">Monetize Your B2B Industry Network</h2>
          <p className="text-xs text-emerald-100 leading-relaxed">
            Earn continuous 5% cash commissions on every completed purchase order placed by manufacturers and retailers you introduce.
          </p>
        </div>

        {/* Enrollment / Link Card */}
        {affiliate ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Your Unique Tracking Link
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                Active Partner
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-gray-200 rounded-2xl flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-gray-700 truncate">
                {affiliate.trackingLink}
              </span>
              <Button
                size="sm"
                onClick={copyLink}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex-shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <Button
              onClick={() => navigate('affiliate-dashboard')}
              className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs sm:text-sm gap-2"
            >
              <BarChart3 className="w-4 h-4" /> Open Full Analytics &amp; Payouts Dashboard
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 text-center">
            <h3 className="text-base font-bold text-gray-900">Become a Certified Wholesale Affiliate</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Get instant access to tracked wholesale referral links, real-time commission analytics, and monthly bKash/bank account settlements.
            </p>

            <Button
              onClick={handleEnroll}
              disabled={enrolling}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg text-sm"
            >
              {enrolling ? 'Setting up account...' : 'Enroll in Affiliate Program (Free)'}
            </Button>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-1">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h4 className="text-xs font-bold text-gray-900">High Average Order Value</h4>
            <p className="text-[11px] text-gray-500">Average wholesale order is ৳85,000+ generating ৳4,250 commission per transaction.</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-1">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h4 className="text-xs font-bold text-gray-900">60-Day Cookie Window</h4>
            <p className="text-[11px] text-gray-500">Commissions attributed even if buyers return up to 2 months later.</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-1">
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
            <h4 className="text-xs font-bold text-gray-900">Automatic Bank Payouts</h4>
            <p className="text-[11px] text-gray-500">Approved commissions are transferred to your nominated BEFTN/bKash account.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AffiliateProgramPage
