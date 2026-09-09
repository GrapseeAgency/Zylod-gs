'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function ProductPricingTiersPage() {
  const { goBack } = useNavigationStore();

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Pricing Tiers</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:pt-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Pricing Tiers</h1>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
           <h2 className="font-semibold text-gray-900">Volume Discounts</h2>
           <p className="text-sm text-gray-500">Configure automated pricing tiers based on order volume. Margin calculations will be displayed here.</p>
           {/* Placeholder for complex visual chart and table */}
           <div className="h-40 md:h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
             Discount Curve Chart Area
           </div>
        </div>

        <button className="w-full md:w-auto md:px-10 bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          Apply Rules
        </button>
      </div>
    </motion.div>
  );
}

export default ProductPricingTiersPage;
