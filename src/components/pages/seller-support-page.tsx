'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { LifeBuoy, PlusCircle, AlertCircle, TicketCheck } from 'lucide-react';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  category: string;
  createdAt: string;
  messageCount: number;
}

export function SellerSupportPage() {
  const { navigate, goBack } = useNavigationStore();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/supplier/support');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setTickets(json.data);
      } else {
        setError(json.error || 'Could not load support tickets');
        setTickets([]);
      }
    } catch {
      setError('Could not reach the support service');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="md:hidden bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Seller Support</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Seller Support</h1>
      <main className="flex-1 p-4">
        <div className="mb-6 flex space-x-4">
          <button onClick={() => navigate('seller-create-ticket')} className="flex-1 bg-white dark:bg-gray-900 border border-primary text-primary py-3 rounded-lg flex items-center justify-center font-bold">
            <PlusCircle className="w-5 h-5 mr-2" />
            New Ticket
          </button>
          <button className="flex-1 bg-primary text-white py-3 rounded-lg flex items-center justify-center font-bold">
            <LifeBuoy className="w-5 h-5 mr-2" />
            Live Chat
          </button>
        </div>
        <h2 className="text-lg font-bold mb-4">Recent Tickets</h2>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded text-center shadow">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded text-center shadow">
            <TicketCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No support tickets yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Open a ticket and the Zylod support team will follow up.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} onClick={() => navigate('seller-ticket-detail', { id: ticket.id })} className="bg-white dark:bg-gray-900 p-4 rounded shadow cursor-pointer">
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{ticket.subject}</span>
                  <span className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">{ticket.status}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{ticket.category} • {ticket.messageCount} message{ticket.messageCount !== 1 ? 's' : ''} • {new Date(ticket.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerSupportPage;