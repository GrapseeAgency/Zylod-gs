'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, FileText, ChevronDown, ChevronRight, Share2,
  Printer, Globe, BookOpen, Clock, AlertCircle, CheckCircle2
} from 'lucide-react'

interface LegalSection {
  id: string
  title: string
  content: string
}

interface LegalDoc {
  id: string
  docType: string
  titleEn: string
  titleBn?: string
  contentEn: string
  version: string
  effectiveDate: string
  updatedAt: string
}

interface LegalFaq {
  id: string
  questionEn: string
  answerEn: string
}

function parseSections(content: string): LegalSection[] {
  const lines = content.split('\n')
  const sections: LegalSection[] = []
  let current: LegalSection | null = null

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { id: line.slice(3).toLowerCase().replace(/\s+/g, '-'), title: line.slice(3), content: '' }
    } else if (current) {
      current.content += line + '\n'
    }
  }
  if (current) sections.push(current)
  return sections
}

export function TermsOfServicePage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<string | null>('1')
  const [language, setLanguage] = useState<'en' | 'bn'>('en')

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/terms_of_service').then(r => r.json()),
      fetch('/api/legal/faq?docType=terms_of_service').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const sections = doc ? parseSections(doc.contentEn) : []

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-base md:text-xl">Terms of Service</h1>
            {doc && <p className="text-xs text-gray-400">v{doc.version} · {new Date(doc.effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(l => l === 'en' ? 'bn' : 'en')}
            className="flex items-center gap-1 text-xs text-gray-600 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <Globe className="w-3.5 h-3.5" />
            {language === 'en' ? 'বাংলা' : 'English'}
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24 md:px-6 md:py-8 md:space-y-8 md:pb-10 lg:max-w-4xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}
          </div>
        ) : !doc ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Terms document loading</p>
            <p className="text-xs text-gray-500">Our legal team is finalizing the latest version. Please check back shortly.</p>
          </div>
        ) : (
          <>
            {/* Intro card */}
            <div className="bg-blue-600 rounded-3xl p-5 text-white space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span className="font-bold text-sm">Platform Usage Agreement</span>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed">
                By accessing Zylod Wholesale Marketplace, you agree to be bound by these terms.
                This agreement governs all wholesale transactions conducted on our platform.
              </p>
              <div className="flex gap-3 pt-1">
                <div className="text-center">
                  <p className="text-xs font-black">v{doc.version}</p>
                  <p className="text-xs text-blue-200">Version</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-black">{new Date(doc.effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  <p className="text-xs text-blue-200">Effective</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-black">{new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  <p className="text-xs text-blue-200">Updated</p>
                </div>
              </div>
            </div>

            {/* Quick nav sub-pages */}
            <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Navigation</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Buyer Terms', id: 'buyer-terms' },
                  { label: 'Seller Terms', id: 'seller-terms' },
                  { label: 'Terms FAQs', id: 'terms-faq' },
                  { label: 'Version History', id: 'terms-history' },
                ].map(link => (
                  <button
                    key={link.id}
                    onClick={() => navigate(link.id)}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition"
                  >
                    {link.label}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Sections accordion */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Document Sections</h3>
              </div>
              {sections.length > 0 ? sections.map((section, idx) => (
                <div key={section.id} className="border-b border-gray-50 last:border-b-0">
                  <button
                    onClick={() => setOpenSection(openSection === String(idx) ? null : String(idx))}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">{idx + 1}</span>
                      <span className="text-sm font-semibold text-gray-800">{section.title}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openSection === String(idx) ? 'rotate-180' : ''}`} />
                  </button>
                  {openSection === String(idx) && (
                    <div className="px-4 pb-4">
                      <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap pl-9">{section.content.trim()}</div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="px-4 py-4">
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</p>
                </div>
              )}
            </div>

            {/* FAQs */}
            {faqs.length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Frequently Asked Questions</h3>
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

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => navigate('buyer-terms')} variant="outline" className="rounded-xl text-xs font-bold">
                <BookOpen className="w-4 h-4 mr-1" />
                Buyer Terms
              </Button>
              <Button onClick={() => navigate('seller-terms')} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">
                Seller Terms →
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TermsOfServicePage
