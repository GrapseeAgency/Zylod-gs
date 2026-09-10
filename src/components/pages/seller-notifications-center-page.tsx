'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerNotificationsCenterPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4 md:max-w-3xl md:mx-auto md:p-8">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Notifications</h1>
      <div className="space-y-2">
        <div className="p-3 bg-blue-50 text-blue-900 rounded">
          <p className="font-bold">New Order #1029</p>
          <p className="text-sm">You have 2 days to fulfill this wholesale order.</p>
        </div>
      </div>
    </div>
  );
}
export default SellerNotificationsCenterPage;