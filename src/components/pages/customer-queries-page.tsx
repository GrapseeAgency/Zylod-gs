'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { MessageCircle, AlertCircle, Inbox } from 'lucide-react';

interface QueryRow {
  id: string;
  buyerName: string;
  subject: string;
  lastMessage: string;
  productName: string | null;
  status: string;
  createdAt: string;
}

export function CustomerQueriesPage() {
  const { navigate, goBack } = useNavigationStore();
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/supplier/queries');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setQueries(json.data);
      } else {
        setError(json.error || 'Could not load customer queries');
        setQueries([]);
      }
    } catch {
      setError('Could not reach the queries service');
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center md:hidden">
        <button onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none active:scale-95 transition-transform" aria-label="Go back">←</button>
        <h1 className="text-xl font-bold">Customer Queries</h1>
      </header>
      <main className="flex-1 p-4 md:px-6 md:py-8 md:max-w-5xl md:w-full md:mx-auto">
        <div className="flex space-x-4 mb-6">
          <button onClick={() => navigate('customer-rfq-inbox')} className="flex-1 md:flex-none md:px-8 bg-white dark:bg-gray-900 border border-primary text-primary py-2 rounded font-bold">
            View RFQ Inbox
          </button>
        </div>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded text-center shadow">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{error}</p>
          </div>
        ) : queries.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded text-center shadow">
            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No customer queries yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
              Direct buyer queries — pre-order asks, custom requests, complaints — will land here.
              Today most buyer questions arrive through product Q&amp;A, the RFQ inbox, and chat.
            </p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="space-y-4 md:hidden">
              {queries.map(q => (
                <div key={q.id} onClick={() => navigate('customer-query-detail', { id: q.id })} className="bg-white dark:bg-gray-900 p-4 rounded shadow cursor-pointer flex items-start">
                  <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-full mr-4">
                    <MessageCircle className="w-6 h-6 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center gap-2">
                      <h3 className="font-bold">{q.buyerName}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{new Date(q.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mt-1 truncate">{q.subject}: {q.lastMessage}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800">{q.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-gray-900 border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Buyer</th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Last Message</th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map(q => (
                    <tr key={q.id} onClick={() => navigate('customer-query-detail', { id: q.id })} className="border-t cursor-pointer hover:bg-red-50/30">
                      <td className="px-4 py-3 font-bold">{q.buyerName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 dark:text-gray-500 max-w-md truncate">{q.subject}: {q.lastMessage}</td>
                      <td className="px-4 py-3"><span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800">{q.status}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{new Date(q.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default CustomerQueriesPage;