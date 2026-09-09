'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Download, Calendar, TrendingUp } from 'lucide-react'

export function AnnualReportPage() {
  const { navigate, goBack } = useNavigationStore()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/investor?docType=annual_report')
      .then(res => res.json())
      .then(res => {
        if (res.success) setDocs(res.data.documents)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Annual Reports & Audits</h1>
          <p className="text-xs text-gray-400">Audited Financial Statements & Operational Highlights</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto lg:max-w-5xl w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-28 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map(doc => (
                <div key={doc.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                        Fiscal Year {doc.fiscalYear}
                      </Badge>
                      <h3 className="text-sm font-bold text-gray-900 leading-snug">{doc.title}</h3>
                    </div>
                    <a
                      href={doc.fileUrl}
                      download
                      className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed flex-1">{doc.summary}</p>
                  <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400">
                    <span>Published {new Date(doc.publishedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                    <span className="font-semibold text-emerald-700">PDF Report</span>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={() => navigate('investor-relations')} className="w-full md:w-auto md:px-8 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold py-3">
              Back to Investor Portal
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default AnnualReportPage
