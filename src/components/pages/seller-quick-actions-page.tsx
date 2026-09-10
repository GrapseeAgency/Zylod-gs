'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerQuickActionsPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:max-w-3xl md:mx-auto md:p-8">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-6">Quick Actions</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-6 rounded-lg text-center font-bold">Scan Barcode</div>
        <div className="bg-gray-800 p-6 rounded-lg text-center font-bold">Rapid Restock</div>
      </div>
    </div>
  );
}
export default SellerQuickActionsPage;