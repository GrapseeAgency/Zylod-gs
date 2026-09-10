'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, ShieldAlert, FileText, Send, Clock,
  ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Scale
} from 'lucide-react'

interface LegalDoc { id: string; titleEn: string; contentEn: string; version: string; updatedAt: string }
interface LegalFaq { id: string; questionEn: string; answerEn: string }

export function DmcaPolicyPage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/dmca_policy').then(r => r.json()),
      fetch('/api/legal/faq?docType=dmca_policy').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">DMCA & IP Protection</h1>
          {doc && <p className="text-xs text-gray-400">v{doc.version} · Updated {new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-5 md:space-y-8 lg:max-w-4xl pb-24 md:pb-8">
        <div className="hidden md:block">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">DMCA &amp; IP Protection</h1>
          {doc && <p className="text-sm text-gray-400 mt-1">v{doc.version} · Updated {new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>

        {/* Hero */}
        <div className="bg-red-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-bold text-sm">Intellectual Property Protection</span>
          </div>
          <p className="text-xs text-red-100 leading-relaxed">
            Zylod enforces strict compliance with the Copyright Act, 2000 (Bangladesh) and the Digital Millennium Copyright Act (DMCA). Counterfeits and IP infringement are removed promptly.
          </p>
          <div className="flex gap-4 pt-1">
            <div><p className="text-xs font-black">72 Hours</p><p className="text-xs text-red-200">SLA Response</p></div>
            <div><p className="text-xs font-black">Zero</p><p className="text-xs text-red-200">Tolerance</p></div>
            <div><p className="text-xs font-black">Legal Desk</p><p className="text-xs text-red-200">Enforcement</p></div>
          </div>
        </div>

        {/* Takedown Action Banner */}
        <div className="bg-white rounded-3xl p-5 border border-red-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-bold text-gray-900">Found Infringing Content?</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            If you are a copyright or trademark owner and discover unauthorized usage of your media, brand logos, or patented designs on Zylod, submit a formalized takedown notice immediately.
          </p>
          <Button
            onClick={() => navigate('dmca-submit')}
            className="w-full md:w-auto md:px-8 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold py-2.5"
          >
            <Send className="w-4 h-4 mr-2" />
            File a DMCA Takedown Notice
          </Button>
        </div>

        {/* Sub-page links */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">IP Resources</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'File DMCA Notice', id: 'dmca-submit' },
              { label: 'DMCA FAQs', id: 'dmca-faq' },
              { label: 'Terms of Service', id: 'terms-of-service' },
              { label: 'Report Infringement', id: 'report-problem' },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-red-50 hover:text-red-700 transition">
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Full policy */}
        {doc && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">DMCA Policy Guidelines</h3>
            <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</div>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">DMCA FAQs</h3></div>
            {faqs.map(faq => (
              <div key={faq.id} className="border-b border-gray-50 last:border-b-0">
                <button onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)} className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition">
                  <span className="text-sm font-semibold text-gray-800 pr-3">{faq.questionEn}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === faq.id ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === faq.id && <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed">{faq.answerEn}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DmcaPolicyPage
