'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function BulkPriceUpdatePage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4 md:p-6 md:py-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={goBack} className="mb-4">← Back</button>
        <h1 className="text-xl md:text-2xl font-bold mb-4">Quick Price Update</h1>
        <div className="overflow-x-auto md:border md:rounded-lg">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-red-50/50 text-left"><th className="border-b p-2 text-xs font-semibold text-gray-700">SKU</th><th className="border-b p-2 text-xs font-semibold text-gray-700">Price</th><th className="border-b p-2 text-xs font-semibold text-gray-700">MOQ</th></tr></thead>
            <tbody>
              <tr className="hover:bg-red-50/30"><td className="p-2">SHIRT-01</td><td className="p-2"><input type="number" className="w-20 border rounded p-1" defaultValue={450}/></td><td className="p-2"><input type="number" className="w-16 border rounded p-1" defaultValue={50}/></td></tr>
            </tbody>
          </table>
        </div>
        <button className="w-full md:w-auto md:px-10 bg-primary text-white py-3 mt-4 rounded font-bold">Save All</button>
      </div>
    </div>
  );
}
export default BulkPriceUpdatePage;
