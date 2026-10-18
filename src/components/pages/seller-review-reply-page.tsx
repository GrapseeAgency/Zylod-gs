'use client';
import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { AlertCircle } from 'lucide-react';

export function SellerReviewReplyPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reply.trim()) {
      setError('Write a reply before posting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // NOTE: there is currently no real supplier-reply write path on the
      // platform (review replies would need a dedicated model field set).
      // The attempt is made against the reviews endpoint and the REAL result
      // is surfaced — success is never faked.
      const res = await fetch('/api/supplier/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: id, reply }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        goBack();
        return;
      }
      setError(
        res.status === 405 || res.status === 404
          ? 'Review replies are not supported yet on this marketplace — your reply was not posted.'
          : json.error || `Could not post the reply (${res.status}).`
      );
    } catch {
      setError('Could not reach the reviews service. Your reply was not posted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <header className="md:hidden flex items-center mb-6">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="text-xl font-bold">Reply to Review</h1>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Reply to Review</h1>
      <textarea className="w-full h-40 border rounded p-3 mb-2" placeholder="Write a polite response to the customer..." value={reply} onChange={(e) => setReply(e.target.value)}></textarea>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 mb-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
      <button onClick={handleSubmit} disabled={submitting} className="w-full bg-primary text-white py-3 rounded font-bold disabled:opacity-60">
        {submitting ? 'Posting…' : 'Post Reply'}
      </button>
    </div>
  );
}
export default SellerReviewReplyPage;
