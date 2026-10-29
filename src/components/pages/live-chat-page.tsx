'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
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
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [chatError, setChatError] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Deep links can mount before the boot session probe settles — keep loading briefly.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  async function loadMessages(sessionId: string) {
    try {
      const res = await fetch(`/api/support/chat/sessions/${sessionId}/messages`)
      if (res.ok) {
        const json = await res.json()
        setMessages(json.data || [])
      }
    } catch {}
  }

  async function initChatSession() {
    if (!isAuthenticated || !token) return
    setLoading(true)
    setChatError('')
    try {
      // t229i: chat-detail deep links carry conversationId (header chat
      // notifications). Resolve that exact session first so the user lands
      // inside THEIR conversation, not a fresh one.
      const deepLinkId = (pageParams as Record<string, string> | undefined)?.conversationId
      const res = await fetch('/api/support/chat/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (res.ok) {
        const json = await res.json()
        const sessions: ChatSession[] = json.data || []
        // Deep-linked conversation wins; otherwise the active live_chat
        // session; if neither exists the create flow below runs.
        const active = deepLinkId
          ? sessions.find((s: any) => s.id === deepLinkId)
          : sessions.find((s: any) => s.type === 'live_chat' && s.status === 'active')
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'live_chat', subject: 'Wholesale Buyer Support' }),
      })
      if (createRes.status === 401 || createRes.status === 403) {
        setSessionExpired(true)
        return
      }
      if (createRes.ok) {
        const json = await createRes.json()
        setSession(json.data)
        await loadMessages(json.data.id)
      } else {
        const json = await createRes.json().catch(() => null)
        setChatError(json?.error || `Live chat is unavailable right now (HTTP ${createRes.status}).`)
      }
    } catch {
      setChatError('Network error while opening the chat session. Check your connection and retry.')
    }
    setLoading(false)
  }

  useEffect(() => {
    initChatSession()
  }, [])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])




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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      })
      if (res.ok) {
        const json = await res.json()
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? json.data : m))
      } else {
        const json = await res.json().catch(() => null)
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
        setInputMessage(text)
        setChatError(json?.error || `Your message could not be sent (HTTP ${res.status}).`)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
      setInputMessage(text)
      setChatError('Network error — your message was not sent. Check your connection and retry.')
    }
    setSending(false)
  }

  async function endChat() {
    if (!session) return
    try {
      await fetch(`/api/support/chat/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: 'ended' }),
      })
      setSession(s => s ? { ...s, status: 'ended' } : null)
    } catch {}
  }

  if (sessionExpired) {
    return (
      <AccountGate
        title="Session expired"
        message="Your session has expired. Sign in again to chat with Zylod support."
      />
    )
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to use live chat"
        message="Live support chats are tied to your real account and orders. Sign in to continue."
      />
    )
  }

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh-60px)] bg-slate-100 dark:bg-card max-w-2xl md:max-w-3xl mx-auto w-full border-x border-gray-200 dark:border-gray-800">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="relative">
            {/* t187-d: brand mark only — no fake "agent online" presence dot,
                because no agent-status API exists. */}
            <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs">
              Z
            </div>
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              Zylod Live Support
              <ShieldCheck className="w-3.5 h-3.5 text-primary/80" />
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Support team reviews messages and replies here</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session && session.status === 'active' && (
            <button
              onClick={endChat}
              className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-red-600 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 transition"
            >
              End Chat
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 md:px-6 md:py-5 space-y-3">
        {!loading && chatError && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-3 text-xs text-red-700 dark:text-red-300" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{chatError}</span>
            <button onClick={initChatSession} className="text-[11px] font-bold underline flex-shrink-0">Retry</button>
          </div>
        )}
        {loading ? (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <Skeleton className="h-12 w-3/4 rounded-2xl ml-auto" />
            <Skeleton className="h-10 w-1/2 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ShieldCheck className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Protected Live Support Session</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
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
                  <span className="inline-block px-3 py-1 bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-full text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 shadow-sm">
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
                    Z
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs shadow-sm leading-relaxed ${
                    isUser
                      ? 'bg-red-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.message}</p>
                  <div className={`flex items-center gap-1 mt-1 text-[9px] ${isUser ? 'text-red-200 justify-end' : 'text-gray-400 dark:text-gray-500'}`}>
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
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3 md:px-6">
        {session?.status === 'ended' ? (
          <div className="text-center py-2 space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">This chat session has ended.</p>
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
              className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-2xl px-4 py-2.5 text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-red-500 placeholder:text-gray-400 dark:text-gray-500"
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
