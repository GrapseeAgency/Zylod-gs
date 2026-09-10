'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { CalendarDays, MapPin, ArrowUpRight, RefreshCw } from 'lucide-react'

interface TradeEvent {
  id: string
  title: string
  description: string
  location: string
  startsAt: string
}

export function EventsPage() {
  const { navigate } = useNavigationStore()
  const [events, setEvents] = useState<TradeEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = () => {
    setLoading(true)
    fetch('/api/events')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) setEvents(data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-6 md:px-6 md:py-10">
        <div className="max-w-3xl mx-auto md:max-w-5xl">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Zylod Events</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Trade Events & Trade Fairs</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Trade fairs, buyer meetups, and supplier exhibitions across Bangladesh's wholesale hubs.
          </p>
        </div>
      </div>

      <main className="px-4 py-6 md:px-6 md:py-8 max-w-3xl mx-auto md:max-w-5xl w-full">
        {loading ? (
          <div className="space-y-4 md:space-y-5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100">
            <CalendarDays className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No events scheduled right now</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Trade fairs and buyer meetups will be announced here. Check back soon.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEvents}
              className="mt-4 text-xs font-semibold text-primary border-primary hover:bg-primary/5 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-5">
            {events.map(event => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs hover:border-primary/30 transition-colors md:flex md:items-center md:justify-between md:gap-6 md:p-6"
              >
                <div className="space-y-1.5">
                  <h2 className="text-sm md:text-base font-bold text-slate-900">{event.title}</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">{event.description}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(event.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('contact-us')}
                  className="mt-4 md:mt-0 shrink-0 text-xs font-semibold text-primary border-primary hover:bg-primary/5 gap-1"
                >
                  Enquire
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default EventsPage
