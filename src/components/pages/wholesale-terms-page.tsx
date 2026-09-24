'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Store, FileCheck, ShieldCheck, ChevronDown,
  ChevronRight, AlertCircle, Users, Package, Star
} from 'lucide-react'

interface LegalDoc { id: string; titleEn: string; contentEn: string; version: string; effectiveDate: string; updatedAt: string }
interface LegalFaq { id: string; questionEn: string; answerEn: string }

export function WholesaleTermsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/wholesale_terms').then(r => r.json()),
      fetch('/api/legal/faq?docType=wholesale_terms').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const supplierObligations = [
    'Maintain verified NID and trade license at all times',
    'Fulfill orders within confirmed SLA (default: 72 hours)',
    'Provide accurate product descriptions, images, and MOQ',
    'Honor all quoted prices for confirmed purchase orders',
    'Resolve buyer disputes within 48 hours through platform chat',
    'Provide accurate bank / mobile-banking details for receiving payments',
  ]
  const buyerObligations = [
    'Register with valid TIN and business registration',
    'Place orders for legitimate commercial resale purposes only',
    'Pay within confirmed payment window (default: 24 hours)',
    'Confirm delivery within 48 hours of receiving goods',
    'Report disputes before delivery confirmation',
    'Maintain minimum account activity (1 order/quarter for Silver+)',
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Wholesale Terms</h1>
          {doc && <p className="text-xs text-gray-400">v{doc.version} · Effective {new Date(doc.effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Wholesale Terms</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24">
        {/* Hero */}
        <div className="bg-rose-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            <span className="font-bold text-sm">B2B Wholesale Agreement</span>
          </div>
          <p className="text-xs text-rose-100 leading-relaxed">
            These terms govern all wholesale transactions between verified suppliers and accredited buyers on Zylod Marketplace.
          </p>
          <div className="flex gap-4 pt-1">
            <div><p className="text-xs font-black">B2B</p><p className="text-xs text-rose-200">Platform</p></div>
            <div><p className="text-xs font-black">Verified</p><p className="text-xs text-rose-200">Both Sides</p></div>
            <div><p className="text-xs font-black">MOQ</p><p className="text-xs text-rose-200">Based</p></div>
          </div>
        </div>

        {/* Sub-page links */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Wholesale Resources</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Wholesale Agreement', id: 'wholesale-agreement' },
              { label: 'Wholesale FAQs', id: 'wholesale-faq' },
              { label: 'Become a Supplier', id: 'supplier-verification' },
              { label: 'Buyer Accreditation', id: 'profile-verification' },
              { label: 'VIP Membership', id: 'vip-membership' },
              { label: 'Credit Terms', id: 'credit-terms' },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition">
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Obligations */}
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-gray-900">Supplier Obligations</h3>
            </div>
            <ul className="space-y-2">
              {supplierObligations.map(o => (
                <li key={o} className="flex items-start gap-2 text-xs text-gray-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Buyer Obligations</h3>
            </div>
            <ul className="space-y-2">
              {buyerObligations.map(o => (
                <li key={o} className="flex items-start gap-2 text-xs text-gray-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Full policy */}
        {doc && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Full Wholesale Terms</h3>
            <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</div>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">Wholesale FAQs</h3></div>
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

export default WholesaleTermsPage
