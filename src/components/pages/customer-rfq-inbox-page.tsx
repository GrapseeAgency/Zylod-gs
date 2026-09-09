'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function CustomerRfqInboxPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:px-6 md:py-8">
      <button onClick={goBack} className="mb-4 md:hidden">← Back</button>
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">RFQ Inbox</h1>
      <div className="bg-white p-4 rounded shadow mb-2 md:max-w-2xl md:p-6">
        <h3 className="font-bold">Need 5000x Cotton T-Shirts</h3>
        <p className="text-sm text-gray-500">Budget: ৳500,000</p>
        <button className="mt-2 bg-primary text-white px-4 py-1 rounded text-sm">Bid Now</button>
      </div>
    </div>
  );
}
export default CustomerRfqInboxPage;