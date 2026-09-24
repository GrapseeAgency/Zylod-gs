'use client';

import React from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, MessageSquareWarning } from 'lucide-react';

/**
 * HONEST STATE: there is no disputes backend yet (no model, no API).
 * Showing any dispute here would be fabricated data — so this page renders
 * a truthful empty state until the arbitration system is wired to the DB.
 */
export function SellerOrderDisputesPage() {
  const { goBack } = useNavigationStore();

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(var(--bottom-nav-h)+140px)]">
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 -ml-1 text-gray-600" title="Back">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Dispute Details</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Dispute Details</h1>

      <div className="p-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <MessageSquareWarning className="w-7 h-7 text-gray-400" />
          </div>
          <h2 className="font-semibold text-gray-900">No dispute data available</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
            The arbitration system is not connected to the backend yet. Real disputes opened from
            orders will appear here with the buyer&apos;s evidence and full message thread once it is wired.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SellerOrderDisputesPage;
