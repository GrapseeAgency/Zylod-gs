'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Send, Paperclip, MoreVertical, ShieldCheck,
  User, Bot, CheckCheck, RefreshCw, X, AlertCircle
} from 'lucide-react'

interface Message {
  id: string
  senderId: string
  senderType: 'user' | 'agent' | 'chatbot' | 'system'
  message: string
  createdAt: string
}

interface ChatSession {
  id: string
  status: string
  subject?: string
}

export function LiveChatPage() {
  const { navigate, goBack } = useNavigationStore()
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initChatSession()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function initChatSession() {
    setLoading(true)
    try {
      // Find active live_chat session or create new
      const res = await fetch('/api/support/chat/sessions')
      if (res.ok) {
        const json = await res.json()
        const active = (json.data || []).find((s: any) => s.type === 'live_chat' && s.status === 'active')
        if (active) {
          setSession(active)
          await loadMessages(active.id)
          setLoading(false)
          return
        }
      }

      // Create new session
      const createRes = await fetch('/api/support/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'live_chat', subject: 'Wholesale Buyer Support' }),
      })
      if (createRes.ok) {
        const json = await createRes.json()
        setSession(json.data)
        await loadMessages(json.data.id)
      }
    } catch {}
    setLoading(false)
  }

  async function loadMessages(sessionId: string) {
    try {
      const res = await fetch(`/api/support/chat/sessions/${sessionId}/messages`)
      if (res.ok) {
        const json = await res.json()
        setMessages(json.data || [])
      }
    } catch {}
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputMessage.trim() || !session || sending) return

    const text = inputMessage.trim()
    setInputMessage('')
    setSending(true)

    // Optimistic user message
    const tempMsg: Message = {
      id: 'temp-' + Date.now(),
      senderId: 'user',
      senderType: 'user',
      message: text,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const res = await fetch(`/api/support/chat/sessions/${session.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (res.ok) {
        const json = await res.json()
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? json.data : m))
      }
    } catch {
      // Keep optimistic message or retry
    }
    setSending(false)
  }

  async function endChat() {
    if (!session) return
    try {
      await fetch(`/api/support/chat/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      })
      setSession(s => s ? { ...s, status: 'ended' } : null)
    } catch {}
  }

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh-60px)] bg-slate-100 max-w-2xl md:max-w-3xl mx-auto w-full border-x border-gray-200">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs">
              ZS
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
              Zylod Live Support
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            </h1>
            <p className="text-[10px] text-green-600 font-medium">Specialist Online • Dhaka HQ</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session && session.status === 'active' && (
            <button
              onClick={endChat}
              className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              End Chat
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 md:px-6 md:py-5 space-y-3">
        {loading ? (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <Skeleton className="h-12 w-3/4 rounded-2xl ml-auto" />
            <Skeleton className="h-10 w-1/2 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ShieldCheck className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-xs font-bold text-gray-800">Protected Live Support Session</p>
            <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
              Your conversation is encrypted. Ask anything regarding orders, delivery status, or supplier disputes.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.senderType === 'user'
            const isSystem = msg.senderType === 'system'

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center my-3">
                  <span className="inline-block px-3 py-1 bg-white/80 border border-gray-200 rounded-full text-[10px] text-gray-500 shadow-sm">
                    {msg.message}
                  </span>
                </div>
              )
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1">
                    ZS
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs shadow-sm leading-relaxed ${
                    isUser
                      ? 'bg-red-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.message}</p>
                  <div className={`flex items-center gap-1 mt-1 text-[9px] ${isUser ? 'text-red-200 justify-end' : 'text-gray-400'}`}>
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isUser && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="bg-white border-t border-gray-200 p-3 md:px-6">
        {session?.status === 'ended' ? (
          <div className="text-center py-2 space-y-2">
            <p className="text-xs text-gray-500">This chat session has ended.</p>
            <button
              onClick={initChatSession}
              className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl"
            >
              Start New Chat
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type your question..."
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-red-500 placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || sending}
              className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default LiveChatPage
