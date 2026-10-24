'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, MessageCircleQuestion, Loader2, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface QueryRow {
  id: string;
  queryType: string;
  subject: string;
  message: string;
  status: string;
  replyMessage: string | null;
  repliedAt: string | null;
  createdAt: string;
  supplierName: string | null;
  product?: { id: string; name: string } | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function BuyerQueriesPage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [rows, setRows] = useState<QueryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/queries');
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 401) setAuthRequired(true);
        else if (res.ok && json?.success) setRows(json.data?.queries ?? []);
        else setError(json?.error || 'Could not load your questions.');
      } catch {
        if (alive) setError('Network error loading your questions.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const statusBadge = (s: string) =>
    s === 'replied' ? (
      <Badge className="bg-emerald-600 text-white">Replied</Badge>
    ) : s === 'resolved' ? (
      <Badge variant="outline" className="border-emerald-200 text-emerald-700">Resolved</Badge>
    ) : s === 'closed' ? (
      <Badge variant="outline" className="border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">Closed</Badge>
    ) : (
      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Awaiting reply</Badge>
    );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-900 dark:bg-gray-800 px-4 md:px-6 py-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={goBack} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:bg-gray-700 transition" aria-label="Go back">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="w-5 h-5 text-teal-600" />
          <div>
            <h1 className="font-bold text-gray-900 dark:text-gray-100 dark:text-white text-base md:text-xl">My Questions</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">What you asked the stores — and their replies</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3 pb-24 md:pb-8">
        {loading ? (
          [1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-5 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))
        ) : authRequired ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-8 text-center space-y-3">
            <Inbox className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Sign in to see your questions</p>
            <Button size="sm" onClick={() => navigate('login')}>Sign In</Button>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-8 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">{error}</div>
        ) : !rows || rows.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-8 text-center space-y-2">
            <MessageCircleQuestion className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-white">No questions yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Visit a store and press “Ask the seller” — pre-order terms, custom orders, complaints.</p>
          </div>
        ) : (
          rows.map((q) => (
            <div key={q.id} className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-4 sm:p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 dark:text-white text-sm truncate">{q.subject}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {q.supplierName ?? 'A store'} · {q.queryType.replace('_', ' ')} · {fmtDate(q.createdAt)}
                  </p>
                </div>
                {statusBadge(q.status)}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{q.message}</p>
              {q.replyMessage && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3 mt-1">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase mb-1">
                    {q.supplierName ?? 'The seller'} replied {q.repliedAt ? `· ${fmtDate(q.repliedAt)}` : ''}
                  </p>
                  <p className="text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-line">{q.replyMessage}</p>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default BuyerQueriesPage;
