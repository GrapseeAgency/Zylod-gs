'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, MessageSquareWarning, Image as ImageIcon, Send } from 'lucide-react';
import { motion } from 'framer-motion';

export function SellerOrderDisputesPage() {
  const { goBack } = useNavigationStore();
  const [response, setResponse] = useState('');

  // Dummy dispute data
  const dispute = {
    id: 'dsp_991',
    orderId: 'ZYL-9923-11',
    buyer: 'BuildMart',
    type: 'Defective Items',
    status: 'Action Required',
    description: '3 of the safety helmets received were cracked. See attached photos.',
    photos: ['https://via.placeholder.com/80', 'https://via.placeholder.com/80'],
    timeline: [
      { sender: 'Buyer', message: 'I received the items but 3 are defective.', time: '2023-10-15 10:00 AM' }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(var(--bottom-nav-h)+140px)]">
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 -ml-1 text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Dispute Details</h1>
        </div>
        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">{dispute.status}</span>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Dispute Details</h1>

      <div className="p-4 space-y-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm text-gray-500 mb-1">Order #{dispute.orderId} • {dispute.buyer}</h2>
          <p className="font-semibold text-gray-900 text-lg mb-2">{dispute.type}</p>
          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">{dispute.description}</p>
          
          <div className="mt-3 flex gap-2">
            {dispute.photos.map((url, i) => (
              <img key={i} src={url} alt="Evidence" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquareWarning className="w-4 h-4 text-[#C8102E]" /> Arbitration Thread
          </h3>
          <div className="space-y-4">
            {dispute.timeline.map((msg, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm text-gray-900">{msg.sender}</span>
                  <span className="text-xs text-gray-500">{msg.time}</span>
                </div>
                <p className="text-sm text-gray-700">{msg.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe space-y-3">
        <div className="flex gap-2">
          <button className="p-2 border border-gray-300 rounded-lg text-gray-600">
            <ImageIcon className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            placeholder="Type your response..."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
          />
          <button className="p-2 bg-[#C8102E] text-white rounded-lg">
            <Send className="w-5 h-5" />
          </button>
        </div>
        <button className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">
          Escalate to Zylod Admin
        </button>
      </div>
    </div>
  );
}

export default SellerOrderDisputesPage;
