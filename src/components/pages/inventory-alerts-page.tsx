'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Bell } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function InventoryAlertsPage() {
  const { goBack } = useNavigationStore();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="overflow-x-hidden min-h-screen bg-gray-50 pb-20 md:pb-8"
    >
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Stock Alerts</h1>
        </div>
      </div>

      <div className="p-4 md:max-w-3xl md:mx-auto md:p-6 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Stock Alerts</h1>
        <div className="space-y-6">
        <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
           <div className="flex items-center gap-2 text-orange-600 mb-2">
             <Bell className="w-5 h-5" />
             <h2 className="font-semibold md:text-lg">Notification Rules</h2>
           </div>
           
           <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
             <div className="flex items-center justify-between">
               <div>
                 <p className="font-medium text-gray-900 text-sm">Low Stock Threshold</p>
                 <p className="text-xs text-gray-500">Notify when stock drops below</p>
               </div>
               <input type="number" defaultValue={20} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center" />
             </div>
             
             <div className="flex items-center justify-between">
               <div>
                 <p className="font-medium text-gray-900 text-sm">Auto-pause Listing</p>
                 <p className="text-xs text-gray-500">When stock reaches zero</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" className="sr-only peer" defaultChecked />
                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
               </label>
             </div>
           </div>
        </div>

        <button className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          Save Rules
        </button>
        </div>
      </div>
    </motion.div>
  );
}

export default InventoryAlertsPage;
