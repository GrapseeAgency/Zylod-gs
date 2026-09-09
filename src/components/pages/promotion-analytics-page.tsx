'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function PromotionAnalyticsPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4 md:p-8 md:max-w-4xl md:mx-auto">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl md:text-2xl font-bold mb-4">Campaign Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-4 rounded">
          <p className="text-sm text-gray-500">ROI</p>
          <p className="text-xl font-bold text-green-600">+340%</p>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <p className="text-sm text-gray-500">Cost/Acquisition</p>
          <p className="text-xl font-bold">৳45</p>
        </div>
      </div>
    </div>
  );
}
export default PromotionAnalyticsPage;