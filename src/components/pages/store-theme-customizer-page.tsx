'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function StoreThemeCustomizerPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4 md:max-w-3xl md:mx-auto md:p-8">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Theme Options</h1>
      <div className="space-y-4">
        <div>
          <label className="font-bold block mb-1">Brand Color</label>
          <input type="color" defaultValue="#C8102E" className="w-full h-10 p-0 border-0" />
        </div>
        <button className="w-full bg-primary text-white py-3 rounded font-bold">Apply Theme</button>
      </div>
    </div>
  );
}
export default StoreThemeCustomizerPage;