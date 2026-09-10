'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerTicketDetailPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white p-4 flex items-center border-b">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="font-bold">Ticket #{id || '001'}</h1>
      </header>
      <main className="flex-1 p-4 space-y-4 md:p-6 md:max-w-3xl md:mx-auto md:w-full">
        <div className="bg-white p-3 rounded shadow-sm inline-block">Hello, how can I help?</div>
      </main>
      <footer className="p-4 bg-white border-t flex">
        <input type="text" className="flex-1 border rounded-l p-2" placeholder="Reply..." />
        <button className="bg-primary text-white px-4 rounded-r">Send</button>
      </footer>
    </div>
  );
}
export default SellerTicketDetailPage;