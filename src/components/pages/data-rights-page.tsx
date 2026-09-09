'use client'

import React, { useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Trash2, Edit3, ShieldAlert, CheckCircle2, Send } from 'lucide-react'

export function DataRightsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [selectedType, setSelectedType] = useState('access')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resultRef, setResultRef] = useState('')

  const rights = [
    { type: 'access', title: 'Right to Access', desc: 'Request a machine-readable export of all your commercial order data.', icon: Download },
    { type: 'rectification', title: 'Right to Rectification', desc: 'Request correction of inaccurate corporate or bank account records.', icon: Edit3 },
    { type: 'deletion', title: 'Right to Erasure (Deletion)', desc: 'Request deletion and anonymization of your merchant account.', icon: Trash2 },
    { type: 'restriction', title: 'Right to Restriction', desc: 'Restrict processing of non-essential commercial transaction logs.', icon: ShieldAlert },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/legal/data-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: selectedType, reason }),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        setResultRef(data.data.requestId)
      }
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
          <h1 className="font-bold text-gray-900 text-base">Your Data Rights (GDPR/PDPA)</h1>
          <p className="text-xs text-gray-400">Request Data Export, Correction, or Deletion</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        {submitted ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-gray-900">Request Submitted Successfully</h2>
            <p className="text-xs text-gray-600">
              Your request reference is <strong>#{resultRef.slice(-8).toUpperCase()}</strong>. In accordance with statutory guidelines, our Data Governance Desk will process your request within 30 days.
            </p>
            <Button onClick={() => setSubmitted(false)} variant="outline" className="rounded-xl text-xs font-bold">
              Submit Another Request
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {rights.map(r => (
                <div
                  key={r.type}
                  onClick={() => setSelectedType(r.type)}
                  className={`p-4 rounded-3xl border transition cursor-pointer flex items-start gap-3.5 ${
                    selectedType === r.type
                      ? 'bg-emerald-50/50 border-emerald-500 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`p-2 rounded-2xl ${selectedType === r.type ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <r.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">{r.title}</h3>
                    <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-2">
              <label className="text-xs font-bold text-gray-700">Specific Details or Instructions (Optional)</label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain any specific records you would like us to review..."
                className="w-full p-3 bg-slate-50 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold py-3"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Official Request'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

export default DataRightsPage
