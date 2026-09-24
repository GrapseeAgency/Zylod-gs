'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import {
  Menu, MoreVertical, Info, Send, User, MessageSquareOff, AlertCircle
} from 'lucide-react'

/**
 * Delivery chat — NOT yet connected to a backend.
 *
 * There is no delivery-chat API or realtime transport in the project yet, so
 * this page renders an honest empty state: no seeded messages, no invented
 * driver identity, no fabricated delivery status. Sending a message surfaces
 * a real error instead of a fake success.
 */

// The conversation participant's real name is unknown until a backend exists —
// the avatar renders a neutral User icon instead of a stock photo.
const participantName: string | null = null

function ParticipantAvatar({ sizeClass }: { sizeClass: string }) {
  if (participantName) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold shrink-0`}
        aria-label={participantName}
      >
        {participantName.charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0`}
      aria-label="Delivery participant"
    >
      <User className="h-1/2 w-1/2" />
    </div>
  )
}

export function DeliveryChatPage() {
  const { navigate } = useNavigationStore()

  // Real chat state: empty until a real backend delivers messages.
  const [messages] = useState<{ id: string; sender: string; text: string; time: string }[]>([])
  const [inputVal, setInputVal] = useState('')
  const [sendError, setSendError] = useState('')

  const handleSend = () => {
    const text = inputVal.trim()
    if (!text) return

    // No delivery-chat endpoint exists — report the real error, never fake
    // success by appending the message locally.
    setSendError('Chat is not connected yet. Your message could not be sent.')
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

      {/* Participant Sub-Header — no invented driver identity or ETA */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <ParticipantAvatar sizeClass="w-11 h-11" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Delivery Chat</h2>
            <p className="text-[11px] text-slate-500">Not connected to a delivery conversation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('shipping-tracker')}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
            title="Open shipment tracker"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Real error banner — shown when sending without a backend */}
      {sendError && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-700">{sendError}</p>
            <p className="text-[11px] text-red-500 mt-0.5">
              Live delivery chat requires a messaging backend, which is not available yet.
            </p>
          </div>
          <button
            onClick={() => setSendError('')}
            className="text-[11px] font-bold text-red-500 hover:text-red-700 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Chat Thread Container */}
      <main className="flex-1 px-4 py-5 md:py-8 max-w-lg mx-auto w-full lg:max-w-3xl">
        {messages.length === 0 ? (
          <div className="text-center py-14">
            <MessageSquareOff className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No messages yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              This conversation has no messages. Live chat with your delivery partner will appear
              here once a shipment with real-time tracking is active.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2.5 items-end justify-start">
                <ParticipantAvatar sizeClass="w-7 h-7" />
                <div className="max-w-[78%] rounded-3xl p-4 shadow-2xs space-y-1 bg-white text-slate-900 border border-slate-200 rounded-bl-none">
                  <p className="text-xs md:text-sm leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-end text-[10px] text-slate-400">
                    <span>{msg.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Input Bar — sending without a backend shows a real error */}
      <div className="bg-white border-t border-slate-200 p-3 max-w-lg mx-auto w-full lg:max-w-3xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
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

export default DeliveryChatPage
