'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

export function InventoryWarehouseLocationsPage() {
  const { goBack } = useNavigationStore();

  const locations = [
    { id: '1', name: 'Dhaka Hub', type: 'Primary Distribution', capacity: '80%' },
    { id: '2', name: 'Chittagong Port Warehouse', type: 'Port Storage', capacity: '45%' },
    { id: '3', name: 'Gazipur Factory Store', type: 'Factory', capacity: '90%' },
  ];

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
          <h1 className="text-lg font-bold text-gray-900">Warehouse Locations</h1>
        </div>
      </div>

      <div className="p-4 md:max-w-4xl md:mx-auto md:p-6 md:pb-8">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Warehouse Locations</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-white p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
            <div className="bg-red-50 p-2 rounded-lg">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{loc.name}</h3>
              <p className="text-sm text-gray-500">{loc.type}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Capacity Used</span>
                  <span className="font-medium text-gray-900">{loc.capacity}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: loc.capacity }}></div>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </motion.div>
  );
}

export default InventoryWarehouseLocationsPage;
