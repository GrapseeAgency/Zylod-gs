'use client';

import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Save, Building, Clock } from 'lucide-react';

export function SelfPickupSettingsPage() {
  const { goBack } = useNavigationStore();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1 -ml-1 text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Self Pickup Depot</h1>
        </div>
        <button className="flex items-center gap-1 bg-[#C8102E] text-white px-3 py-1.5 rounded-lg text-sm font-medium">
          <Save className="w-4 h-4" /> Save
        </button>
      </header>

      <div className="p-4 space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-[#C8102E]" /> Depot Location
          </h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Warehouse Address</label>
            <textarea className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm min-h-[80px]" placeholder="Full address for buyers to navigate to..."></textarea>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Contact Person</label>
            <input type="text" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" placeholder="Manager Name" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Phone Number</label>
            <input type="tel" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" placeholder="+8801..." />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#C8102E]" /> Operating Hours
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Opening Time</label>
              <input type="time" defaultValue="09:00" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Closing Time</label>
              <input type="time" defaultValue="18:00" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Operating Days</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <button key={day} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${day === 'Fri' ? 'border-gray-200 bg-white text-gray-600' : 'border-[#C8102E] bg-red-50 text-[#C8102E]'}`}>
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2">
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-[#C8102E]" />
              <span className="text-sm text-gray-700">Require automated gate pass generation</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SelfPickupSettingsPage;
