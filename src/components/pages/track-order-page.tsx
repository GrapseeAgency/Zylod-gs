'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Truck, Package, Check, Copy, CheckCircle2,
  MapPin, Clock, ArrowRight, ShieldCheck
} from 'lucide-react'

export function TrackOrderPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || 'WBD-88291-A'

  const [copied, setCopied] = useState(false)
  const trackingNumber = 'RPL-987654321'

  const handleCopy = () => {
    navigator.clipboard?.writeText(trackingNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const history = [
    {
      id: 1,
      title: 'Departed Sorting Facility',
      location: 'Chicago, IL',
      time: 'Today, 8:45 AM',
      active: true,
    },
    {
      id: 2,
      title: 'Arrived at Sorting Facility',
      location: 'Chicago, IL',
      time: 'Yesterday, 11:30 PM',
    },
    {
      id: 3,
      title: 'Package Picked Up',
      location: 'Warehouse 4, IL',
      time: 'Yesterday, 4:15 PM',
    },
    {
      id: 4,
      title: 'Order Processed',
      location: 'System',
      time: 'Yesterday, 10:00 AM',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Track Order</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Track Order</h1>

      {/* Map Header Preview */}
      <div className="relative h-64 bg-slate-200 overflow-hidden">
        {/* Styled Route Map visual */}
        <div className="absolute inset-0 bg-slate-100">
          <svg className="w-full h-full object-cover" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="240" fill="#E2E8F0" />
            {/* Roads & terrain grid */}
            <path d="M-20 40 C 80 40, 160 120, 240 100 C 320 80, 380 180, 420 180" stroke="#CBD5E1" strokeWidth="12" strokeLinecap="round" />
            <path d="M80 -20 C 100 80, 280 60, 360 260" stroke="#CBD5E1" strokeWidth="8" strokeLinecap="round" />
            <path d="M0 160 C 140 140, 260 220, 400 200" stroke="#CBD5E1" strokeWidth="6" strokeLinecap="round" />
            
            {/* Tracking Arc (Red Dashed) */}
            <path
              d="M 60 180 C 120 70, 260 40, 340 70"
              stroke="#E11D48"
              strokeWidth="4"
              strokeDasharray="6 6"
              fill="none"
            />

            {/* Origin Node */}
            <circle cx="60" cy="180" r="10" fill="#E11D48" />
            <circle cx="60" cy="180" r="5" fill="white" />

            {/* Destination Pin */}
            <g transform="translate(330, 45)">
              <path
                d="M10 0 C4.5 0 0 4.5 0 10 C0 17.5 10 26 10 26 C10 26 20 17.5 20 10 C20 4.5 15.5 0 10 0 Z"
                fill="#E11D48"
              />
              <circle cx="10" cy="9" r="4" fill="white" />
            </g>
          </svg>
        </div>

        {/* Map Label badge */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-2xs text-white text-[10px] font-bold px-2.5 py-1 rounded-md">
          Live Freight Route
        </div>
      </div>

      <main className="px-4 -mt-8 relative z-20 space-y-4 max-w-lg mx-auto">
        {/* Floating Status & Carrier Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-lg space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Order ID
              </span>
              <h2 className="text-sm font-black text-slate-900">
                #{orderId}
              </h2>
            </div>
            <span className="bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Truck className="h-3 w-3" />
              IN TRANSIT
            </span>
          </div>

          {/* Estimated Delivery */}
          <div className="text-center py-1">
            <span className="text-xs text-slate-500 block">Estimated Delivery</span>
            <div className="text-xl font-black text-primary mt-0.5 tracking-tight">
              Tomorrow, 10:00 AM
            </div>
          </div>

          {/* 4-Step Progress */}
          <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100">
            {/* Confirmed */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-700 mt-1">Confirmed</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-1" />

            {/* Packed */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Package className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-700 mt-1">Packed</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-1" />

            {/* Transit */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary bg-white flex items-center justify-center text-xs font-black">
                <div className="w-3.5 h-3.5 rounded-full bg-primary" />
              </div>
              <span className="text-[10px] font-black text-primary mt-1">Transit</span>
            </div>

            <div className="flex-1 h-0.5 bg-slate-200 mx-1" />

            {/* Delivered */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-black">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1">Delivered</span>
            </div>
          </div>

          {/* Carrier Info Card */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-primary flex items-center justify-center border border-rose-100 shrink-0">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Rapid Logistics</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Tracking: {trackingNumber}
                </p>
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              title="Copy tracking code"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Tracking History Section */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-900">Tracking History</h2>
            <button
              onClick={() => navigate('order-timeline', { orderId })}
              className="text-xs font-bold text-primary hover:underline"
            >
              View Full Timeline →
            </button>
          </div>

          <div className="space-y-5 pl-2 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {history.map((event) => (
              <div key={event.id} className="relative flex items-start gap-3.5">
                {/* Node */}
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 z-10 ${
                    event.active
                      ? 'border-primary bg-white ring-4 ring-rose-100'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {event.active && <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto my-auto" />}
                </div>

                {/* Details */}
                <div className="min-w-0">
                  <h3 className={`text-xs ${event.active ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {event.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {event.location} • {event.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default TrackOrderPage
