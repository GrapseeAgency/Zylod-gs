'use client'

import React, { useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trash2, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'

export function DataDeletionPage() {
  const { navigate, goBack } = useNavigationStore()
  const [confirmed, setConfirmed] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleDelete = async () => {
    if (!confirmed) return
    setSubmitting(true)
    try {
      await fetch('/api/legal/data-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'deletion', reason: `Account Deletion: ${reason}` }),
      })
      setDone(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Permanent Account & Data Deletion</h1>
          <p className="text-xs text-gray-400">Request Erasure of Personal Information</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        {done ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-base font-bold text-gray-900">Deletion Request Initiated</h2>
            <p className="text-xs text-gray-600">
              Your deletion request has been submitted. In accordance with statutory financial audit obligations (NBR), non-financial records will be purged within 30 days.
            </p>
            <Button onClick={() => navigate('home')} className="bg-slate-900 text-white rounded-xl text-xs font-bold">
              Return to Homepage
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
            <div className="bg-red-50 border border-red-200 rounded-3xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-bold">Important Notice Regarding Account Deletion</h3>
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                Deleting your account will forfeit all active VIP membership points, reward vouchers, affiliate commissions, and saved supplier quotation history. This action cannot be reversed.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4 lg:col-span-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">Reason for leaving (Optional)</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Help us understand why you are closing your wholesale account..."
                  className="w-full p-3 bg-slate-50 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  id="confirm-delete"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="confirm-delete" className="text-xs text-gray-600 leading-relaxed cursor-pointer">
                  I understand that this action will permanently deactivate my account and erase all associated non-financial records.
                </label>
              </div>

              <Button
                onClick={handleDelete}
                disabled={!confirmed || submitting}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold py-3"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {submitting ? 'Submitting...' : 'Confirm & Request Account Deletion'}
              </Button>
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DataDeletionPage
