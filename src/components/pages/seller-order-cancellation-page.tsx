'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export function SellerOrderCancellationPage() {
  const { pageParams, goBack } = useNavigationStore();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await fetch(`/api/supplier/orders/${pageParams?.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Cancelled', cancellationReason: reason, cancellationNotes: notes })
      });
      goBack();
    } catch (err) {
      console.error(err);
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center">
        <button onClick={goBack} className="p-1 -ml-1 text-gray-600 mr-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg md:hidden font-bold text-gray-900">Cancel Order</h1>
      </header>

      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Cancel Order</h1>

      <div className="p-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            Cancelling an order may negatively impact your seller metrics. Only cancel if absolutely necessary.
          </p>
        </motion.div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h2 className="font-semibold text-gray-900">Cancellation Reason</h2>
          <div className="space-y-3">
            {['Out of stock', 'Price dispute', 'Buyer requested cancellation', 'Cannot fulfill MOQs', 'Other'].map((r) => (
              <label key={r} className="flex items-center gap-3">
                <input 
                  type="radio" 
                  name="reason" 
                  value={r} 
                  checked={reason === r} 
                  onChange={() => setReason(r)} 
                  className="w-4 h-4 text-[#C8102E]" 
                />
                <span className="text-sm text-gray-800">{r}</span>
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <label className="text-sm font-medium text-gray-700 block mb-2">Additional Notes (Optional)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E] min-h-[100px]"
              placeholder="Explain why you are cancelling..."
            />
          </div>
        </div>

        <button 
          onClick={handleCancel}
          disabled={!reason || cancelling}
          className="w-full py-3 bg-[#C8102E] text-white rounded-xl font-medium disabled:opacity-50"
        >
          {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
        </button>
      </div>
    </div>
  );
}

export default SellerOrderCancellationPage;
