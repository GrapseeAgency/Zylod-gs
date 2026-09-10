'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { Layout, Palette, Settings } from 'lucide-react';

export function StoreCustomizationPage() {
  const { navigate, goBack } = useNavigationStore();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/customization')
      .then(res => res.json())
      .then(d => {
        setSettings(d);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="md:hidden bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Store Customization</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Store Customization</h1>
      <main className="flex-1 p-4">
        {loading ? (
          <div className="h-40 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-bold mb-4 flex items-center"><Layout className="mr-2 w-5 h-5 text-gray-500"/> Header Layout</h2>
              <select className="w-full border p-2 rounded">
                <option>Hero Banner</option>
                <option>Split Showcase</option>
                <option>Minimalist Grid</option>
              </select>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-bold mb-4 flex items-center"><Settings className="mr-2 w-5 h-5 text-gray-500"/> Widgets</h2>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span>Show Verified Badges</span>
                  <input type="checkbox" defaultChecked={settings?.showBadges} className="w-5 h-5 accent-primary" />
                </label>
                <label className="flex items-center justify-between">
                  <span>Show Factory Video</span>
                  <input type="checkbox" defaultChecked={settings?.showVideo} className="w-5 h-5 accent-primary" />
                </label>
              </div>
            </div>

            <button onClick={() => navigate('store-theme-customizer')} className="w-full bg-white border border-gray-200 p-4 rounded shadow flex items-center justify-between">
              <div className="flex items-center font-bold">
                <Palette className="mr-2 w-5 h-5 text-gray-500" />
                Advanced Theme Settings
              </div>
              <span>→</span>
            </button>

            <button className="w-full bg-primary text-white py-3 rounded-lg font-bold">
              Save Changes
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default StoreCustomizationPage;