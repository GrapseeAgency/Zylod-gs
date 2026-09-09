'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Shield, Lock, Eye, Globe, ChevronDown,
  ChevronRight, Database, UserX, Download, AlertCircle
} from 'lucide-react'

interface LegalDoc {
  id: string; docType: string; titleEn: string; contentEn: string; version: string; effectiveDate: string; updatedAt: string
}
interface LegalFaq { id: string; questionEn: string; answerEn: string }

export function PrivacyPolicyPage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/privacy_policy').then(r => r.json()),
      fetch('/api/legal/faq?docType=privacy_policy').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const dataCategories = [
    { icon: UserX, label: 'Identity Data', desc: 'Name, NID, trade license, TIN' },
    { icon: Lock, label: 'Financial Data', desc: 'Payment methods, transaction history' },
    { icon: Globe, label: 'Usage Data', desc: 'Pages visited, search queries, device info' },
    { icon: Database, label: 'Commercial Data', desc: 'Orders, products viewed, supplier interactions' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base md:text-2xl">Privacy Policy</h1>
          {doc && <p className="text-xs text-gray-400">v{doc.version} · Effective {new Date(doc.effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24 md:px-6 md:py-8 md:space-y-8 md:pb-10 lg:max-w-4xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}</div>
        ) : (
          <>
            {/* Hero */}
            <div className="bg-emerald-600 rounded-3xl p-5 md:p-8 text-white space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <span className="font-bold text-sm">Your Privacy Matters</span>
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed">
                Zylod is committed to protecting your personal and business data in compliance with Bangladesh's Digital Security Act and international GDPR standards.
              </p>
              <div className="flex gap-4 pt-1">
                <div><p className="text-xs font-black">v{doc?.version || '1.0'}</p><p className="text-xs text-emerald-200">Version</p></div>
                <div><p className="text-xs font-black">GDPR</p><p className="text-xs text-emerald-200">Compliant</p></div>
                <div><p className="text-xs font-black">PDPA</p><p className="text-xs text-emerald-200">BD Law</p></div>
              </div>
            </div>

            {/* Data categories */}
            <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Data We Collect</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {dataCategories.map(cat => (
                  <div key={cat.label} className="bg-slate-50 rounded-2xl p-3 space-y-1">
                    <cat.icon className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-bold text-gray-800">{cat.label}</p>
                    <p className="text-xs text-gray-500">{cat.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick nav sub-pages */}
            <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Data Rights & Sub-Sections</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Data Collection', id: 'data-collection' },
                  { label: 'Your Data Rights', id: 'data-rights' },
                  { label: 'Delete My Data', id: 'data-deletion' },
                  { label: 'Privacy FAQ', id: 'privacy-faq' },
                  { label: 'Cookie Policy', id: 'cookie-policy' },
                  { label: 'Cookie Preferences', id: 'cookie-preferences' },
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

            {/* Full policy content */}
            {doc && (
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Full Privacy Policy</h3>
                <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</div>
              </div>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Privacy FAQs</h3>
                </div>
                {faqs.map(faq => (
                  <div key={faq.id} className="border-b border-gray-50 last:border-b-0">
                    <button
                      onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition"
                    >
                      <span className="text-sm font-semibold text-gray-800 pr-3">{faq.questionEn}</span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === faq.id ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaq === faq.id && (
                      <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed">{faq.answerEn}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button onClick={() => navigate('data-rights')} className="w-full md:w-auto md:px-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold py-3">
              <Download className="w-4 h-4 mr-2" />
              Exercise Your Data Rights
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
