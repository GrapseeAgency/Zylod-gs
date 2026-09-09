'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, TrendingUp, FileText, Download, ShieldCheck,
  Building2, PieChart, ChevronRight, Mail, Calendar
} from 'lucide-react'

interface InvestorDoc {
  id: string
  docType: string
  title: string
  fiscalYear?: string
  fiscalQ?: string
  fileUrl: string
  summary?: string
  publishedAt: string
}

export function InvestorRelationsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [docs, setDocs] = useState<InvestorDoc[]>([])
  const [grouped, setGrouped] = useState<Record<string, InvestorDoc[]>>({})
  const [years, setYears] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/investor')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setDocs(res.data.documents)
          setGrouped(res.data.grouped)
          setYears(res.data.years)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-base">Investor Relations</h1>
            <p className="text-xs text-gray-400">Financial Reports, Filings & Corporate Governance</p>
          </div>
        </div>
        <button
          onClick={() => navigate('investor-contact')}
          className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100"
        >
          <Mail className="w-3.5 h-3.5" />
          IR Contact
        </button>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24 md:px-6 md:py-6 md:pb-8 md:space-y-8 lg:max-w-5xl">
        {/* Hero */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white space-y-3">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
            Shareholder & Investor Portal
          </Badge>
          <h2 className="text-xl md:text-2xl font-black leading-tight">
            Transparent Financial Disclosures & Market Leadership
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Zylod Wholesale operates under strict institutional corporate governance, certified audits, and transparent quarterly performance metrics.
          </p>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
            <div className="text-center">
              <p className="text-base md:text-xl font-black text-emerald-400">Series A</p>
              <p className="text-[10px] text-slate-400">Growth Stage</p>
            </div>
            <div className="text-center">
              <p className="text-base md:text-xl font-black text-teal-300">320% YoY</p>
              <p className="text-[10px] text-slate-400">GMV Trajectory</p>
            </div>
            <div className="text-center">
              <p className="text-base md:text-xl font-black text-amber-300">Unqualified</p>
              <p className="text-[10px] text-slate-400">Audit Opinion</p>
            </div>
          </div>
        </div>

        {/* Quick Nav Sub-pages */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Investor Resources</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              { label: 'Annual Reports', id: 'annual-report' },
              { label: 'Financial Filings', id: 'financial-filings' },
              { label: 'Investor Presentations', id: 'investor-presentation' },
              { label: 'Corporate Governance', id: 'company-values' },
              { label: 'Leadership Team', id: 'leadership-team' },
              { label: 'IR Contact Desk', id: 'investor-contact' },
            ].map(link => (
              <button
                key={link.id}
                onClick={() => navigate(link.id)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
              >
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Document Sections */}
        <div className="space-y-4">
          <h3 className="text-sm md:text-base font-bold text-gray-900">Recent Publications & Filings</h3>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-3xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {docs.map(doc => (
              <div
                key={doc.id}
                className="bg-white rounded-3xl p-4.5 border border-gray-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase">
                      {doc.docType.replace('_', ' ')} · {doc.fiscalYear || 'FY26'}
                    </Badge>
                    <h4 className="text-sm font-bold text-gray-900 leading-snug">
                      {doc.title}
                    </h4>
                  </div>
                  <a
                    href={doc.fileUrl}
                    download
                    className="p-2 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition flex-shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>

                {doc.summary && (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {doc.summary}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-50">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Published {new Date(doc.publishedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="font-semibold text-emerald-700">PDF Download</span>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvestorRelationsPage
