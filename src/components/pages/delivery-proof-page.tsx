'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, Download, Camera, CheckCircle2,
  PenTool, ShieldCheck, UserCheck, Package, MapPin, Clock
} from 'lucide-react'

export function DeliveryProofPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const podId = pageParams.podId || 'POD-992-XYZ'

  const handleDownloadPdf = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
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

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-5xl">
        {/* Breadcrumb & Title */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            ORDER HISTORY &gt; <span className="text-primary font-mono">{podId}</span>
          </span>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Proof of Delivery</h1>
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-200 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              PDF Report
            </Button>
          </div>
        </div>

        {/* Cards grid: 2/3 evidence, 1/3 summary on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
        <div className="space-y-4 md:space-y-6 lg:col-span-2">
        {/* Card 1: Receiving Dock Capture */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Camera className="h-4 w-4 text-primary" />
              <span>Receiving Dock Capture</span>
            </div>
            <span className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              LIVE VERIFIED
            </span>
          </div>

          {/* Photo Frame with Overlaid GPS/Time */}
          <div className="relative aspect-[4/3] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner">
            <img
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80"
              alt="Dock proof"
              className="w-full h-full object-cover"
            />

            {/* GPS & Timestamp Overlay */}
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-3 py-1.5 rounded-xl space-y-0.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-rose-400" />
                <span>23.8103° N, 90.4125° E (Dhaka)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>OCT 24, 2023 - 14:32:05 UTC</span>
              </div>
            </div>

            {/* Authentic Badge */}
            <div className="absolute bottom-3 right-3 bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>AUTHENTIC</span>
            </div>
          </div>
        </div>

        {/* Card 2: Recipient Signature */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <PenTool className="h-4 w-4 text-primary" />
            <span>Recipient Signature</span>
          </div>

          <div className="h-28 bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col justify-between relative overflow-hidden">
            {/* Signature SVG Line */}
            <svg className="w-full h-16" viewBox="0 0 300 60" fill="none">
              <path
                d="M 20 40 Q 60 10, 100 45 T 180 30 T 260 40"
                stroke="#0F172A"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <line x1="80" y1="15" x2="80" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
            </svg>

            <div className="text-right">
              <span className="text-[9px] font-mono text-slate-400">IP: 192.168.1.44</span>
            </div>
          </div>
        </div>

        </div>

        <div className="space-y-4 md:space-y-6">
        {/* Card 3: Accepted By */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <UserCheck className="h-4 w-4 text-primary" />
            <span>Accepted By</span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-primary font-black text-sm flex items-center justify-center shrink-0">
              JD
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">John Doe</h3>
              <p className="text-[11px] text-slate-500">Warehouse Supervisor - Dock 4</p>
              <span className="text-[10px] font-bold text-primary flex items-center gap-1 mt-0.5">
                Biometric Verification OK
              </span>
            </div>
          </div>
        </div>

        </div>

        {/* Card 4: Shipment Summary (desktop 1/3 sidebar) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 lg:col-span-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Package className="h-4 w-4 text-primary" />
            <span>Shipment Summary</span>
          </div>

          <div className="space-y-1.5 text-xs divide-y divide-slate-50 pt-1">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Carrier</span>
              <span className="font-semibold text-slate-900">Apex Logistics Corp</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Weight</span>
              <span className="font-semibold text-slate-900">450 kg (1 Pallet)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Condition</span>
              <span className="font-black text-primary">Intact - No Damage</span>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

export default DeliveryProofPage
