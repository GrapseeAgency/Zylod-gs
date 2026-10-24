'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Truck, MapPin, AlertCircle } from 'lucide-react';

/* REAL sellerShippingConfigs editor — zones are the model's actual enum and
 * every field below has a real backing column. The previous invented courier
 * toggles (no storage anywhere) are gone. */

const ZONE_LABELS: Record<string, string> = {
  dhaka: 'Dhaka',
  chittagong: 'Chittagong',
  rajshahi: 'Rajshahi',
  sylhet: 'Sylhet',
  khulna: 'Khulna',
  barishal: 'Barishal',
  rangpur: 'Rangpur',
  mymensingh: 'Mymensingh',
  all: 'All Bangladesh',
};

interface ZoneConfig {
  zone: string;
  baseRate: number;
  ratePerKg: number;
  freeAboveAmount: number | null;
  estimatedDays: string | null;
  isActive: boolean;
}

export function SellerShippingSettingsPage() {
  const { goBack } = useNavigationStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [configs, setConfigs] = useState<ZoneConfig[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/supplier/shipping');
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setConfigs(json.data.configs || []);
        } else {
          setError(json.error || 'Could not load shipping settings');
        }
      } catch (err) {
        console.error('Failed to fetch shipping settings', err);
        setError('Could not reach the shipping service');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const updateConfig = (zone: string, patch: Partial<ZoneConfig>) => {
    setSaved(false);
    setConfigs((prev) =>
      prev.map((c) => (c.zone === zone ? { ...c, ...patch } : c))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await fetch('/api/supplier/shipping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configs: configs.map((c) => ({
            zone: c.zone,
            baseRate: Number(c.baseRate) || 0,
            ratePerKg: Number(c.ratePerKg) || 0,
            freeAboveAmount: c.freeAboveAmount != null && c.freeAboveAmount !== null ? Number(c.freeAboveAmount) : null,
            estimatedDays: c.estimatedDays || null,
            isActive: c.isActive,
          })),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setConfigs(json.data.configs || configs);
        setSaved(true);
      } else {
        setSaveError(json.error || `Could not save shipping settings (${res.status})`);
      }
    } catch (err) {
      console.error(err);
      setSaveError('Could not reach the shipping service');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1 -ml-1 text-gray-600 dark:text-gray-400 dark:text-gray-500">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Shipping Settings</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || configs.length === 0}
          className="flex items-center gap-1 bg-[#C8102E] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      {error ? (
        <div className="p-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{error}</p>
          </div>
        </div>
      ) : configs.length === 0 ? (
        <div className="p-4">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
            <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No shipping rates configured yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Save a rate for at least one zone to enable shipping.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {saveError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5" /> {saveError}
            </p>
          )}
          {saved && !saveError && (
            <p className="text-xs text-green-700">Shipping rates saved.</p>
          )}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-gray-100 font-semibold">
              <MapPin className="w-5 h-5 text-[#C8102E]" />
              <h2>Divisional Shipping Rates</h2>
            </div>
            <div className="space-y-4">
              {configs.map((config, index) => (
                <div key={config.zone} className="border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{ZONE_LABELS[config.zone] || config.zone}</p>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <input
                        type="checkbox"
                        checked={config.isActive}
                        onChange={(e) => updateConfig(config.zone, { isActive: e.target.checked })}
                        className="accent-[#C8102E]"
                      />
                      Active
                    </label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 block">Base Fee (৳)</label>
                      <input 
                        type="number" 
                        min={0}
                        value={config.baseRate}
                        onChange={(e) => updateConfig(config.zone, { baseRate: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 block">Per Kg (৳)</label>
                      <input 
                        type="number" 
                        min={0}
                        value={config.ratePerKg}
                        onChange={(e) => updateConfig(config.zone, { ratePerKg: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 block">Free above (৳)</label>
                      <input 
                        type="number" 
                        min={0}
                        value={config.freeAboveAmount ?? ''}
                        onChange={(e) => updateConfig(config.zone, { freeAboveAmount: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="—"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1 block">Est. delivery</label>
                      <input 
                        type="text"
                        value={config.estimatedDays ?? ''}
                        onChange={(e) => updateConfig(config.zone, { estimatedDays: e.target.value })}
                        placeholder="e.g. 3-5 days"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default SellerShippingSettingsPage;
