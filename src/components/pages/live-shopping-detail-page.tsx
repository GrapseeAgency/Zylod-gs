'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Radio, Eye, Send, Heart,
  ShoppingBag, Sparkles, Tag, Check
} from 'lucide-react'

export function LiveShoppingDetailPage() {
  const { currentPage, navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const streamId = pageParams?.id

  const [stream, setStream] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [likes, setLikes] = useState(48)
  const [claimedLiveVoucher, setClaimedLiveVoucher] = useState(false)

  useEffect(() => {
    if (!streamId) return
    fetch(`/api/live-shopping/${streamId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setStream(data.data)
          setMessages(data.data.mockLiveMessages || [])
        }
      })
      .catch(console.error)
  }, [streamId])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMsg.trim()) return
    setMessages(prev => [...prev, { sender: 'You', text: inputMsg.trim(), time: 'Just now' }])
    setInputMsg('')
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <h1 className="font-bold text-sm sm:text-base truncate max-w-xs">{stream?.supplierName || 'Factory Broadcast'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {stream?.viewerCount || 142}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full space-y-4 pb-24 md:pb-8 lg:max-w-6xl lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start lg:space-y-0 lg:px-6 lg:py-6">
        {/* Live Video Stage */}
        <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl lg:col-span-2">
          <img
            src={stream?.thumbnailUrl || 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80'}
            alt="Live Factory Stream"
            className="w-full h-full object-cover"
          />

          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-2xl p-3 max-w-xs space-y-1">
            <h3 className="text-xs font-bold text-white line-clamp-1">{stream?.title}</h3>
            <p className="text-[10px] text-slate-300">Broadcasting live from Narayanganj Textile Mill #4</p>
          </div>

          {/* Floating Live Voucher Pill */}
          <div className="absolute bottom-4 left-4 bg-gradient-to-r from-red-600 to-amber-600 rounded-2xl p-2.5 flex items-center gap-2 shadow-xl">
            <Tag className="w-4 h-4 text-white" />
            <div>
              <p className="text-[10px] font-bold text-white">Live Broadcast Perk: ৳300 Off</p>
            </div>
            <Button
              size="sm"
              disabled={claimedLiveVoucher}
              onClick={() => {
                setClaimedLiveVoucher(true)
                alert('Live stream discount voucher collected!')
              }}
              className="h-7 px-3 text-[10px] font-bold bg-white hover:bg-slate-100 text-red-600 rounded-xl"
            >
              {claimedLiveVoucher ? 'Claimed ✓' : 'Claim'}
            </Button>
          </div>

          <button
            onClick={() => setLikes(prev => prev + 1)}
            className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-pink-500 hover:scale-110 transition shadow-lg"
          >
            <Heart className="w-5 h-5 fill-pink-500" />
          </button>
        </div>

        {/* Live Chat & Messages */}
        <div className="bg-slate-900/90 rounded-3xl p-4 border border-slate-800 space-y-3 lg:col-span-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Factory Floor Q&amp;A</h3>

          <div className="space-y-2 max-h-48 lg:max-h-[420px] overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className="text-xs flex items-baseline gap-2">
                <span className="font-bold text-amber-400">{m.sender}:</span>
                <span className="text-slate-200">{m.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-slate-800">
            <Input
              placeholder="Ask factory owner a question..."
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
            <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LiveShoppingDetailPage
