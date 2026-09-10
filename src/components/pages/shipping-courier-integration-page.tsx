'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Save, Link2 } from 'lucide-react';

export function ShippingCourierIntegrationPage() {
  const { goBack } = useNavigationStore();
  const [courier, setCourier] = useState('pathao');

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 -ml-1 text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">API Integration</h1>
        </div>
        <button className="flex items-center gap-1 bg-[#C8102E] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Save className="w-4 h-4" /> Connect
        </button>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">API Integration</h1>

      <div className="p-4 space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#C8102E]" /> Courier Partner API
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Select Partner</label>
              <select 
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
              >
                <option value="pathao">Pathao Courier</option>
                <option value="redx">RedX</option>
                <option value="paperfly">Paperfly</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Merchant API Key</label>
              <input type="password" placeholder="Enter API Key" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">API Secret</label>
              <input type="password" placeholder="Enter API Secret" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Store ID</label>
              <input type="text" placeholder="Enter Store ID" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
            </div>
            
            <div className="pt-2 border-t border-gray-100">
              <label className="text-sm font-medium text-gray-700 block mb-1">Zylod Webhook URL (Read Only)</label>
              <div className="flex gap-2">
                <input type="text" readOnly value="https://api.zylod.com/webhooks/courier" className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShippingCourierIntegrationPage;
