'use client';
import React, { useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* Creates a REAL sellerSupportTickets row via POST /api/supplier/support.
 * Server validation errors are surfaced verbatim — no fake success. */

const CATEGORIES = [
  { value: 'account', label: 'Account' },
  { value: 'orders', label: 'Orders' },
  { value: 'payments', label: 'Payments' },
  { value: 'products', label: 'Products' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export function SellerCreateTicketPage() {
  const { goBack, navigate } = useNavigationStore();
  const [category, setCategory] = useState<string>('orders');
  const [priority, setPriority] = useState<string>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (subject.trim().length < 3) {
      setError('Subject must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/supplier/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          priority,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setDone(true);
      } else {
        setError(json.error || `Could not create the ticket (${res.status}).`);
      }
    } catch {
      setError('Could not reach the support service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Ticket created</h2>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-8">Your ticket is open. The Zylod support team will reply in your ticket thread.</p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button className="w-full" onClick={() => navigate('seller-support')}>View My Tickets</Button>
          <Button variant="outline" className="w-full" onClick={goBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-4 md:max-w-3xl md:mx-auto md:p-8">
      <button onClick={goBack} className="mb-4 flex items-center gap-1 text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-bold mb-4">New Ticket</h1>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border p-2 rounded h-11">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border p-2 rounded h-11">
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Summarise the issue"
            className="w-full border p-2 rounded h-11"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue…"
            className="w-full h-32 border p-2 rounded"
          />
        </div>
        {error && (
          <p className="flex items-start gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-primary text-white py-3 rounded font-bold disabled:opacity-60 min-h-11"
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
export default SellerCreateTicketPage;
