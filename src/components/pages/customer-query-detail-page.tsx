'use client';

/**
 * Customer query detail (Task 133) — the REAL thread behind the seller
 * console's query rows. The old page was a hard-coded placeholder: a fake
 * "Can you do 500 units by next week?" bubble, a dead input, a dead Send
 * button. Now it consumes GET /api/supplier/queries/[id] (buyer, product,
 * status, the buyer's message) and PATCH /api/supplier/queries/[id] for the
 * real reply (replyMessage stamps repliedAt and flips status to 'replied'
 * server-side, audit-logged) and status transitions (resolved/closed).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, MessageCircle, AlertCircle, Inbox, Loader2, Send,
  RefreshCw, Package, CheckCircle2, XCircle, Clock,
} from 'lucide-react';

interface QueryDetail {
  id: string;
  queryType: string;
  subject: string;
  message: string;
  status: string;
  replyMessage: string | null;
  repliedAt: string | null;
  createdAt: string;
  buyerName: string;
  productName: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  replied: 'bg-sky-50 text-sky-700 border-sky-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
};

export function CustomerQueryDetailPage({ id: idProp, pageParams }: { id?: string; pageParams?: Record<string, string> }) {
  const { goBack, pageParams: storeParams } = useNavigationStore();
  const { token } = useAuthStore();
  const queryId = idProp || pageParams?.id || storeParams?.id || '';

  const [query, setQuery] = useState<QueryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMoving, setStatusMoving] = useState(false);

  const load = useCallback(async () => {
    if (!queryId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    setNeedsAuth(false);
    setNotFound(false);
    try {
      const res = await fetch(`/api/supplier/queries/${encodeURIComponent(queryId)}`, {
        credentials: 'include',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      if (res.status === 401) { setNeedsAuth(true); setQuery(null); return; }
      if (res.status === 404) { setNotFound(true); setQuery(null); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || `Could not load the query (HTTP ${res.status}).`);
        setQuery(null);
        return;
      }
      setQuery(json.data as QueryDetail);
    } catch {
      setError('Network error while loading the query. Check your connection and retry.');
      setQuery(null);
    } finally {
      setLoading(false);
    }
  }, [queryId, token]);

  useEffect(() => { load(); }, [load]);

  const sendReply = async () => {
    const message = reply.trim();
    if (!message) {
      toast.error('Write a reply first — empty replies are refused.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/supplier/queries/${encodeURIComponent(queryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ replyMessage: message }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Reply failed (HTTP ${res.status}).`);
        return;
      }
      toast.success('Reply sent — the query is marked replied.');
      setReply('');
      await load();
    } catch {
      toast.error('Network error while sending the reply. Check your connection and retry.');
    } finally {
      setSending(false);
    }
  };

  const moveStatus = async (status: 'resolved' | 'closed' | 'open') => {
    setStatusMoving(true);
    try {
      const res = await fetch(`/api/supplier/queries/${encodeURIComponent(queryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || `Status change failed (HTTP ${res.status}).`);
        return;
      }
      toast.success(`Query marked ${status}.`);
      await load();
    } catch {
      toast.error('Network error while changing the status.');
    } finally {
      setStatusMoving(false);
    }
  };

  // ── Honest guard states ──
  if (!loading && !queryId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow text-center max-w-xs space-y-3">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No query selected</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Open a query from the Customer Queries list.</p>
          <Button onClick={goBack} variant="outline" className="h-9 text-xs font-bold">Go back</Button>
        </div>
      </div>
    );
  }

  if (!loading && needsAuth) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow text-center max-w-xs space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Sign in required</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Only the seller who owns this query (or an admin) can view it.</p>
        </div>
      </div>
    );
  }

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow text-center max-w-xs space-y-3">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Query not found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">It may have been removed, or it belongs to another seller.</p>
        </div>
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow text-center max-w-xs space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Could not load the query</h3>
          <p className="text-xs text-red-600 break-words">{error}</p>
          <Button onClick={load} variant="outline" className="h-9 text-xs font-bold gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading query thread…
        </div>
      </div>
    );
  }

  if (!query) return null;

  const isClosed = query.status === 'closed' || query.status === 'resolved';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 p-4 flex items-center justify-between border-b md:hidden">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-3" aria-label="Back">←</button>
          <h1 className="font-bold text-sm">Query thread</h1>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[query.status] || 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'}`}>
          {query.status}
        </span>
      </header>

      <main className="flex-1 p-4 md:px-6 md:py-8 space-y-4 md:space-y-5 md:max-w-3xl md:w-full md:mx-auto pb-40 md:pb-32">
        {/* Query facts */}
        <div className="bg-white dark:bg-gray-900 p-4 md:p-5 rounded-2xl shadow-sm space-y-3" data-testid="query-detail-card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">{query.subject}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {query.buyerName} · {new Date(query.createdAt).toLocaleString()}
              </p>
            </div>
            <span className={`hidden md:inline-flex text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[query.status] || 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'}`}>
              {query.status}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="font-bold uppercase tracking-wide text-[9px] bg-gray-100 dark:bg-gray-900 rounded px-1.5 py-0.5">{query.queryType.replace(/_/g, ' ')}</span>
            {query.productName && (
              <span className="flex items-center gap-1 truncate">
                <Package className="h-3 w-3 shrink-0" /> {query.productName}
              </span>
            )}
          </div>

          {/* The buyer's real message */}
          <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl p-3.5" data-testid="query-buyer-message">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
              <MessageCircle className="h-3 w-3" /> {query.buyerName}
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{query.message}</p>
          </div>

          {/* The seller's real reply, when one exists */}
          {query.replyMessage ? (
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5" data-testid="query-seller-reply">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">
                <span>Your reply</span>
                {query.repliedAt && <span>{new Date(query.repliedAt).toLocaleString()}</span>}
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{query.replyMessage}</p>
            </div>
          ) : (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2" data-testid="query-awaiting-reply">
              No reply yet — this query is waiting on you.
            </p>
          )}

          {/* Status transitions — real PATCH, audit-logged server-side */}
          <div className="flex items-center gap-2 pt-1 flex-wrap" data-testid="query-status-actions">
            {query.status !== 'resolved' && (
              <Button
                variant="outline" size="sm" disabled={statusMoving}
                onClick={() => moveStatus('resolved')}
                className="h-8 text-[11px] font-bold gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
              </Button>
            )}
            {query.status !== 'open' && query.status !== 'closed' && (
              <Button
                variant="outline" size="sm" disabled={statusMoving}
                onClick={() => moveStatus('open')}
                className="h-8 text-[11px] font-bold gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <Clock className="h-3.5 w-3.5" /> Reopen
              </Button>
            )}
            {query.status !== 'closed' && (
              <Button
                variant="outline" size="sm" disabled={statusMoving}
                onClick={() => moveStatus('closed')}
                className="h-8 text-[11px] font-bold gap-1.5 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <XCircle className="h-3.5 w-3.5" /> Close
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Reply composer — the real PATCH */}
      {!isClosed && (
        <footer className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t p-3 md:px-6 md:py-4" data-testid="query-reply-composer">
          <div className="flex w-full md:max-w-3xl md:mx-auto gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write your reply to the buyer…"
              rows={2}
              maxLength={2000}
              aria-label="Reply message"
              className="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              className="bg-primary hover:bg-primary/90 text-white h-auto px-4 rounded-xl text-xs font-bold gap-1.5 self-end"
              data-testid="query-reply-send"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default CustomerQueryDetailPage;
