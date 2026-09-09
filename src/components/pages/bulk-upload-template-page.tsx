'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function BulkUploadTemplatePage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4 md:p-6 md:py-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={goBack} className="mb-4">← Back</button>
        <h1 className="text-xl md:text-2xl font-bold mb-4">Templates</h1>
        <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          <li className="p-4 border rounded font-semibold text-primary">Garments.xlsx</li>
          <li className="p-4 border rounded font-semibold text-primary">Electronics.xlsx</li>
        </ul>
      </div>
    </div>
  );
}
export default BulkUploadTemplatePage;
