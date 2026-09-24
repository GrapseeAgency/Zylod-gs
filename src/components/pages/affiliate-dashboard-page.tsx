'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, BarChart3, TrendingUp, DollarSign,
  MousePointerClick, ShoppingBag, CheckCircle2, Clock
} from 'lucide-react'

export function AffiliateDashboardPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  const [dashData, setDashData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch('/api/affiliate/dashboard', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setDashData(data.data)
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
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h1 className="font-bold text-gray-900 text-base">Affiliate Partner Analytics</h1>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('affiliate-program')}
          className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
        >
          My Link
        </Button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-3xl mx-auto w-full space-y-6 md:space-y-8 pb-24 md:pb-8 lg:max-w-6xl">
        {/* Desktop Page Heading */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <h1 className="font-bold text-gray-900 text-2xl">Affiliate Partner Analytics</h1>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('affiliate-program')}
            className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
          >
            My Link
          </Button>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
              <MousePointerClick className="w-4 h-4 text-blue-500" /> Clicks
            </div>
            <p className="text-xl font-black text-gray-900">{dashData?.stats?.totalClicks ?? 0}</p>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
              <ShoppingBag className="w-4 h-4 text-emerald-500" /> PO Orders
            </div>
            <p className="text-xl font-black text-gray-900">{dashData?.stats?.totalOrders ?? 0}</p>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
              <TrendingUp className="w-4 h-4 text-purple-500" /> Conversion
            </div>
            <p className="text-xl font-black text-gray-900">{dashData?.stats?.conversionRate ?? '0%'}</p>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
              <DollarSign className="w-4 h-4 text-amber-500" /> Commission
            </div>
            <p className="text-xl font-black text-gray-900">{dashData?.stats?.commissionRate ?? '5%'}</p>
          </div>
        </div>

        {/* Payout Balance Card */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pending Payout
            </span>
            <h2 className="text-3xl font-black text-emerald-400">
              {formatPrice(dashData?.stats?.pendingPayoutBDT ?? 0)}
            </h2>
            <p className="text-xs text-slate-300">
              Paid to date: {formatPrice(dashData?.stats?.paidPayoutBDT ?? 0)}
            </p>
          </div>

          <Button
            onClick={() => alert('Payout request submitted for bKash/Bank settlement.')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm px-5 py-3 shadow-md"
          >
            Request Payout Transfer
          </Button>
        </div>

        {/* Recent Conversions */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Attributed Purchase Order Conversions
          </h3>

          <div className="space-y-2 md:hidden">
            {(dashData?.recentConversions || []).map((conv: any) => (
              <div
                key={conv.id}
                className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between border border-gray-100"
              >
                <div>
                  <p className="text-xs font-bold text-gray-900">{conv.orderNumber}</p>
                  <p className="text-[11px] text-gray-500">
                    Order Value: {formatPrice(conv.orderAmount)} • {new Date(conv.date).toLocaleDateString('en-GB')}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-extrabold text-emerald-600">+{formatPrice(conv.commissionBDT)}</p>
                  <span className="text-[10px] text-gray-400 capitalize">{conv.status.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: conversions table */}
          {(dashData?.recentConversions || []).length > 0 && (
            <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/50 text-left">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500">Order</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500">Date</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500">Order Value</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500">Commission</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(dashData?.recentConversions || []).map((conv: any) => (
                    <tr key={conv.id} className="hover:bg-red-50/30">
                      <td className="px-4 py-3 font-bold text-gray-900">{conv.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(conv.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-gray-700">{formatPrice(conv.orderAmount)}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-600">+{formatPrice(conv.commissionBDT)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 capitalize">{conv.status.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AffiliateDashboardPage
