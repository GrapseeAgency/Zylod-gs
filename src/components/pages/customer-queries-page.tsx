'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

export function CustomerQueriesPage() {
  const { navigate, goBack } = useNavigationStore();
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/queries')
      .then(res => res.json())
      .then(d => {
        setQueries(d?.queries || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center md:hidden">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="text-xl font-bold">Customer Queries</h1>
      </header>
      <main className="flex-1 p-4 md:px-6 md:py-8 md:max-w-5xl md:w-full md:mx-auto">
        <div className="flex space-x-4 mb-6">
          <button onClick={() => navigate('customer-rfq-inbox')} className="flex-1 md:flex-none md:px-8 bg-white border border-primary text-primary py-2 rounded font-bold">
            View RFQ Inbox
          </button>
        </div>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="space-y-4 md:hidden">
              {queries.map(q => (
                <div key={q.id} onClick={() => navigate('customer-query-detail', { id: q.id })} className="bg-white p-4 rounded shadow cursor-pointer flex items-start">
                  <div className="bg-gray-100 p-3 rounded-full mr-4">
                    <MessageCircle className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-bold">{q.buyerName}</h3>
                      <span className="text-xs text-gray-500">{new Date(q.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">{q.lastMessage}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-700">Buyer</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Last Message</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map(q => (
                    <tr key={q.id} onClick={() => navigate('customer-query-detail', { id: q.id })} className="border-t cursor-pointer hover:bg-red-50/30">
                      <td className="px-4 py-3 font-bold">{q.buyerName}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-md truncate">{q.lastMessage}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(q.createdAt).toLocaleDateString()}</td>
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