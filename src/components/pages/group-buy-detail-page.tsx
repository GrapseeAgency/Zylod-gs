'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Users2, Clock, ShieldCheck,
  CheckCircle2, ShoppingBag, AlertCircle
} from 'lucide-react'

export function GroupBuyDetailPage() {
  const { currentPage, navigate, goBack, pageParams } = useNavigationStore()
  const { token } = useAuthStore()
  const { formatPrice } = useCurrencyStore()
  const campaignId = pageParams?.id

  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState('10')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!campaignId) {
      setLoading(false)
      return
    }
    fetch(`/api/group-buy/${campaignId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setCampaign(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [campaignId])

  const handleJoin = async () => {
    if (!campaignId) return
    const qtyNum = Number(quantity)
    if (!qtyNum || qtyNum <= 0) {
      alert('Please enter a valid quantity')
      return
    }

    try {
      setJoining(true)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/group-buy/${campaignId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ quantity: qtyNum }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert(data.message || 'Successfully joined group buy pool!')
        navigate('group-buy')
      } else {
        alert(data.error || 'Failed to join group buy')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">Group Buy Pooling Pool</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-6 pb-24 md:max-w-4xl md:px-6 md:py-8 md:pb-8">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading campaign details...</div>
        ) : !campaign ? (
          <div className="bg-white rounded-3xl p-8 text-center text-gray-500 space-y-3">
            <p>Campaign not found</p>
            <Button onClick={() => navigate('group-buy')} className="rounded-xl text-xs font-bold bg-red-600 text-white">
              Back to Group Buys
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm lg:p-8">
            <div className="space-y-5 lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0">
            <div className="lg:col-span-2 space-y-5">
            <div className="space-y-1">
              <Badge className="bg-red-50 text-red-700 font-bold uppercase text-[10px]">
                Active Wholesale Pool
              </Badge>
              <h2 className="text-base sm:text-lg md:text-2xl font-black text-gray-900">{campaign.title}</h2>
              <p className="text-xs text-gray-500">
                Expires on {new Date(campaign.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* Price Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Group Pool Rate</p>
                <p className="text-2xl md:text-3xl font-black text-red-600">{formatPrice(campaign.discountedPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Regular Factory Rate</p>
                <p className="text-sm line-through text-gray-500">{formatPrice(campaign.originalPrice)}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-gray-700">
                <span>Total Reserved: {campaign.currentQty} / {campaign.targetQty} Units</span>
                <span className="text-red-600">{campaign.progressPercent}% Target Achieved</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div className="bg-red-600 h-full rounded-full" style={{ width: `${campaign.progressPercent}%` }} />
              </div>
            </div>

            {/* Join Form */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-700">How many units to reserve in this pool?</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="font-bold text-sm"
                />
                <Button
                  onClick={handleJoin}
                  disabled={joining}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-6 rounded-xl shadow-md"
                >
                  {joining ? 'Reserving...' : 'Join Pool'}
                </Button>
              </div>
            </div>

            </div>

            {/* Participants list */}
            <div className="space-y-2 pt-2 lg:pt-0">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Joined Merchants ({campaign.totalParticipants})
              </h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {campaign.participants?.map((p: any) => (
                  <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-800">{p.userEmailMasked}</span>
                    <span className="font-bold text-red-600">Reserved {p.quantity} units</span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GroupBuyDetailPage
