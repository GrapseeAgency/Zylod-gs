'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Box, Check, X, Camera } from 'lucide-react';
import { motion } from 'framer-motion';

export function ReturnClaimDetailPage() {
  const { goBack } = useNavigationStore();
  const [condition, setCondition] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-10">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center md:px-6">
        <button onClick={goBack} className="md:hidden p-1 -ml-1 text-gray-600 mr-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Return Inspection</h1>
          <p className="text-xs text-gray-500">Claim #RTN-5512</p>
        </div>
      </header>

      <div className="p-4 space-y-4 md:p-6 md:max-w-3xl md:mx-auto">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Box className="w-4 h-4 text-[#C8102E]" /> Returned Package Info
          </h2>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">Order:</span> ZYL-9923-11</p>
            <p><span className="text-gray-500">Tracking:</span> Pth-8812399</p>
            <p><span className="text-gray-500">Reason:</span> Item damaged in transit</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h2 className="font-semibold text-gray-900">Verify Condition</h2>
          
          <div className="space-y-3">
            {['Intact / Resellable', 'Damaged by Buyer', 'Damaged in Transit', 'Wrong Item Returned'].map((c) => (
              <label key={c} className={`flex items-center gap-3 p-3 rounded-lg border ${condition === c ? 'border-[#C8102E] bg-red-50' : 'border-gray-200 bg-white'}`}>
                <input type="radio" name="condition" value={c} checked={condition === c} onChange={() => setCondition(c)} className="w-4 h-4 text-[#C8102E]" />
                <span className="font-medium text-sm text-gray-800">{c}</span>
              </label>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100">
            <button className="w-full py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium flex justify-center items-center gap-2">
              <Camera className="w-4 h-4" /> Upload Inspection Photos
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe flex gap-3">
        <button className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium flex justify-center items-center gap-2">
          <X className="w-5 h-5" /> Reject Claim
        </button>
        <button className="flex-1 py-3 bg-[#C8102E] text-white rounded-xl font-medium flex justify-center items-center gap-2">
          <Check className="w-5 h-5" /> Approve Refund
        </button>
      </div>
    </div>
  );
}

export default ReturnClaimDetailPage;
