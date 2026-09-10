'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, PieChart, Download, Presentation, Calendar } from 'lucide-react'

export function InvestorPresentationPage() {
  const { navigate, goBack } = useNavigationStore()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/investor?docType=investor_presentation')
      .then(res => res.json())
      .then(res => {
        if (res.success) setDocs(res.data.documents)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Investor Presentations</h1>
          <p className="text-xs text-gray-400">Strategy Decks, TAM Modeling & Unit Economics</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8 lg:max-w-5xl">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Investor Presentations</h1>
        <div className="space-y-4 md:space-y-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-28 bg-gray-200 rounded-3xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {docs.map(doc => (
            <div key={doc.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                    Deck · {doc.fiscalYear || '2026'}
                  </Badge>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">{doc.title}</h3>
                </div>
                <a
                  href={doc.fileUrl}
                  download
                  className="p-2.5 bg-amber-50 text-amber-700 rounded-2xl hover:bg-amber-100 transition"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{doc.summary}</p>
              <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400">
                <span>Investor Relations Team</span>
                <span className="font-semibold text-amber-700">Presentation Deck</span>
              </div>
            </div>
          ))}
          </div>
        )}

        <Button onClick={() => navigate('investor-relations')} className="w-full md:w-auto md:mx-auto md:block md:px-10 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold py-3">
          Back to Investor Portal
        </Button>
        </div>
      </div>
    </div>
  )
}

export default InvestorPresentationPage
