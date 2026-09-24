'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Radio, Eye, Send
} from 'lucide-react'

export function LiveShoppingDetailPage() {
  const { currentPage, navigate, goBack, pageParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const streamId = pageParams?.id

  const [stream, setStream] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!streamId) return
    fetch(`/api/live-shopping/${streamId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setStream(data.data)
          // Real chat state only — the server never seeds fake messages
          setMessages(data.data.liveMessages || [])
        } else {
          setLoadError(data.error || 'Live stream not found')
        }
      })
      .catch(err => {
        console.error(err)
        setLoadError('Could not reach the live stream service')
      })
  }, [streamId])

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${stream?.isLive ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
            <h1 className="font-bold text-sm sm:text-base truncate max-w-xs">{stream?.supplierName || stream?.title || 'Live Stream'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stream?.isLive && (
            <span className="bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE
            </span>
          )}
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {stream?.viewerCount ?? 0}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full space-y-4 pb-24 md:pb-8 lg:max-w-6xl lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start lg:space-y-0 lg:px-6 lg:py-6">
        {/* Live Video Stage */}
        <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl lg:col-span-2 flex items-center justify-center">
          {stream?.thumbnailUrl ? (
            <img
              src={stream.thumbnailUrl}
              alt="Live Factory Stream"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center space-y-2">
              <Radio className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500">No stream video yet</p>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-x-4 top-4 bg-red-950/90 border border-red-800 rounded-2xl p-3">
              <p className="text-[11px] font-bold text-red-300">{loadError}</p>
            </div>
          )}

          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-2xl p-3 max-w-xs space-y-1">
            <h3 className="text-xs font-bold text-white line-clamp-1">{stream?.title || 'Live Stream'}</h3>
            {stream?.supplierName && (
              <p className="text-[10px] text-slate-300">Hosted by {stream.supplierName}</p>
            )}
          </div>
        </div>

        {/* Live Chat & Messages */}
        <div className="bg-slate-900/90 rounded-3xl p-4 border border-slate-800 space-y-3 lg:col-span-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Factory Floor Q&amp;A</h3>

          <div className="space-y-2 max-h-48 lg:max-h-[420px] overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                No messages yet. Live chat opens for everyone once the host starts broadcasting.
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="text-xs flex items-baseline gap-2">
                  <span className="font-bold text-amber-400">{m.sender}:</span>
                  <span className="text-slate-200">{m.text}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <Input
              placeholder="Chat opens when the stream is live"
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
              disabled={!stream?.isLive}
              className="bg-slate-950 border-slate-800 text-white text-xs disabled:opacity-50"
            />
            <Button
              size="sm"
              disabled={!stream?.isLive}
              title={stream?.isLive ? 'Send message' : 'Real-time chat connects when the host is live'}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LiveShoppingDetailPage
