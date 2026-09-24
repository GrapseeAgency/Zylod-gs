'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, RotateCcw, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, AlertTriangle, Package
} from 'lucide-react'

interface LegalDoc { id: string; titleEn: string; contentEn: string; version: string; updatedAt: string }
interface LegalFaq { id: string; questionEn: string; answerEn: string }

export function ReturnPolicyPage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/return_policy').then(r => r.json()),
      fetch('/api/legal/faq?docType=return_policy').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const returnSteps = [
    { step: 1, title: 'Initiate Request', desc: 'Go to My Orders → select order → tap Return/Exchange', icon: RotateCcw },
    { step: 2, title: 'Supplier Review', desc: 'Supplier reviews within 48 hours and confirms eligibility', icon: Clock },
    { step: 3, title: 'Ship Item Back', desc: 'Pack securely, drop at approved courier point', icon: Package },
    { step: 4, title: 'Refund Processed', desc: 'Wallet/bank credited within 5–7 business days', icon: CheckCircle2 },
  ]

  const returnable = [
    'Wrong item delivered (different from order)', 'Defective or damaged product',
    'Counterfeit or unverified goods', 'Short quantity vs invoice',
    'Expired or past best-before date', 'Failed quality inspection'
  ]
  const nonReturnable = [
    'Custom-manufactured or bespoke orders', 'Perishable goods (food, chemicals)',
    'Intimate or hygiene products', 'Items damaged by buyer after delivery',
    'Items without original packaging after 7 days', 'Digital or software products'
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base md:text-xl">Return Policy</h1>
          {doc && <p className="text-xs text-gray-400">v{doc.version} · Updated {new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24 md:px-6 md:py-8 md:space-y-8 md:pb-10 lg:max-w-4xl">
        {/* Hero */}
        <div className="bg-orange-500 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            <span className="font-bold text-sm">Wholesale Return Guarantee</span>
          </div>
          <p className="text-xs text-orange-100 leading-relaxed">
            All verified Zylod orders are covered by our Buyer Protection Programme. Return or exchange defective bulk merchandise within the eligible window.
          </p>
          <div className="flex gap-4 pt-1">
            <div><p className="text-xs font-black">7 Days</p><p className="text-xs text-orange-200">Return Window</p></div>
            <div><p className="text-xs font-black">Team</p><p className="text-xs text-orange-200">Reviewed Claims</p></div>
            <div><p className="text-xs font-black">5–7 Days</p><p className="text-xs text-orange-200">Refund Time</p></div>
          </div>
        </div>

        {/* Return process steps */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Return Process</h3>
          <div className="space-y-3">
            {returnSteps.map((s, idx) => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.step}</div>
                <div>
                  <p className="text-xs font-bold text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-page navigation */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Return Resources</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Start Return Request', id: 'return-request' },
              { label: 'Return Process Guide', id: 'return-process' },
              { label: 'Non-Returnable Items', id: 'non-returnable' },
              { label: 'Return FAQs', id: 'return-faq' },
            ].map(link => (
              <button
                key={link.id}
                onClick={() => navigate(link.id)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition"
              >
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Returnable vs Non-Returnable */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-gray-800">Returnable</span>
            </div>
            <ul className="space-y-1.5">
              {returnable.map(item => (
                <li key={item} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">•</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-gray-800">Not Returnable</span>
            </div>
            <ul className="space-y-1.5">
              {nonReturnable.map(item => (
                <li key={item} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5">•</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Full policy */}
        {doc && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Full Return Policy</h3>
            <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</div>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Return FAQs</h3>
            </div>
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

        <Button onClick={() => navigate('return-request')} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold py-3">
          <RotateCcw className="w-4 h-4 mr-2" />
          Start Return Request
        </Button>
      </div>
    </div>
  )
}

export default ReturnPolicyPage
