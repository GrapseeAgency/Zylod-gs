'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, Search, Crosshair, Clock, Users,
  CheckCircle2, Building2, Truck, Warehouse, Calculator, User
} from 'lucide-react'

interface PickupHub {
  id: string
  name: string
  distance: string
  address: string
  openHours: string
  traffic: string
  trafficLevel: 'low' | 'moderate' | 'high'
  estPickup: string
}

export function PickupPointPage() {
  const { navigate, goBack } = useNavigationStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'low' | '24_7'>('all')
  const [selectedHub, setSelectedHub] = useState<string>('hub-1')

  const hubs: PickupHub[] = [
    {
      id: 'hub-1',
      name: 'Downtown Logistics Center',
      distance: '0.8 mi',
      address: 'Tejgaon Commercial Area, Dhaka',
      openHours: 'Open until 10 PM',
      traffic: 'Moderate Traffic',
      trafficLevel: 'moderate',
      estPickup: 'Today, 3PM',
    },
    {
      id: 'hub-2',
      name: 'Northside Industrial Park',
      distance: '3.2 mi',
      address: 'Gazipur Logistics Highway',
      openHours: '24/7',
      traffic: 'Low Traffic',
      trafficLevel: 'low',
      estPickup: 'Tomorrow, 9AM',
    },
    {
      id: 'hub-3',
      name: 'Westport Depot',
      distance: '5.7 mi',
      address: 'Chittagong Port Access Road',
      openHours: 'Closes in 30 mins',
      traffic: 'High Congestion',
      trafficLevel: 'high',
      estPickup: 'Tomorrow, 11AM',
    },
  ]

  const handleConfirmHub = (hubId: string) => {
    navigate('shipping-tracker')
  }

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

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:max-w-3xl md:px-6 md:py-6 lg:max-w-4xl">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Select Pickup Hub</h1>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by zip code or hub ID..."
            className="h-11 pl-10 pr-10 rounded-2xl bg-white border-slate-200 text-xs font-semibold"
          />
          <Crosshair className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer hover:text-primary" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Hubs' },
            { key: 'open', label: 'Open Now' },
            { key: 'low', label: 'Low Congestion' },
            { key: '24_7', label: '24/7' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeFilter === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Hubs List */}
        <div className="space-y-3.5 pt-1 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3.5 md:space-y-0">
          {hubs.map((hub) => {
            const isSelected = selectedHub === hub.id

            return (
              <div
                key={hub.id}
                onClick={() => setSelectedHub(hub.id)}
                className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer shadow-2xs space-y-3 ${
                  isSelected ? 'border-primary ring-2 ring-primary/20 border-l-4 border-l-primary' : 'border-slate-200'
                }`}
              >
                {/* Hub Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">{hub.name}</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {hub.distance} • {hub.address}
                    </p>
                  </div>

                  {isSelected && (
                    <span className="bg-primary text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="h-3 w-3" />
                      Selected
                    </span>
                  )}
                </div>

                {/* Status Tags */}
                <div className="flex gap-2 flex-wrap">
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-500" />
                    {hub.openHours}
                  </span>
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                    <Users className="h-3 w-3 text-slate-500" />
                    {hub.traffic}
                  </span>
                </div>

                {/* Est. Pickup & Action */}
                <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Est. Pickup: <strong className="text-primary">{hub.estPickup}</strong>
                  </span>

                  {isSelected ? (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConfirmHub(hub.id)
                      }}
                      className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shadow-xs"
                    >
                      Confirm Hub
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedHub(hub.id)
                      }}
                      className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-9 px-4 rounded-xl text-xs"
                    >
                      Select Hub
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}