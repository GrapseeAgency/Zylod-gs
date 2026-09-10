'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, MapPin, Download, Package,
  Scale, Box, Ship, RotateCw, Headphones, CheckCircle2,
  Truck, Warehouse, Calculator, User, MessageSquare
} from 'lucide-react'

export function FreightTrackingPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const shipmentId = pageParams.shipmentId || 'SHP-89234-A'

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

      <main className="px-4 py-4 space-y-4 md:space-y-5 max-w-lg mx-auto md:max-w-4xl md:px-6 md:py-6">
        {/* Shipment Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 font-mono tracking-tight">
            Shipment #{shipmentId}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 font-medium">
            Shanghai Port (CNSHG) to Dhaka Distribution Center
          </p>
          <div className="pt-2">
            <span className="bg-rose-50 text-primary border border-rose-100 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              In Transit
            </span>
          </div>
        </div>

        {/* Route Overview Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="text-primary font-black">§</span>
              Route Overview
            </span>
            <button className="text-primary font-bold hover:underline">
              View Full Screen
            </button>
          </div>

          {/* Map Container */}
          <div className="relative h-44 md:h-64 rounded-2xl bg-sky-50 border border-sky-100 overflow-hidden flex items-center justify-center">
            <svg className="w-full h-full object-cover" viewBox="0 0 400 180" fill="none">
              <rect width="400" height="180" fill="#E0F2FE" />
              {/* Land paths */}
              <path d="M 10 30 Q 70 20, 130 50 T 200 80 L 170 140 L 40 120 Z" fill="#CBD5E1" opacity="0.6" />
              <path d="M 270 30 Q 330 20, 380 40 L 360 120 L 290 100 Z" fill="#CBD5E1" opacity="0.6" />
              {/* Shipping Route Line */}
              <path d="M 100 50 Q 200 90, 320 60" stroke="#E11D48" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              {/* Ping point */}
              <circle cx="210" cy="78" r="6" fill="#E11D48" className="animate-pulse" />
              <circle cx="210" cy="78" r="12" stroke="#E11D48" strokeWidth="1.5" opacity="0.4" className="animate-ping" />
            </svg>

            {/* Origin & Destination Pills */}
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-xl p-2 text-[9px] shadow-xs">
              <span className="text-slate-400 block uppercase font-bold">Origin</span>
              <strong className="text-slate-900 font-mono">CNSHG (Shanghai)</strong>
            </div>

            <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-xl p-2 text-[9px] shadow-xs text-right">
              <span className="text-slate-400 block uppercase font-bold">Destination</span>
              <strong className="text-slate-900 font-mono">BDDAC (Dhaka DC)</strong>
            </div>
          </div>
        </div>

        {/* Cargo Details */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Package className="h-4 w-4 text-primary" />
            <span>Cargo Details</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Pallets */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center space-y-1">
              <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary mx-auto">
                <Package className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-400 block">TOTAL PALLETS</span>
              <span className="text-xs font-black text-slate-900 block">48 Standard</span>
            </div>

            {/* Weight */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center space-y-1">
              <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 mx-auto">
                <Scale className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-400 block">GROSS WEIGHT</span>
              <span className="text-xs font-black text-slate-900 block font-mono">14,250 kg</span>
            </div>

            {/* Volume */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center space-y-1">
              <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 mx-auto">
                <Box className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-400 block">VOLUME</span>
              <span className="text-xs font-black text-slate-900 block font-mono">62.5 CBM</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Manifest
          </Button>
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0 lg:items-start">
        {/* Transfer Milestones */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Transfer Milestones
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
              3 of 5 Complete
            </span>
          </div>

          <div className="space-y-3 pl-1 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {/* Milestone 1 */}
            <div className="relative flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-primary bg-white flex items-center justify-center shrink-0 z-10">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <div className="flex-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-bold text-slate-900">Origin Port Departure</h3>
                <p className="text-[11px] text-slate-500">Shanghai Port (CNSHG)</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Oct 12, 08:00 AM CST</p>
              </div>
            </div>

            {/* Milestone 2 */}
            <div className="relative flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-primary bg-white flex items-center justify-center shrink-0 z-10">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <div className="flex-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-bold text-slate-900">Ocean Transit</h3>
                <p className="text-[11px] text-slate-500">Carrier: Maersk Line (Vessel: MV Nordic)</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Oct 14 - Oct 28</p>
              </div>
            </div>

            {/* Milestone 3 (Current) */}
            <div className="relative flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[9px] shrink-0 z-10">
                <RotateCw className="h-3 w-3 animate-spin" />
              </div>
              <div className="flex-1 bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-primary">Customs Clearance (Import)</h3>
                  <RotateCw className="h-3.5 w-3.5 text-primary animate-spin" />
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">Port of Chittagong (BDCGP)</p>
                <p className="text-[10px] text-primary font-mono mt-1">Processing since Oct 29, 10:15 AM BST</p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Logistics Provider */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Truck className="h-4 w-4 text-primary" />
            <span>Current Logistics Provider</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Ship className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900">
                Bay of Bengal Maritime Logistics
              </h3>
              <p className="text-[11px] text-slate-500">Ocean Freight Division</p>
              <div className="flex gap-1.5 mt-1">
                <span className="bg-slate-100 text-slate-600 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md">
                  Vessel ID: V-9932
                </span>
                <span className="bg-slate-100 text-slate-600 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md">
                  BOL: #330-9921-X
                </span>
              </div>
            </div>
          </div>

          {/* Intervention CTA */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Need intervention?</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Contact the assigned logistics manager to expedite customs or update routing instructions.
              </p>
            </div>

            <Button
              onClick={() => navigate('delivery-chat')}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              <Headphones className="h-4 w-4" />
              Contact Logistics Manager
            </Button>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}