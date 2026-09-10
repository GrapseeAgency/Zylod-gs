'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, Crosshair, Truck, MapPin,
  Clock, RotateCw, Warehouse, Calculator, User, MessageSquare
} from 'lucide-react'

export function ShippingTrackerPage() {
  const { navigate, goBack } = useNavigationStore()
  const [courierPos, setCourierPos] = useState({ x: 190, y: 140 })

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-black text-primary">Tracking</h1>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Tracking</h1>

      {/* Main Map Container */}
      <div className="relative flex-1 min-h-[380px] bg-slate-200 overflow-hidden">
        {/* Dynamic Dhaka / BD City Map Layout (SVG Grid & Streets) */}
        <div className="absolute inset-0 bg-[#F1F5F9]">
          <svg className="w-full h-full object-cover" viewBox="0 0 400 380" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* City block buildings */}
            {Array.from({ length: 16 }).map((_, i) => (
              <rect
                key={i}
                x={(i % 4) * 95 + 10}
                y={Math.floor(i / 4) * 90 + 10}
                width="75"
                height="70"
                rx="6"
                fill="#E2E8F0"
                stroke="#CBD5E1"
                strokeWidth="1"
              />
            ))}

            {/* Major Arteries / Roads */}
            <line x1="0" y1="95" x2="400" y2="95" stroke="#FFFFFF" strokeWidth="16" />
            <line x1="0" y1="185" x2="400" y2="185" stroke="#FFFFFF" strokeWidth="20" />
            <line x1="0" y1="275" x2="400" y2="275" stroke="#FFFFFF" strokeWidth="16" />
            <line x1="95" y1="0" x2="95" y2="380" stroke="#FFFFFF" strokeWidth="16" />
            <line x1="190" y1="0" x2="190" y2="380" stroke="#FFFFFF" strokeWidth="20" />
            <line x1="285" y1="0" x2="285" y2="380" stroke="#FFFFFF" strokeWidth="16" />

            {/* Active Route Path in Red */}
            <path
              d="M 190 320 L 190 185 L 340 185"
              stroke="#E11D48"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dashed line from Courier to Warehouse */}
            <line
              x1="190"
              y1="185"
              x2="280"
              y2="115"
              stroke="#E11D48"
              strokeWidth="3"
              strokeDasharray="6 6"
            />

            {/* City Label */}
            <text x="220" y="160" fill="#64748B" fontSize="18" fontWeight="bold" fontFamily="sans-serif" opacity="0.6">
              Dhaka North Hub
            </text>
            <text x="230" y="200" fill="#94A3B8" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
              Tejgaon Industrial Ave
            </text>
          </svg>
        </div>

        {/* GPS Locate Button */}
        <button
          onClick={() => setCourierPos({ x: 190, y: 140 })}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white text-slate-700 shadow-md flex items-center justify-center border border-slate-200"
          title="Locate Courier"
        >
          <Crosshair className="h-5 w-5" />
        </button>

        {/* Warehouse A Destination Marker */}
        <div className="absolute top-[100px] left-[260px] flex flex-col items-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary bg-white flex items-center justify-center shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
          <span className="bg-white text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs border border-slate-200 mt-1 whitespace-nowrap">
            Warehouse A
          </span>
        </div>

        {/* Courier Marker */}
        <div className="absolute top-[165px] left-[165px] flex flex-col items-center z-10">
          <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 border-2 border-white">
            <Truck className="h-5 w-5" />
          </div>
          <span className="bg-white text-slate-900 text-[10px] font-black px-2.5 py-0.5 rounded-md shadow border border-slate-200 mt-1 whitespace-nowrap">
            Courier #8492
          </span>
        </div>
      </div>

      {/* Bottom Sheet Status Card */}
      <div className="bg-white rounded-t-3xl border-t border-slate-200 p-5 shadow-2xl space-y-4 max-w-lg mx-auto w-full z-20 pb-24">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto" />

        {/* Estimated Arrival Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              ESTIMATED ARRIVAL
            </span>
            <div className="text-2xl font-black text-primary tracking-tight mt-0.5">
              14:30 <span className="text-xs font-bold text-slate-500">BST</span>
            </div>
          </div>

          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1.5">
            <RotateCw className="h-3 w-3 text-primary animate-spin" />
            In Transit
          </span>
        </div>

        {/* Delivery Status Timeline */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold text-slate-900">Delivery Status</h2>

          <div className="space-y-4 pl-1 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {/* Step 1: Dispatched */}
            <div className="relative flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-primary bg-white flex items-center justify-center shrink-0 z-10">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Dispatched</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Tejgaon Central Hub • 08:15 AM</p>
              </div>
            </div>

            {/* Step 2: In Transit */}
            <div className="relative flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0 z-10 shadow-xs">
                <Truck className="h-3 w-3" />
              </div>
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-primary">In Transit</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Estimated delivery at Gate 4</p>
                </div>
                <Button
                  onClick={() => navigate('delivery-chat')}
                  className="h-8 px-3 text-[11px] font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs"
                >
                  Chat Driver
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}