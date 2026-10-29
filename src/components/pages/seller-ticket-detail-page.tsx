'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Send, RefreshCw } from 'lucide-react';

/**
 * Task 76-b — the REAL seller support thread (the old file was a 22-line
 * stub with a fake input that submitted nothing). Loads the seller's thread
 * from GET /api/supplier/support/[id] (owner-scoped), renders the messages
 * with sender-role tags, and replies via POST (seller role). Admin replies
 * arrive here through the notification deep-link.
 */

interface ApiMessage {
  id: string
  senderId: string
  senderRole: string
  message: string
  createdAt: string
}

interface ApiThread {
  id: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  createdAt: string
  messages: ApiMessage[]
}

export function SellerTicketDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { goBack, pageParams: storeParams } = useNavigationStore();
  const { token } = useAuthStore();
  const pageParams = _pageParams || storeParams || {};
  const threadId = pageParams.id || '';

  const [thread, setThread] = useState<ApiThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadThread = useCallback(async () => {
    if (!threadId) { setLoading(false); setError('No ticket id given.'); return }
    setLoading(true);
    setError('');
    setNeedsAuth(false);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/supplier/support/${encodeURIComponent(threadId)}`, { headers });
      if (res.status === 401) { setNeedsAuth(true); setThread(null); return }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || `Couldn't load this ticket (HTTP ${res.status})`);
        setThread(null);
        return;
      }
      setThread(json.data);
    } catch {
      setError('Network error while loading the ticket.');
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [threadId, token]);

  useEffect(() => { loadThread(); }, [loadThread]);

  useEffect(() => {
    if (thread?.messages?.length) bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [thread]);

  const sendReply = async () => {
    if (!reply.trim() || !thread) return;
    setSending(true);
    setSendError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/supplier/support/${encodeURIComponent(thread.id)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: reply.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setSendError(json?.error || `Reply failed (HTTP ${res.status})`);
        return;
      }
      setThread((t) => (t ? { ...t, messages: [...t.messages, json.data] } : t));
      setReply('');
    } catch {
      setSendError('Network error while sending the reply.');
    } finally {
      setSending(false);
    }
  };

  const STATUS_STYLES: Record<string, string> = {
    open: 'bg-sky-50 text-sky-700 border-sky-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-slate-100 dark:bg-card text-slate-500 dark:text-neutral-400 border-slate-200 dark:border-neutral-800',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 p-4 md:px-6 flex items-center justify-between border-b sticky top-0 z-20">
        <div className="flex items-center min-w-0">
          <button onClick={goBack} className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none active:scale-95 transition-transform text-slate-600 dark:text-neutral-400 dark:text-neutral-500 hover:text-slate-900 dark:text-neutral-100" aria-label="Go back">←</button>
          <h1 className="font-bold truncate">{thread?.subject ?? 'Ticket'}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={loadThread} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:text-neutral-300 transition-colors" aria-label="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          {thread && (
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border ${STATUS_STYLES[thread.status] ?? STATUS_STYLES.open}`}>
              {thread.status.replace('_', ' ')}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 space-y-3 md:p-6 md:max-w-3xl md:mx-auto md:w-full w-full overflow-y-auto">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-gray-200 rounded-2xl" />
            <div className="h-12 bg-gray-200 rounded-2xl w-2/3" />
          </div>
        ) : needsAuth ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl text-center shadow-sm">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-neutral-300">Sign in required</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Sign in with the seller account that opened this ticket.</p>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl text-center shadow-sm">
            <AlertTriangle className="w-8 h-8 text-red-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-neutral-300">{error}</p>
            <Button variant="outline" onClick={loadThread} className="mt-3 rounded-xl text-xs font-bold">
              Retry
            </Button>
          </div>
        ) : thread ? (
          <>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[9px] font-black uppercase text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
                  You · opened {new Date(thread.createdAt).toLocaleDateString('en-GB')}
                </span>
                <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-neutral-500 dark:text-neutral-400">· {thread.category.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-neutral-300 whitespace-pre-wrap">{thread.description}</p>
            </div>
            {thread.messages.map((m) => {
              const isAdmin = m.senderRole === 'admin';
              return (
                <div key={m.id} className={`p-4 rounded-2xl border ${isAdmin ? 'bg-primary/5 border-primary/20' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm'}`}>
                  <span className={`text-[9px] font-black uppercase ${isAdmin ? 'text-primary' : 'text-slate-400 dark:text-neutral-500'}`}>
                    {isAdmin ? 'Zylod Support' : 'You'} · {new Date(m.createdAt).toLocaleString('en-GB')}
                  </span>
                  <p className="text-xs text-slate-700 dark:text-neutral-300 mt-1 whitespace-pre-wrap">{m.message}</p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        ) : null}
      </main>

      {thread && (
        <footer className="p-4 bg-white dark:bg-gray-900 border-t sticky bottom-0">
          <div className="md:max-w-3xl md:mx-auto w-full">
            {sendError && <p className="text-[11px] font-bold text-red-600 mb-1.5" role="alert">{sendError}</p>}
            <div className="flex">
              <input
                type="text"
                value={reply}
                onChange={(e) => { setReply(e.target.value); setSendError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                placeholder="Reply to Zylod Support…"
                aria-label="Reply to support"
                className="flex-1 border border-gray-200 dark:border-gray-800 rounded-l-xl px-3 h-11 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="bg-primary text-white px-4 rounded-r-xl disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" /> {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
export default SellerTicketDetailPage;
