'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Truck, MapPin } from 'lucide-react';

export function SellerShippingSettingsPage() {
  const { goBack } = useNavigationStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    zones: [
      { name: 'Dhaka Inside', baseFee: 0, perKgRate: 0, freeShippingThreshold: 0 },
      { name: 'Dhaka Suburbs', baseFee: 0, perKgRate: 0, freeShippingThreshold: 0 },
      { name: 'Chittagong', baseFee: 0, perKgRate: 0, freeShippingThreshold: 0 },
      { name: 'Sylhet', baseFee: 0, perKgRate: 0, freeShippingThreshold: 0 },
      { name: 'All Bangladesh', baseFee: 0, perKgRate: 0, freeShippingThreshold: 0 },
    ],
    handlingTime: '1-2 business days',
    couriers: {
      pathao: false,
      redx: false,
      steadfast: false,
      ecourier: false,
      sundarban: false
    }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/supplier/shipping');
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      } catch (err) {
        console.error('Failed to fetch shipping settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/supplier/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      // show toast
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
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 -ml-1 text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Shipping Settings</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 bg-[#C8102E] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Save
        </button>
      </header>

      <div className="p-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
            <MapPin className="w-5 h-5 text-[#C8102E]" />
            <h2>Divisional Shipping Rates</h2>
          </div>
          <div className="space-y-4">
            {settings.zones.map((zone, index) => (
              <div key={zone.name} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <p className="font-medium text-sm text-gray-800 mb-2">{zone.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Base Fee (৳)</label>
                    <input 
                      type="number" 
                      value={zone.baseFee}
                      onChange={(e) => {
                        const newZones = [...settings.zones];
                        newZones[index].baseFee = Number(e.target.value);
                        setSettings({...settings, zones: newZones});
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Per Kg (৳)</label>
                    <input 
                      type="number" 
                      value={zone.perKgRate}
                      onChange={(e) => {
                        const newZones = [...settings.zones];
                        newZones[index].perKgRate = Number(e.target.value);
                        setSettings({...settings, zones: newZones});
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Free at (৳)</label>
                    <input 
                      type="number" 
                      value={zone.freeShippingThreshold}
                      onChange={(e) => {
                        const newZones = [...settings.zones];
                        newZones[index].freeShippingThreshold = Number(e.target.value);
                        setSettings({...settings, zones: newZones});
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-4">Fulfillment Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Standard Handling Time</label>
              <select 
                value={settings.handlingTime}
                onChange={(e) => setSettings({...settings, handlingTime: e.target.value})}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
              >
                <option value="Same Day">Same Day</option>
                <option value="1-2 business days">1-2 business days</option>
                <option value="3-5 business days">3-5 business days</option>
                <option value="7+ business days">7+ business days</option>
              </select>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
            <Truck className="w-5 h-5 text-[#C8102E]" />
            <h2>Integrated Couriers</h2>
          </div>
          <div className="space-y-3">
            {Object.keys(settings.couriers).map((courier) => (
              <div key={courier} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-700 capitalize">{courier}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.couriers[courier as keyof typeof settings.couriers]}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        couriers: { ...settings.couriers, [courier]: e.target.checked }
                      });
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C8102E]"></div>
                </label>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default SellerShippingSettingsPage;
