'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function BulkUploadHistoryPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 md:py-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={goBack} className="mb-4">← Back</button>
        <h1 className="text-xl md:text-2xl font-bold mb-4">Upload History</h1>
        <div className="bg-white p-4 shadow rounded mb-2 md:hidden">
          <p className="font-bold">batch_0812.csv</p>
          <p className="text-sm text-green-600">Success: 120 rows</p>
        </div>
        <div className="hidden md:block bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50/50 text-left">
                <th className="p-3 text-xs font-semibold text-gray-700">File</th>
                <th className="p-3 text-xs font-semibold text-gray-700">Status</th>
                <th className="p-3 text-xs font-semibold text-gray-700">Rows</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t hover:bg-red-50/30">
                <td className="p-3 font-medium">batch_0812.csv</td>
                <td className="p-3 text-green-600">Success</td>
                <td className="p-3">120 rows</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default BulkUploadHistoryPage;
