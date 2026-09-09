'use client';
import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';

export function SellerReviewReplyPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  const [reply, setReply] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/supplier/reviews', { method: 'POST', body: JSON.stringify({ reviewId: id, reply }) });
    goBack();
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <header className="md:hidden flex items-center mb-6">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="text-xl font-bold">Reply to Review</h1>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Reply to Review</h1>
      <textarea className="w-full h-40 border rounded p-3 mb-4" placeholder="Write a polite response to the customer..." value={reply} onChange={(e) => setReply(e.target.value)}></textarea>
      <button onClick={handleSubmit} className="w-full bg-primary text-white py-3 rounded font-bold">Post Reply</button>
    </div>
  );
}
export default SellerReviewReplyPage;