'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Radio, Play, Users, Eye,
  Sparkles, MessageSquare, Star, ChevronRight
} from 'lucide-react'

export function LiveShoppingPage() {
  const { navigate, goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/live-shopping')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setStreams(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="md:hidden sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-slate-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <h1 className="font-bold text-base">Factory Live Shopping</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto lg:max-w-6xl w-full space-y-4 md:space-y-6 md:px-6 md:py-6 pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-indigo-700 rounded-3xl p-5 md:p-6 text-white shadow-xl space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-100">
            <Sparkles className="w-4 h-4 text-amber-300" /> Real-time Factory Walkthroughs
          </div>
          <h2 className="text-base sm:text-lg md:text-2xl font-black">Watch Live Production Lines &amp; Grab Broadcast Vouchers</h2>
          <p className="text-xs md:text-sm text-red-100">
            Chat directly with mill owners on camera, inspect fabric texture live, and claim flash discounts.
          </p>
        </div>

        {/* Streams List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1, 2].map(i => (
              <div key={i} className="bg-slate-900 rounded-3xl p-4 border border-slate-800 animate-pulse space-y-3">
                <Skeleton className="h-44 w-full rounded-2xl bg-slate-800" />
                <Skeleton className="h-4 w-2/3 rounded bg-slate-800" />
              </div>
            ))
          ) : streams.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-400">
              No live broadcast streams running at this moment.
            </div>
          ) : (
            streams.map(st => (
              <div
                key={st.id}
                onClick={() => navigate('live-shopping-detail', { id: st.id })}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg hover:border-red-500 transition cursor-pointer group flex flex-col justify-between"
              >
                <div className="relative aspect-[16/10] bg-slate-800 overflow-hidden">
                  <img
                    src={st.thumbnailUrl}
                    alt={st.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />

                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    {st.isLive ? (
                      <span className="bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE
                      </span>
                    ) : (
                      <span className="bg-slate-900/80 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                        Scheduled
                      </span>
                    )}

                    {st.isLive && (
                      <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {st.viewerCount}
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2">{st.title}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{st.description}</p>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">{st.supplierName}</span>
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {st.supplierRating}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default LiveShoppingPage
