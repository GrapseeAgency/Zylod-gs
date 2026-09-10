'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, MoreVertical, Info, ChevronLeft, ChevronRight,
  CheckCircle2, Sun, Sunset
} from 'lucide-react'

export function RescheduleDeliveryPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || 'WS-992834-A'

  const [selectedDay, setSelectedDay] = useState<number>(9)
  const [selectedWindow, setSelectedWindow] = useState<'morning' | 'afternoon'>('morning')
  const [instructions, setInstructions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setConfirmed(true)
    }, 900)
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 bg-rose-50 text-primary rounded-full flex items-center justify-center mb-4 border border-rose-100 shadow-md">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Delivery Rescheduled</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Order #{orderId} is now rescheduled for <strong>Nov {selectedDay}, 2023 ({selectedWindow === 'morning' ? '8:00 AM - 12:00 PM' : '12:00 PM - 4:00 PM'})</strong>.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('shipping-tracker')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            Track Updated Delivery
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-lg font-black text-slate-900">Reschedule Delivery</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">Order #{orderId}</p>
          </div>

          {/* Original Schedule Notice */}
          <div className="p-3.5 bg-slate-100/70 rounded-2xl border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Original schedule: <strong>Oct 24, 2023 (10:00 AM - 2:00 PM)</strong>
            </p>
          </div>

          {/* Select New Date */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">Select New Date</h2>
              <div className="flex items-center gap-2">
                <button className="p-1 text-slate-500 hover:text-slate-900">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-black text-slate-900">November 2023</span>
                <button className="p-1 text-slate-500 hover:text-slate-900">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-2">
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400">
                <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
              </div>

              <div className="grid grid-cols-7 text-center text-xs font-semibold gap-y-2">
                {/* Empty days for Nov 2023 (starts on Wed) */}
                <span /><span /><span />
                <span>1</span><span>2</span><span>3</span><span>4</span>
                <span>5</span><span>6</span><span>7</span><span>8</span>
                <button
                  onClick={() => setSelectedDay(9)}
                  className="w-8 h-8 rounded-full bg-primary text-white mx-auto flex items-center justify-center font-bold shadow-md shadow-primary/25"
                >
                  9
                </button>
                <button onClick={() => setSelectedDay(10)} className="w-8 h-8 rounded-full hover:bg-slate-100 mx-auto flex items-center justify-center">10</button>
                <button onClick={() => setSelectedDay(11)} className="w-8 h-8 rounded-full hover:bg-slate-100 mx-auto flex items-center justify-center">11</button>
                <button onClick={() => setSelectedDay(12)} className="w-8 h-8 rounded-full hover:bg-slate-100 mx-auto flex items-center justify-center">12</button>
                <button onClick={() => setSelectedDay(13)} className="w-8 h-8 rounded-full hover:bg-slate-100 mx-auto flex items-center justify-center">13</button>
                <button onClick={() => setSelectedDay(14)} className="w-8 h-8 rounded-full hover:bg-slate-100 mx-auto flex items-center justify-center">14</button>
                <button onClick={() => setSelectedDay(15)} className="w-8 h-8 rounded-full hover:bg-slate-100 mx-auto flex items-center justify-center">15</button>
              </div>
            </div>
          </div>

          {/* Select Time Window */}
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-bold text-slate-900">Select Time Window</h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedWindow('morning')}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  selectedWindow === 'morning'
                    ? 'bg-rose-50 border-primary ring-1 ring-primary/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <h3 className={`text-xs font-bold ${selectedWindow === 'morning' ? 'text-primary' : 'text-slate-900'}`}>
                  Morning
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">8:00 AM - 12:00 PM</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedWindow('afternoon')}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  selectedWindow === 'afternoon'
                    ? 'bg-rose-50 border-primary ring-1 ring-primary/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <h3 className={`text-xs font-bold ${selectedWindow === 'afternoon' ? 'text-primary' : 'text-slate-900'}`}>
                  Afternoon
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">12:00 PM - 4:00 PM</p>
              </button>
            </div>
          </div>

          {/* Special Delivery Instructions */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-900 block">
              Special Delivery Instructions
            </label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Forklift required, call 30 mins before arrival, use side gate..."
              rows={3}
              className="rounded-2xl bg-white border-slate-200 text-xs font-medium resize-none"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              onClick={goBack}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
            >
              Cancel
            </Button>

            <Button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              {submitting ? 'Updating Schedule...' : 'Confirm Reschedule'}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default RescheduleDeliveryPage
