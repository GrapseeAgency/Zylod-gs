'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, HelpCircle, Truck, Warehouse, Package,
  ShieldCheck, ShoppingCart, Headphones, Clock
} from 'lucide-react'

export function OrderTimelinePage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || '88291'

  const timelineEvents = [
    {
      id: 'e-1',
      title: 'Out for Delivery',
      time: '08:45 AM',
      description: 'Your package has left the local facility and is with the courier.',
      date: 'Oct 23, 2023',
      icon: Truck,
      isLatest: true,
    },
    {
      id: 'e-2',
      title: 'Shipped from Hub',
      time: '14:20 PM',
      description: 'Consolidation complete. Dispatched from main distribution center.',
      date: 'Oct 22, 2023',
      icon: Warehouse,
    },
    {
      id: 'e-3',
      title: 'Procurement Complete',
      time: '09:15 AM',
      description: 'All items gathered from vendors and quality checked.',
      date: 'Oct 21, 2023',
      icon: Package,
    },
    {
      id: 'e-4',
      title: 'Payment Verified',
      time: '11:30 AM',
      description: 'Wire transfer confirmed. Funds secured in escrow.',
      date: 'Oct 20, 2023',
      icon: ShieldCheck,
    },
    {
      id: 'e-5',
      title: 'Order Placed',
      time: '10:45 AM',
      description: `Order #${orderId} created pending payment verification.`,
      date: 'Oct 20, 2023',
      icon: ShoppingCart,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5 text-primary" />
            </button>
            <h1 className="text-base font-bold text-primary">Order #{orderId}</h1>
          </div>
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Help">
            <HelpCircle className="h-5 w-5 text-primary" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto md:max-w-2xl">
        {/* Expected Delivery Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Expected Delivery</span>
            <span className="bg-rose-50 text-primary text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-100">
              In Transit
            </span>
          </div>

          <div className="text-lg font-black text-primary">
            Oct 24 - Oct 26
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
            <Truck className="h-4 w-4 text-slate-400" />
            <span>Carrier: FastTrack Logistics • TRK-99281744</span>
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="space-y-6 pt-2 pl-2 relative before:absolute before:left-7 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
          {timelineEvents.map((event) => {
            const Icon = event.icon

            return (
              <div key={event.id} className="relative flex items-start gap-4">
                {/* Icon Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    event.isLatest
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'bg-rose-50 text-slate-700 border border-rose-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* Event Details Card */}
                <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900">{event.title}</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">{event.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{event.description}</p>
                  <p className="text-[10px] text-slate-400 font-medium pt-1">{event.date}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Contact Support CTA */}
        <div className="pt-4">
          <Button
            variant="outline"
            onClick={() => navigate('help-center')}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Headphones className="h-4 w-4" />
            Contact Support
          </Button>
        </div>
      </main>
    </div>
  )
}

export default OrderTimelinePage
