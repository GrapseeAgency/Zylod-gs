'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function CustomerQueryDetailPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white p-4 flex items-center border-b md:hidden">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="font-bold">Query thread</h1>
      </header>
      <main className="flex-1 p-4 md:px-6 md:py-8 space-y-4 md:space-y-5 md:max-w-3xl md:w-full md:mx-auto">
        <div className="bg-white p-3 rounded shadow-sm inline-block md:p-4 md:text-sm">Can you do 500 units by next week?</div>
      </main>
      <footer className="p-4 bg-white border-t flex md:px-6 md:py-4">
        <div className="flex w-full md:max-w-3xl md:mx-auto">
          <input type="text" className="flex-1 border rounded-l p-2" placeholder="Reply..." />
          <button className="bg-primary text-white px-4 rounded-r">Send</button>
        </div>
      </footer>
    </div>
  );
}
export default CustomerQueryDetailPage;