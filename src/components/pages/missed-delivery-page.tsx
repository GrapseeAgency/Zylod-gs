'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, AlertTriangle, Clock, MapPin,
  User, Calendar, Store, Phone, Truck, Warehouse, Calculator, MessageSquare
} from 'lucide-react'

export function MissedDeliveryPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const trackingNumber = pageParams.trackingNumber || 'AWB-9876543210'

  const [rescheduled, setRescheduled] = useState(false)

  const handleReschedule = () => {
    setRescheduled(true)
    setTimeout(() => {
      navigate('shipping-tracker')
    }, 1200)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto lg:max-w-3xl">
        {/* Red Alert Banner Card */}
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 flex gap-3.5 items-start">
          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-sm font-black text-slate-900">
              Delivery Attempt Failed
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              We attempted to deliver your package, but the warehouse was closed or inaccessible at the time of arrival.
            </p>
          </div>
        </div>

        {/* Tracking & Proof Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                TRACKING NUMBER
              </span>
              <span className="font-bold text-slate-900 font-mono">{trackingNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                STATUS
              </span>
              <span className="font-black text-primary">Missed</span>
            </div>
          </div>

          {/* Photo of closed warehouse gate with timestamp */}
          <div className="relative aspect-[16/9] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner">
            <img
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80"
              alt="Closed gate"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2.5 left-2.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-300" />
              <span>Today, 14:32 PM</span>
            </div>
          </div>

          {/* Destination */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 text-xs">
            <MapPin className="h-4 w-4 text-slate-600 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Destination</span>
              <span className="font-bold text-slate-900">Warehouse Block B, Sector 4</span>
            </div>
          </div>

          {/* Driver Note */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3 text-xs">
            <User className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Driver Note</span>
              <span className="text-slate-700">Gates closed, unable to reach contact person.</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Action 1: Reschedule Now */}
        <button
          onClick={handleReschedule}
          className="w-full bg-primary hover:bg-primary/90 text-white rounded-3xl p-5 text-left shadow-md flex items-center gap-4 transition-transform active:scale-[0.99]"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-black text-white">Reschedule Now</h2>
            <p className="text-xs text-rose-100 mt-0.5">
              Choose a new delivery time for tomorrow.
            </p>
          </div>
        </button>

        {/* Action 2: Change to Pickup Point */}
        <button
          onClick={() => navigate('shipping-tracker')}
          className="w-full bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-3xl p-5 text-left shadow-2xs flex items-center gap-4 transition-transform active:scale-[0.99]"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-700">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-black text-slate-900">Change to Pickup Point</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Collect from a nearby verified location.
            </p>
          </div>
        </button>
        </div>

        {/* Support Link */}
        <div className="text-center pt-2">
          <button
            onClick={() => navigate('delivery-chat')}
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Contact Driver / Support</span>
          </button>
        </div>
      </main>
    </div>
  )
}