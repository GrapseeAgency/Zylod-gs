'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, RefreshCw, AlertTriangle, LifeBuoy, Send, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react'

/**
 * Task 75 — ADMIN SUPPORT THREADS: the responder half of the buyer support
 * ticket system. Until this page the buyer could create a thread, message
 * into the void, and rate an answer nobody could give. Admins now see EVERY
 * thread, reply into it (senderType 'admin' — the buyer gets a real
 * notification), and drive the status lifecycle (in_progress /
 * waiting_buyer / resolved / closed, assignedTo = the responding admin).
 */

interface ApiTicket {
  id: string
  category: string
  subject: string
  description: string
  priority: string
  status: string
  relatedOrderId: string | null
  rating: number | null
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
  user?: { id: string; email: string; userType: string; buyerProfile?: { fullName: string | null } | null }
  /** Task 76: seller-thread mode — the filer is a supplier, not a user. */
  supplier?: { id: string; companyName: string; email: string } | null
  messageCount?: number
  lastMessage?: { message: string; createdAt: string; senderRole: string } | null
  resolvedAt?: string | null
}

interface ApiMessage {
  id: string
  senderId: string
  senderType?: string
  senderRole?: string
  message: string
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_buyer: 'Waiting on Buyer',
  resolved: 'Resolved',
  closed: 'Closed',
}

/** Task 76: the seller-thread lifecycle (sellerSupportTickets model). */
const SELLER_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
  medium: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
}

export function AdminSupportTicketsPage() {
  const { goBack } = useNavigationStore()
  const { token } = useAuthStore()

  const [tickets, setTickets] = useState<ApiTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'waiting_buyer' | 'resolved' | 'closed'>('all')
  // Task 76: buyer tickets vs seller tickets — one page, two registries.
  const [mode, setMode] = useState<'buyer' | 'seller'>('buyer')

  const [openId, setOpenId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ApiMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [threadError, setThreadError] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)
  const openIdRef = useRef<string | null>(null)
  useEffect(() => { openIdRef.current = openId }, [openId])

  const loadTickets = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    else setLoading(true)
    if (!background) setError('')
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const endpoint = mode === 'buyer' ? '/api/support/tickets' : '/api/supplier/support'
      const res = await fetch(endpoint, { headers })
      if (res.status === 401) { setNeedsAuth(true); setTickets([]); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load tickets (HTTP ${res.status})`)
        if (!background) setTickets([])
        return
      }
      setTickets(Array.isArray(json.data) ? json.data : [])
    } catch {
      if (!background) setError('Network error while loading support threads.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, mode])

  useEffect(() => { loadTickets() }, [loadTickets])

  const toggleThread = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    setThreadLoading(true)
    setThreadError('')
    setMessages([])
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const endpoint = mode === 'buyer'
        ? `/api/support/tickets/${encodeURIComponent(id)}`
        : `/api/supplier/support/${encodeURIComponent(id)}`
      const res = await fetch(endpoint, { headers })
      if (res.status === 401) { setThreadError('Session expired — reload the page.'); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setThreadError(json?.error || `Failed to load thread (HTTP ${res.status})`)
        return
      }
      setMessages(Array.isArray(json.data?.messages) ? json.data.messages : [])
      if (openIdRef.current === id) setOpenId(id)
    } catch {
      setThreadError('Network error while loading the thread.')
    } finally {
      setThreadLoading(false)
    }
  }

  const sendReply = async (ticket: ApiTicket) => {
    if (!reply.trim()) return
    setSending(true)
    setThreadError('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const endpoint = mode === 'buyer'
        ? `/api/support/tickets/${encodeURIComponent(ticket.id)}/messages`
        : `/api/supplier/support/${encodeURIComponent(ticket.id)}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: reply.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setThreadError(json?.error || `Reply failed (HTTP ${res.status})`)
        return
      }
      setMessages((m) => [...m, json.data])
      setReply('')
      // The reply flips the ticket to in_progress server-side — refresh the list quietly.
      void loadTickets(true)
    } catch {
      setThreadError('Network error while sending the reply.')
    } finally {
      setSending(false)
    }
  }

  const setStatus = async (ticket: ApiTicket, status: string) => {
    setStatusBusy(true)
    setThreadError('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const endpoint = mode === 'buyer'
        ? `/api/support/tickets/${encodeURIComponent(ticket.id)}`
        : `/api/supplier/support/${encodeURIComponent(ticket.id)}`
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setThreadError(json?.error || `Status change failed (HTTP ${res.status})`)
        return
      }
      void loadTickets(true)
    } catch {
      setThreadError('Network error while changing the status.')
    } finally {
      setStatusBusy(false)
    }
  }

  const filtered = statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter)
  const count = (s: typeof statusFilter): number | null =>
    s === 'all' ? null : tickets.filter((t) => t.status === s).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-4 md:px-6 md:py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={goBack}
              className="h-10 w-10 rounded-xl border-slate-200 dark:border-slate-800 dark:border-slate-700"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tight flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-primary" /> Support Threads
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                Reply as the platform. Every reply notifies the filer; status changes are yours to drive.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => loadTickets(true)}
            disabled={refreshing}
            className="min-h-11 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 dark:border-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Task 76: buyer tickets vs seller tickets — two registries, one page. */}
        <div className="flex gap-2">
          {(['buyer', 'seller'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setOpenId(null); setStatusFilter('all') }}
              className={`min-h-11 px-5 rounded-xl text-xs font-black uppercase tracking-wide transition ${mode === m ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'bg-white dark:bg-gray-900 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'}`}
            >
              {m === 'buyer' ? 'Buyer Threads' : 'Seller Threads'}
            </button>
          ))}
        </div>

        {needsAuth ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center text-sm font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">
            Admin access required — sign in as an admin to respond to support threads.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'open', 'in_progress', 'waiting_buyer', 'resolved', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`min-h-9 px-3 rounded-xl text-xs font-bold transition ${statusFilter === s ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-gray-900 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-300 hover:border-slate-300'}`}
                >
                  {s === 'all' ? 'All' : STATUS_LABELS[s]}
                  <span className={`ml-1 tabular-nums ${statusFilter === s ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                    {count(s) == null ? '' : count(s)}
                  </span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
                <p className="text-sm font-bold">{error}</p>
                <Button onClick={() => loadTickets()} variant="outline" className="rounded-xl text-xs font-bold">Retry</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl p-10 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 font-medium">
                No support threads{statusFilter !== 'all' ? ` in "${STATUS_LABELS[statusFilter]}"` : ''} right now — honest zero.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((t) => {
                  const isOpen = openId === t.id
                  return (
                    <div key={t.id} className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleThread(t.id)}
                        className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800/50 transition"
                        aria-expanded={isOpen}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black truncate">{t.subject}</span>
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.medium}`}>
                                {t.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {mode === 'buyer'
                                ? (t.user ? `${t.user.buyerProfile?.fullName || t.user.email} · ${t.user.email}` : 'Buyer')
                                : (t.supplier ? `${t.supplier.companyName} · ${t.supplier.email}` : 'Seller')}
                              {' · '}{t.category.replace(/_/g, ' ')}
                              {mode === 'buyer' && t.relatedOrderId ? ` · order ${t.relatedOrderId.slice(-8)}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500">
                              {(mode === 'buyer' ? STATUS_LABELS[t.status] : SELLER_STATUS_LABELS[t.status]) ?? t.status}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {t._count?.messages ?? t.messageCount ?? 0}
                            </span>
                            {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1.5 line-clamp-2">{t.description}</p>
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
                          {threadLoading ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold">Loading thread…</p>
                          ) : (
                            <>
                              {threadError && (
                                <p className="text-xs font-bold text-red-600 flex items-center gap-1.5" role="alert">
                                  <AlertTriangle className="h-3.5 w-3.5" /> {threadError}
                                </p>
                              )}
                              <div className="space-y-2 max-h-80 overflow-y-auto">
                                <div className="bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-3">
                                  <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 dark:text-slate-400">Buyer · opened</span>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{t.description}</p>
                                </div>
                                {messages.map((m) => {
                                  const isAdminMsg = (m.senderType ?? m.senderRole) === 'admin'
                                  return (
                                    <div
                                      key={m.id}
                                      className={`rounded-2xl border p-3 ${isAdminMsg ? 'bg-primary/5 border-primary/20' : 'bg-white dark:bg-gray-900 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
                                    >
                                      <span className={`text-[9px] font-black uppercase ${isAdminMsg ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {isAdminMsg ? 'Zylod Support' : mode === 'buyer' ? 'Buyer' : 'Seller'} · {new Date(m.createdAt).toLocaleString('en-GB')}
                                      </span>
                                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{m.message}</p>
                                    </div>
                                  )
                                })}
                              </div>

                              <div className="flex gap-2">
                                <input
                                  value={reply}
                                  onChange={(e) => setReply(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(t) } }}
                                  placeholder="Reply as Zylod Support…"
                                  aria-label="Reply to the buyer"
                                  className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-white dark:bg-gray-900 dark:bg-slate-900 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <Button
                                  onClick={() => sendReply(t)}
                                  disabled={sending || !reply.trim()}
                                  className="h-11 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-xs gap-1.5"
                                >
                                  <Send className="h-3.5 w-3.5" /> {sending ? 'Sending…' : 'Reply'}
                                </Button>
                              </div>

                              <div className="flex flex-wrap gap-2 pt-1">
                                {(mode === 'buyer'
                                  ? (['in_progress', 'waiting_buyer', 'resolved', 'closed'] as const)
                                  : (['in_progress', 'resolved', 'closed'] as const)
                                ).map((s) => (
                                  <Button
                                    key={s}
                                    variant={s === 'resolved' ? 'default' : 'outline'}
                                    disabled={statusBusy || t.status === s}
                                    onClick={() => setStatus(t, s)}
                                    className={`h-9 px-3 rounded-xl text-[11px] font-bold ${s === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-300'} ${t.status === s ? 'opacity-50' : ''}`}
                                  >
                                    {s === 'resolved' ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : null}
                                    {s === 'closed' ? <XCircle className="h-3.5 w-3.5 mr-1" /> : null}
                                    {(mode === 'buyer' ? STATUS_LABELS[s] : SELLER_STATUS_LABELS[s]) ?? s}
                                  </Button>
                                ))}
                              </div>
                              {t.rating != null && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold">Buyer rated this thread: {t.rating}/5</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminSupportTicketsPage
