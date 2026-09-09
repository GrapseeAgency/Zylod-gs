'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, Share2, Bell, Factory, Ship,
  Satellite, Anchor, Download, Lock, CheckCircle2,
  Truck, Warehouse, Calculator, User, MessageSquare
} from 'lucide-react'

export function ImportExportTrackerPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const poNumber = pageParams.poNumber || 'PO-2023-8942A'

  const [notificationsOn, setNotificationsOn] = useState(true)

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      <main className="px-4 py-4 space-y-4 md:space-y-5 max-w-lg mx-auto md:max-w-5xl md:px-6 md:py-6">
        {/* Header Summary Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              IN TRANSIT
            </span>
            <h1 className="text-base md:text-xl font-black text-slate-900 font-mono tracking-tight">
              {poNumber}
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Industrial CNC Machinery • 4× 40HQ Containers
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => {}}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>

            <Button
              onClick={() => setNotificationsOn(!notificationsOn)}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-2xl text-xs shadow-md flex items-center justify-center gap-1.5 relative overflow-hidden"
            >
              {/* Pulsing beacon animation */}
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping opacity-75" />
              <Bell className="h-4 w-4" />
              Updates
            </Button>
          </div>
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0 lg:items-start">
        {/* Transit Journey Timeline */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <span className="text-primary font-black">§</span>
            <span>Transit Journey</span>
          </div>

          <div className="space-y-4 pl-1 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-rose-100">
            {/* Step 1: Factory Dispatch */}
            <div className="relative flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 z-10 shadow-md shadow-primary/20">
                <Factory className="h-5 w-5" />
              </div>
              <div className="pt-0.5">
                <h3 className="text-xs font-black text-slate-900">Factory Dispatch</h3>
                <p className="text-[11px] text-slate-500">Shenzhen Industrial Zone, CN</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Oct 12, 2023 • 08:30 AM</p>
              </div>
            </div>

            {/* Step 2: Departed Port */}
            <div className="relative flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 z-10 shadow-md shadow-primary/20">
                <Ship className="h-5 w-5" />
              </div>
              <div className="pt-0.5">
                <h3 className="text-xs font-black text-slate-900">Departed Port of Yantian</h3>
                <p className="text-[11px] text-slate-500">Vessel: EVER GIVEN V.042E</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Oct 15, 2023 • 14:15 PM</p>
              </div>
            </div>

            {/* Step 3: Ocean Transit (CURRENT) */}
            <div className="relative flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-primary text-primary flex items-center justify-center shrink-0 z-10 shadow-md">
                <Satellite className="h-5 w-5 animate-pulse" />
              </div>
              <div className="flex-1 bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs space-y-2 border-l-4 border-l-primary">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-primary">Ocean Transit</h3>
                  <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">
                    CURRENT
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">Passing Bay of Bengal / Malacca Strait</p>

                {/* Progress bar */}
                <div className="space-y-1 pt-1">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-2 rounded-full w-[65%]" />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>65% Complete</span>
                    <span className="text-primary">Est. 4 Days Remaining</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Arrival Port */}
            <div className="relative flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 z-10 border border-slate-200">
                <Anchor className="h-5 w-5" />
              </div>
              <div className="pt-0.5">
                <h3 className="text-xs font-bold text-slate-500">Arrival Port of Chittagong</h3>
                <p className="text-[11px] text-slate-400">Pier 4, Container Berth 2</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">ETA: Nov 02, 2023</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
        {/* Live Ocean Tracking Map Preview */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-2.5 overflow-hidden">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Live Tracking
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Updated 2m ago</span>
          </div>

          <div className="relative h-44 md:h-56 rounded-2xl bg-sky-50 border border-sky-100 overflow-hidden">
            {/* World ocean route SVG */}
            <svg className="w-full h-full object-cover" viewBox="0 0 400 180" fill="none">
              <rect width="400" height="180" fill="#E0F2FE" />
              {/* Landmass shapes */}
              <path d="M 20 20 Q 80 10, 140 30 T 220 50 L 240 100 L 180 120 Z" fill="#CBD5E1" opacity="0.6" />
              <path d="M 280 40 Q 340 30, 390 60 L 370 140 L 290 120 Z" fill="#CBD5E1" opacity="0.6" />
              {/* Shipping Route Arc */}
              <path d="M 120 40 Q 200 90, 310 70" stroke="#E11D48" strokeWidth="3" strokeDasharray="5 5" fill="none" />
              {/* Vessel position indicator */}
              <circle cx="215" cy="77" r="7" fill="#E11D48" className="animate-pulse" />
              <circle cx="215" cy="77" r="14" stroke="#E11D48" strokeWidth="1.5" opacity="0.4" className="animate-ping" />
            </svg>

            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[9px] font-mono px-2 py-1 rounded-md">
              Vessel: MV Nordic Wave • Speed: 18.4 kn
            </div>
          </div>
        </div>

        {/* Key Documents Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Key Documents
          </h2>

          <div className="space-y-2">
            {/* Bill of Lading */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Bill of Lading</h3>
                  <p className="text-[10px] text-slate-400 font-mono">PDF • 2.4 MB</p>
                </div>
              </div>
              <button onClick={() => window.print()} className="p-1.5 text-slate-400 hover:text-primary">
                <Download className="h-4 w-4" />
              </button>
            </div>

            {/* Commercial Invoice */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Commercial Invoice</h3>
                  <p className="text-[10px] text-slate-400 font-mono">PDF • 1.1 MB</p>
                </div>
              </div>
              <button onClick={() => window.print()} className="p-1.5 text-slate-400 hover:text-primary">
                <Download className="h-4 w-4" />
              </button>
            </div>

            {/* Customs Declaration */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs opacity-75">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-700">Customs Declaration</h3>
                  <p className="text-[10px] text-amber-600 font-semibold">Pending Clearance</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => navigate('customs-clearance')}
                className="text-xs text-primary font-bold hover:underline p-0 h-auto"
              >
                View Status
              </Button>
            </div>
          </div>
        </div>
        </div>
        </div>
      </main>
    </div>
  )
}