'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Save, MapPin } from 'lucide-react';

export function ShippingZoneEditorPage() {
  const { goBack } = useNavigationStore();
  const [zones, setZones] = useState([
    { id: 1, name: 'Dhaka Inside', postcodes: '1000-1299', transitDays: '1-2', baseRate: 60 },
    { id: 2, name: 'Dhaka Suburbs', postcodes: '1300-1499', transitDays: '2-3', baseRate: 100 },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 -ml-1 text-gray-600 dark:text-gray-400">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Shipping Zones Editor</h1>
        </div>
        <button className="flex items-center gap-1 bg-[#C8102E] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Save className="w-4 h-4" /> Save
        </button>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Shipping Zones Editor</h1>

      <div className="p-4 space-y-4">
        {zones.map((zone, index) => (
          <div key={zone.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center gap-2 mb-2 font-semibold text-gray-900 dark:text-gray-100">
              <MapPin className="w-4 h-4 text-[#C8102E]" /> {zone.name}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Covered Postal Codes</label>
              <input type="text" defaultValue={zone.postcodes} className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Transit Days</label>
                <input type="text" defaultValue={zone.transitDays} className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Base Rate (৳)</label>
                <input type="number" defaultValue={zone.baseRate} className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm" />
              </div>
            </div>
          </div>
        ))}
        <button className="w-full py-3 bg-white dark:bg-gray-900 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-medium shadow-sm">
          + Add New Zone
        </button>
      </div>
    </div>
  );
}

export default ShippingZoneEditorPage;
