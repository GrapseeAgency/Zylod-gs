'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RefreshCcw, ShieldCheck } from 'lucide-react';

export function ReturnPolicySettingsPage() {
  const { goBack } = useNavigationStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [policy, setPolicy] = useState({
    window: '7 days',
    shippingPayer: 'Seller pays on defective',
    restockingFee: '0%',
    warranty: 'No Warranty',
    customNonReturnable: true
  });

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const res = await fetch('/api/supplier/return-policies');
        const data = await res.json();
        if (data.policy) {
          setPolicy(data.policy);
        }
      } catch (err) {
        console.error('Failed to fetch return policy', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/supplier/return-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1 -ml-1 text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Return & Warranty</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 bg-[#C8102E] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Save
        </button>
      </header>

      <div className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
            <RefreshCcw className="w-5 h-5 text-[#C8102E]" />
            <h2>Return Policy</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Return Acceptance Window</label>
              <select 
                value={policy.window}
                onChange={(e) => setPolicy({...policy, window: e.target.value})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
              >
                <option value="No Returns">No Returns</option>
                <option value="7 days">7 days</option>
                <option value="15 days">15 days</option>
                <option value="30 days">30 days</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Return Shipping Fee Payer</label>
              <select 
                value={policy.shippingPayer}
                onChange={(e) => setPolicy({...policy, shippingPayer: e.target.value})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
              >
                <option value="Buyer pays">Buyer pays</option>
                <option value="Seller pays on defective">Seller pays on defective</option>
                <option value="Free returns">Free returns</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Restocking Fee</label>
              <select 
                value={policy.restockingFee}
                onChange={(e) => setPolicy({...policy, restockingFee: e.target.value})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
              >
                <option value="0%">0%</option>
                <option value="5%">5%</option>
                <option value="10%">10%</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-gray-700">Custom items are non-returnable</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={policy.customNonReturnable}
                  onChange={(e) => setPolicy({...policy, customNonReturnable: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C8102E]"></div>
              </label>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
            <ShieldCheck className="w-5 h-5 text-[#C8102E]" />
            <h2>Warranty Settings</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Default Warranty Option</label>
              <select 
                value={policy.warranty}
                onChange={(e) => setPolicy({...policy, warranty: e.target.value})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
              >
                <option value="No Warranty">No Warranty</option>
                <option value="Seller Warranty">Seller Warranty</option>
                <option value="Manufacturer Warranty">Manufacturer Warranty</option>
              </select>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default ReturnPolicySettingsPage;
