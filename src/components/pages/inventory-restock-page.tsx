'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function InventoryRestockPage() {
  const { goBack } = useNavigationStore();

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Restock Intake Form</h1>
        </div>
      </div>

      <div className="p-4 md:max-w-3xl md:mx-auto md:p-6 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Restock Intake Form</h1>
        <div className="space-y-6">
        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
           <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
             <div className="space-y-1">
               <label className="text-sm font-medium text-gray-700">PO Number</label>
               <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="PO-10024" />
             </div>
             
             <div className="space-y-1">
               <label className="text-sm font-medium text-gray-700">Supplier Source</label>
               <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Supplier Name" />
             </div>
             
             <div className="grid grid-cols-2 gap-4 md:col-span-2">
               <div className="space-y-1">
                 <label className="text-sm font-medium text-gray-700">Quantity Received</label>
                 <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
               </div>
               <div className="space-y-1">
                 <label className="text-sm font-medium text-gray-700">Batch Expiry</label>
                 <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
               </div>
             </div>
           </div>
        </div>

        <button className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          Process Intake
        </button>
        </div>
      </div>
    </motion.div>
  );
}

export default InventoryRestockPage;
