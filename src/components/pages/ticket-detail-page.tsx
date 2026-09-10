'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Send, MessageSquare, Clock, CheckCircle2,
  AlertCircle, Star, ShieldCheck, User, RefreshCw
} from 'lucide-react'

interface TicketMessage {
  id: string
  senderId: string
  senderType: 'user' | 'admin' | 'system'
  message: string
  createdAt: string
}

interface TicketData {
  id: string
  category: string
  subject: string
  description: string
  priority: string
  status: string
  rating?: number
  ratingComment?: string
  relatedOrderId?: string
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
}

export function TicketDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const ticketId = pageParams.id || pageParams.ticketId || ''
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [rated, setRated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ticketId) {
      fetchTicket()
    } else {
      setLoading(false)
    }
  }, [ticketId])

  async function fetchTicket() {
    setLoading(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`)
      if (res.ok) {
        const json = await res.json()
        setTicket(json.data)
        if (json.data.rating) {
          setRating(json.data.rating)
          setRated(true)
        }
      }
    } catch {}
    setLoading(false)
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || sending || !ticket) return

    setSending(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      })
      if (res.ok) {
        const json = await res.json()
        setTicket(prev => prev ? {
          ...prev,
          messages: [...prev.messages, json.data],
        } : prev)
        setReplyText('')
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    } catch {}
    setSending(false)
  }

  async function handleRateResolution() {
    if (!rating || !ticket) return
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, ratingComment }),
      })
      if (res.ok) {
        setRated(true)
      }
    } catch {}
  }

  async function handleCloseTicket() {
    if (!ticket) return
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      if (res.ok) {
        setTicket(prev => prev ? { ...prev, status: 'closed' } : prev)
      }
    } catch {}
  }

  const statusColor: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    waiting_buyer: 'bg-purple-50 text-purple-700 border-purple-200',
    resolved: 'bg-green-50 text-green-700 border-green-200',
    closed: 'bg-gray-100 text-gray-700 border-gray-200',
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-xs sm:text-sm truncate max-w-xs md:max-w-none">
              Ticket #{ticketId.slice(-8).toUpperCase()}
            </h1>
            <p className="text-[10px] text-gray-400">Official Support Record</p>
          </div>
        </div>

        {ticket && ticket.status !== 'closed' && (
          <button
            onClick={handleCloseTicket}
            className="px-3 py-1 text-xs font-semibold text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Close Ticket
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-4 pb-24 md:px-6 md:py-8 md:space-y-6 md:pb-10">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : !ticket ? (
          <div className="text-center py-16 bg-white rounded-3xl p-6 border border-gray-100 space-y-3">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Ticket Not Found</p>
            <p className="text-xs text-gray-400">The support ticket ID is invalid or has expired.</p>
            <button
              onClick={() => navigate('help-center')}
              className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl"
            >
              Back to Help Center
            </button>
          </div>
        ) : (
          <>
            {/* Ticket Summary Card */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border capitalize ${statusColor[ticket.status] || 'bg-gray-100'}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className="text-[11px] text-gray-400">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div>
                <h2 className="text-sm font-bold text-gray-900">{ticket.subject}</h2>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed bg-slate-50 p-3 rounded-xl border border-gray-100">
                  {ticket.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 pt-1">
                <span className="bg-gray-100 px-2 py-0.5 rounded-md font-medium">Category: {ticket.category.replace('_', ' ')}</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded-md font-medium capitalize">Priority: {ticket.priority}</span>
                {ticket.relatedOrderId && (
                  <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-semibold">
                    Order #{ticket.relatedOrderId.slice(-8)}
                  </span>
                )}
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2.5">
                <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                Discussion Thread ({ticket.messages.length})
              </h3>

              <div className="space-y-3">
                {ticket.messages.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    Your ticket is queued. A support agent will respond here shortly.
                  </p>
                ) : (
                  ticket.messages.map((m) => {
                    const isAdmin = m.senderType === 'admin'
                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-2xl text-xs space-y-1.5 ${
                          isAdmin
                            ? 'bg-red-50/70 border border-red-100 text-gray-900 ml-4'
                            : 'bg-slate-50 border border-gray-100 text-gray-900 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold flex items-center gap-1 ${isAdmin ? 'text-red-700' : 'text-gray-700'}`}>
                            {isAdmin ? <ShieldCheck className="w-3.5 h-3.5 text-red-600" /> : <User className="w-3.5 h-3.5" />}
                            {isAdmin ? 'Zylod Dispute Specialist' : 'You (Buyer / Merchant)'}
                          </span>
                          <span className="text-gray-400">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-line text-gray-800">{m.message}</p>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Form */}
              {ticket.status !== 'closed' && (
                <form onSubmit={handleSendReply} className="pt-3 border-t border-gray-100 space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Type your response or provide additional evidence..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="w-full border border-gray-200 rounded-2xl p-3 text-xs focus:outline-none focus:border-red-500 leading-relaxed"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow transition disabled:opacity-40 flex items-center gap-1.5 ml-auto"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? 'Sending...' : 'Send Reply'}
                  </button>
                </form>
              )}
            </div>

            {/* Satisfaction Rating (if resolved/closed) */}
            {(ticket.status === 'resolved' || ticket.status === 'closed') && (
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center space-y-3">
                <p className="text-xs font-bold text-gray-900">How was your dispute & support experience?</p>
                {rated ? (
                  <div className="flex items-center justify-center gap-1.5 text-green-600 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Thank you for rating our resolution team!
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className="p-1 hover:scale-110 transition"
                        >
                          <Star className={`w-6 h-6 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Optional resolution feedback..."
                      value={ratingComment}
                      onChange={e => setRatingComment(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      onClick={handleRateResolution}
                      disabled={!rating}
                      className="px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl disabled:opacity-40"
                    >
                      Submit Rating
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TicketDetailPage
