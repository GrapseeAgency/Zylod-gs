'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Menu, MoreVertical, Phone, Info, Paperclip, Send,
  CheckCheck, CheckCircle2, User, Truck, Warehouse, Calculator
} from 'lucide-react'

interface ChatMessage {
  id: string
  sender: 'driver' | 'user'
  text: string
  time: string
}

export function DeliveryChatPage() {
  const { navigate } = useNavigationStore()

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'driver',
      text: "Hello, I'm en route with shipment #B2B-8902. Estimated arrival is 14:30.",
      time: '14:15',
    },
    {
      id: 'm-2',
      sender: 'user',
      text: 'Great, thanks for the update. Are you coming through the main gate?',
      time: '14:17',
    },
    {
      id: 'm-3',
      sender: 'driver',
      text: 'Yes, heading to the main gate now. I have 3 pallets total.',
      time: '14:18',
    },
  ])

  const [inputVal, setInputVal] = useState('')

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputVal
    if (!text.trim()) return

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, newMsg])
    if (!textToSend) setInputVal('')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0 text-slate-900">
      {/* Top Main Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button className="p-1 text-slate-700 hover:text-slate-900" title="Menu">
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-xl font-black tracking-tight text-primary">Logistics Suite</span>
        <button className="p-1 text-slate-700 hover:text-slate-900" title="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      {/* Driver Sub-Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          {/* Driver Avatar */}
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-slate-200 border-2 border-white shadow overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
                alt="Marcus T."
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900">Marcus T.</h2>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-[11px] text-slate-500">Freight Partner • 12 mins away</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('tel:+8801711000000')}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            title="Call Driver"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('shipping-tracker')}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            title="Driver Info"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat Thread Container */}
      <main className="flex-1 px-4 py-5 md:py-8 space-y-4 max-w-lg mx-auto w-full lg:max-w-3xl">
        {/* Date Pill */}
        <div className="text-center">
          <span className="bg-slate-200/80 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Today
          </span>
        </div>

        {/* Message Bubbles */}
        <div className="space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user'

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-end ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                      alt="Driver"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div
                  className={`max-w-[78%] rounded-3xl p-4 shadow-2xs space-y-1 ${
                    isUser
                      ? 'bg-primary text-white rounded-br-none'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="text-xs md:text-sm leading-relaxed">{msg.text}</p>
                  <div className={`flex items-center justify-end gap-1 text-[10px] ${isUser ? 'text-rose-200' : 'text-slate-400'}`}>
                    <span>{msg.time}</span>
                    {isUser && <CheckCheck className="h-3.5 w-3.5 text-white" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Quick Reply Suggestion Chips */}
      <div className="bg-white border-t border-slate-100 px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar max-w-lg mx-auto w-full lg:max-w-3xl">
        {[
          'I am at the warehouse',
          'Please leave at Gate 4',
          'Call when at gate',
        ].map((chip) => (
          <button
            key={chip}
            onClick={() => handleSend(chip)}
            className="px-3.5 py-1.5 rounded-full border border-primary text-primary hover:bg-rose-50 text-xs font-semibold whitespace-nowrap transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="bg-white border-t border-slate-200 p-3 max-w-lg mx-auto w-full lg:max-w-3xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            className="p-2 text-slate-400 hover:text-slate-700"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <Input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type a message..."
            className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium focus-visible:ring-primary"
          />

          <Button
            type="submit"
            disabled={!inputVal.trim()}
            className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center p-0 shrink-0 shadow-md"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
