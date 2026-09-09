'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Box, Truck, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function SellerOrderFulfillmentPage() {
  const { pageParams, goBack } = useNavigationStore();
  const [step, setStep] = useState(1);
  const [courier, setCourier] = useState('');
  const [trackingId, setTrackingId] = useState('');

  const handleDispatch = async () => {
    try {
      await fetch(`/api/supplier/orders/${pageParams?.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Shipped', trackingId, courier })
      });
      setStep(3);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center">
        <button onClick={goBack} className="p-1 -ml-1 text-gray-600 mr-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg md:hidden font-bold text-gray-900">Fulfill Order</h1>
      </header>

      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Fulfill Order</h1>

      <div className="p-4 space-y-6">
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="font-semibold text-gray-900">Select Courier Partner</h2>
            <div className="space-y-3">
              {['Pathao Courier', 'RedX', 'Steadfast', 'eCourier'].map((c) => (
                <label key={c} className={`flex items-center gap-3 p-4 rounded-xl border ${courier === c ? 'border-[#C8102E] bg-red-50' : 'border-gray-200 bg-white'}`}>
                  <input type="radio" name="courier" value={c} checked={courier === c} onChange={() => setCourier(c)} className="w-4 h-4 text-[#C8102E]" />
                  <span className="font-medium text-gray-800">{c}</span>
                </label>
              ))}
            </div>
            <button 
              disabled={!courier} 
              onClick={() => setStep(2)}
              className="w-full py-3 bg-[#C8102E] text-white rounded-xl font-medium disabled:opacity-50 mt-6"
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="font-semibold text-gray-900">Tracking Information</h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Selected Courier</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">{courier}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Air Waybill (AWB) / Tracking ID</label>
                <input 
                  type="text" 
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  placeholder="Enter tracking number"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium">Back</button>
              <button 
                disabled={!trackingId} 
                onClick={handleDispatch}
                className="flex-1 py-3 bg-[#C8102E] text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Truck className="w-5 h-5" /> Dispatch Order
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Order Dispatched</h2>
            <p className="text-gray-500 text-sm">Order has been marked as shipped and the buyer has been notified.</p>
            <div className="pt-6 space-y-3">
              <button className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2">
                <Box className="w-5 h-5" /> Print Shipping Label
              </button>
              <button onClick={goBack} className="w-full py-3 bg-[#C8102E] text-white rounded-xl font-medium">
                Back to Order
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default SellerOrderFulfillmentPage;
