'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, MessageCircle, FileText, CalendarClock } from 'lucide-react';

export function SellerBulkOrderInquiryPage() {
  const { goBack } = useNavigationStore();
  const [price, setPrice] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const inquiry = {
    id: 'rfq_1001',
    buyer: 'Urban Construction',
    product: 'Safety Helmets - Yellow',
    requestedQty: 500,
    targetPrice: 850,
    currentStock: 1200,
    notes: 'Looking for a better price for a bulk order of 500 units.'
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1 -ml-1 text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">RFQ Negotiation</h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm text-gray-500 mb-1">RFQ #{inquiry.id} • {inquiry.buyer}</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p><span className="font-medium text-gray-900">Product:</span> {inquiry.product}</p>
            <p><span className="font-medium text-gray-900">Requested Qty:</span> {inquiry.requestedQty} units</p>
            <p><span className="font-medium text-gray-900">Buyer Target Price:</span> ৳{inquiry.targetPrice}</p>
            <p><span className="font-medium text-gray-900">Your Stock:</span> {inquiry.currentStock} units</p>
          </div>
          <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-700 italic">"{inquiry.notes}"</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C8102E]" /> Submit Quotation
          </h3>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Your Offered Unit Price (৳)</label>
            <input 
              type="number" 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
              <CalendarClock className="w-4 h-4" /> Validity Expiry
            </label>
            <input 
              type="date" 
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium flex justify-center items-center gap-2">
              <MessageCircle className="w-4 h-4" /> Message
            </button>
            <button className="flex-1 py-3 bg-[#C8102E] text-white rounded-xl font-medium">
              Send Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SellerBulkOrderInquiryPage;
