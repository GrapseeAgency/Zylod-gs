'use client';
import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerCreateTicketPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4 md:max-w-3xl md:mx-auto md:p-8">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">New Ticket</h1>
      <div className="space-y-4">
        <select className="w-full border p-2 rounded">
          <option>Billing</option>
          <option>Logistics</option>
        </select>
        <textarea className="w-full h-32 border p-2 rounded" placeholder="Describe your issue..."></textarea>
        <button className="w-full bg-primary text-white py-3 rounded font-bold">Submit</button>
      </div>
    </div>
  );
}
export default SellerCreateTicketPage;