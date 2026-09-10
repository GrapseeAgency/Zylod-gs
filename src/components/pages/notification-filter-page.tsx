'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Filter, Check, RotateCcw,
  Calendar, Layers, CheckCircle2
} from 'lucide-react'

export function NotificationFilterPage() {
  const { navigate, goBack } = useNavigationStore()

  const [selectedTypes, setSelectedTypes] = useState<string[]>(['order', 'delivery', 'promotion'])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const toggleType = (t: string) => {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const handleApply = () => {
    navigate('notifications', {
      filter: selectedTypes.join(','),
      unreadOnly: unreadOnly ? 'true' : 'false',
      startDate,
      endDate,
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Filter Notifications</span>
        </div>

        <button
          onClick={() => {
            setSelectedTypes([])
            setUnreadOnly(false)
            setStartDate('')
            setEndDate('')
          }}
          className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-xl mx-auto lg:max-w-4xl w-full space-y-6 pb-24 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Type Multi-select */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3 md:row-span-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Notification Categories
          </h2>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'order', label: 'Orders & Payments' },
              { id: 'delivery', label: 'Courier Delivery' },
              { id: 'price_drop', label: 'Price Drops' },
              { id: 'back_in_stock', label: 'Restock Alerts' },
              { id: 'promotion', label: 'Promotions' },
              { id: 'system', label: 'Platform & Safety' },
            ].map(type => {
              const active = selectedTypes.includes(type.id)
              return (
                <button
                  key={type.id}
                  onClick={() => toggleType(type.id)}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between ${
                    active ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 bg-slate-50 text-gray-700'
                  }`}
                >
                  <span>{type.label}</span>
                  {active && <Check className="w-3.5 h-3.5" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Read Status */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Read Status
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setUnreadOnly(false)}
              className={`p-3 rounded-2xl border text-xs font-bold transition ${
                !unreadOnly ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 bg-slate-50 text-gray-700'
              }`}
            >
              All Notifications
            </button>
            <button
              onClick={() => setUnreadOnly(true)}
              className={`p-3 rounded-2xl border text-xs font-bold transition ${
                unreadOnly ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 bg-slate-50 text-gray-700'
              }`}
            >
              Unread Only
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Date Window
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-500 font-bold block mb-1">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 font-bold block mb-1">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </div>
        </div>

        {/* Apply CTA */}
        <Button
          onClick={handleApply}
          className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md text-xs sm:text-sm"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  )
}

export default NotificationFilterPage
