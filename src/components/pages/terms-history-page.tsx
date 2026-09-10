'use client'

import React from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Clock, History, FileText } from 'lucide-react'

export function TermsHistoryPage() {
  const { navigate, goBack } = useNavigationStore()

  const history = [
    {
      version: '2.4',
      date: 'May 2026',
      changes: 'Integrated Live Factory Shopping broadcasting rules, dynamic RFQ milestone escrow clauses, and sub-accounts for wholesale buying houses.',
      status: 'Current Active',
    },
    {
      version: '2.0',
      date: 'January 2025',
      changes: 'Implemented Bangladesh Bank compliant SafePay Escrow multi-signature protocols and updated 7-day inspection window procedures.',
      status: 'Superceded',
    },
    {
      version: '1.2',
      date: 'March 2024',
      changes: 'Added mandatory e-TIN and municipal Trade License verification requirements for all registering wholesale buyer accounts.',
      status: 'Archived',
    },
    {
      version: '1.0',
      date: 'March 2020',
      changes: 'Initial platform terms of service launch.',
      status: 'Archived',
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Terms Version History</h1>
          <p className="text-xs text-gray-400">Historical Amendments & Audit Logs</p>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Terms Version History</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.version} className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-gray-900">Version {h.version}</span>
                </div>
                <Badge
                  className={`text-[10px] font-bold ${
                    h.status === 'Current Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  {h.status}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 font-semibold">{h.date}</p>
              <p className="text-xs text-gray-600 leading-relaxed">{h.changes}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('terms-of-service')} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-3">
          Back to Active Terms
        </Button>
      </div>
    </div>
  )
}

export default TermsHistoryPage
