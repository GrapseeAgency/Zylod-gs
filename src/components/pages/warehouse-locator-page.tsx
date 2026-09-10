'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, Search, Crosshair, Snowflake,
  AlertTriangle, Truck, Warehouse, Calculator, MessageSquare,
  MapPin, ShieldCheck, ChevronRight
} from 'lucide-react'

interface WarehouseFacility {
  id: string
  name: string
  distance: string
  location: string
  capabilities: { label: string; icon: 'cold' | 'hazmat' | 'dock' }[]
  capacityUtilized?: string
}

export function WarehouseLocatorPage() {
  const { navigate, goBack } = useNavigationStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'cold' | 'hazmat'>('all')

  const facilities: WarehouseFacility[] = [
    {
      id: 'wh-1',
      name: 'Dhaka Central Mega-Hub',
      distance: '3.2 km',
      location: 'Tejgaon Industrial Area, Dhaka',
      capabilities: [
        { label: 'Cold Storage', icon: 'cold' },
        { label: 'Cross-Dock', icon: 'dock' },
      ],
      capacityUtilized: '85% Utilized',
    },
    {
      id: 'wh-2',
      name: 'Chittagong Port Freight Terminal',
      distance: '242 km',
      location: 'Chittagong Port Zone, BD',
      capabilities: [
        { label: 'Hazmat Cert', icon: 'hazmat' },
      ],
    },
    {
      id: 'wh-3',
      name: 'Sylhet Regional Bulk Terminal',
      distance: '98 km',
      location: 'Sylhet Industrial Estate, BD',
      capabilities: [
        { label: 'Cross-Dock', icon: 'dock' },
      ],
    },
  ]

  const filteredFacilities = facilities.filter((f) => {
    if (activeFilter === 'cold') return f.capabilities.some((c) => c.icon === 'cold')
    if (activeFilter === 'hazmat') return f.capabilities.some((c) => c.icon === 'hazmat')
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Logistics Suite</h1>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Title */}
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Global Warehouse Locator
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Find Zylod fulfillment centers and verify specialized capabilities.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by city, port, or region..."
            className="h-11 pl-10 rounded-2xl bg-white border-slate-200 text-xs font-semibold placeholder:text-slate-400"
          />
        </div>

        {/* Locate Me Button */}
        <Button
          onClick={() => {}}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
        >
          <Crosshair className="h-4 w-4" />
          Locate Me
        </Button>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              activeFilter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/80'
            }`}
          >
            All Facilities
          </button>

          <button
            onClick={() => setActiveFilter('cold')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
              activeFilter === 'cold'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Snowflake className="h-3.5 w-3.5" />
            Cold Storage
          </button>

          <button
            onClick={() => setActiveFilter('hazmat')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
              activeFilter === 'hazmat'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Hazmat Cert
          </button>
        </div>

        {/* Facilities List */}
        <div className="space-y-3 pt-1">
          {filteredFacilities.map((fac, idx) => (
            <div
              key={fac.id}
              className={`bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 ${
                idx === 0 ? 'border-l-4 border-l-primary' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900">{fac.name}</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <span>{fac.location}</span>
                  </p>
                </div>
                <span className="bg-rose-50 text-primary text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-100 font-mono">
                  {fac.distance}
                </span>
              </div>

              {/* Capabilities Chips */}
              <div className="flex gap-2 flex-wrap">
                {fac.capabilities.map((cap, i) => (
                  <span
                    key={i}
                    className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1"
                  >
                    {cap.icon === 'cold' && <Snowflake className="h-3 w-3 text-cyan-600" />}
                    {cap.icon === 'hazmat' && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                    {cap.icon === 'dock' && <Truck className="h-3 w-3 text-slate-600" />}
                    {cap.label}
                  </span>
                ))}
              </div>

              {/* Footer / Capacity */}
              {fac.capacityUtilized && (
                <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      CAPACITY
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {fac.capacityUtilized}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => navigate('pickup-point')}
                    className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-9 px-4 rounded-xl text-xs"
                  >
                    View Details
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}