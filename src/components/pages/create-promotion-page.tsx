'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function CreatePromotionPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:px-6 md:py-8">
      <button onClick={goBack} className="mb-4 md:hidden">← Back</button>
      <h1 className="text-2xl font-bold mb-6">Create Campaign</h1>
      <div className="bg-white p-4 shadow rounded space-y-4 md:p-6 md:max-w-2xl">
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          <input type="text" placeholder="Campaign Name" className="w-full border p-2 rounded" />
          <select className="w-full border p-2 rounded">
            <option>Percentage Discount</option>
            <option>Fixed BDT Off</option>
          </select>
        </div>
        <button className="w-full bg-primary text-white py-3 rounded font-bold">Create</button>
      </div>
    </div>
  );
}
export default CreatePromotionPage;