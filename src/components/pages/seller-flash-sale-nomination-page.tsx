'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerFlashSaleNominationPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:max-w-3xl md:mx-auto md:p-8">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Flash Sale Nomination</h1>
      <p className="mb-4">Select products to nominate for Zylod Flash Sales.</p>
      <button className="w-full bg-primary text-white py-3 rounded font-bold">Submit Items</button>
    </div>
  );
}
export default SellerFlashSaleNominationPage;