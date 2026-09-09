'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { LifeBuoy, PlusCircle } from 'lucide-react';

export function SellerSupportPage() {
  const { navigate, goBack } = useNavigationStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/support')
      .then(res => res.json())
      .then(d => {
        setTickets(d?.tickets || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="md:hidden bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Seller Support</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Seller Support</h1>
      <main className="flex-1 p-4">
        <div className="mb-6 flex space-x-4">
          <button onClick={() => navigate('seller-create-ticket')} className="flex-1 bg-white border border-primary text-primary py-3 rounded-lg flex items-center justify-center font-bold">
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
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} onClick={() => navigate('seller-ticket-detail', { id: ticket.id })} className="bg-white p-4 rounded shadow cursor-pointer">
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{ticket.subject}</span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">{ticket.status}</span>
                </div>
                <p className="text-sm text-gray-500">Ticket #{ticket.id} • {new Date(ticket.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerSupportPage;