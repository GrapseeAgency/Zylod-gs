'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, CreditCard, Building2, Wallet, ChevronDown,
  ChevronRight, Shield, Clock, AlertCircle, CheckCircle2
} from 'lucide-react'

interface LegalDoc { id: string; titleEn: string; contentEn: string; version: string; updatedAt: string }
interface LegalFaq { id: string; questionEn: string; answerEn: string }

export function PaymentTermsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/payment_terms').then(r => r.json()),
      fetch('/api/legal/faq?docType=payment_terms').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const paymentMethods = [
    { name: 'bKash', type: 'Mobile Banking', fee: '1.85%', limit: '৳1,00,000/day' },
    { name: 'Nagad', type: 'Mobile Banking', fee: '1.5%', limit: '৳50,000/day' },
    { name: 'Bank Transfer (BEFTN)', type: 'Bank', fee: '0%', limit: 'Unlimited' },
    { name: 'NPSB / RTGS', type: 'Bank', fee: '0%', limit: 'Unlimited' },
    { name: 'Zylod Wallet', type: 'Platform', fee: '0%', limit: 'Per balance' },
    { name: 'SafePay Escrow', type: 'Platform', fee: '2%', limit: 'Per order' },
    { name: 'Credit Card', type: 'Card', fee: '2.5%', limit: '৳5,00,000/txn' },
    { name: 'Debit Card', type: 'Card', fee: '1%', limit: '৳2,00,000/txn' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Payment Terms</h1>
          {doc && <p className="text-xs text-gray-400">Updated {new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24 md:pb-8 md:px-6 md:py-6 lg:max-w-4xl">
        {/* Hero */}
        <div className="bg-violet-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <span className="font-bold text-sm">Flexible Wholesale Payment Options</span>
          </div>
          <p className="text-xs text-violet-100 leading-relaxed">
            Pay via bKash, bank transfer, or SafePay escrow. All transactions are protected by our buyer guarantee.
          </p>
          <div className="flex gap-4 pt-1">
            <div><p className="text-xs font-black">8+</p><p className="text-xs text-violet-200">Methods</p></div>
            <div><p className="text-xs font-black">100%</p><p className="text-xs text-violet-200">Secure</p></div>
            <div><p className="text-xs font-black">SafePay</p><p className="text-xs text-violet-200">Protected</p></div>
          </div>
        </div>

        {/* Sub-page links */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Resources</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              { label: 'All Payment Methods', id: 'payment-methods-detail' },
              { label: 'Credit & Installment Terms', id: 'credit-terms' },
              { label: 'Payment FAQs', id: 'payment-faq' },
              { label: 'My Payment Methods', id: 'payment-method' },
              { label: 'Wallet Balance', id: 'wallet' },
              { label: 'Invoice List', id: 'invoice-list' },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition">
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Payment methods table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Accepted Payment Methods</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {paymentMethods.map(pm => (
              <div key={pm.name} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-gray-800">{pm.name}</p>
                  <p className="text-xs text-gray-500">{pm.type} · {pm.limit}</p>
                </div>
                <Badge className={`text-xs font-bold ${pm.fee === '0%' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                  {pm.fee} fee
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Key payment terms */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-3 md:space-y-0">
          <h3 className="text-sm font-bold text-gray-900 md:col-span-2">Key Payment Rules</h3>
          {[
            { icon: Shield, text: 'SafePay escrow holds funds until buyer confirms delivery' },
            { icon: Clock, text: 'Supplier payouts released 48 hours after delivery confirmation' },
            { icon: AlertCircle, text: 'Disputed payments held in escrow until resolution' },
            { icon: CheckCircle2, text: 'Refunds processed within 5–7 business days' },
          ].map(rule => (
            <div key={rule.text} className="flex items-start gap-3">
              <rule.icon className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700">{rule.text}</p>
            </div>
          ))}
        </div>

        {/* Full policy */}
        {doc && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Full Payment Terms</h3>
            <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</div>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">Payment FAQs</h3></div>
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

        <Button onClick={() => navigate('payment-method')} className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold py-3 md:w-auto md:max-w-xs md:mx-auto md:flex md:px-8">
          <CreditCard className="w-4 h-4 mr-2" />
          Manage Payment Methods
        </Button>
      </div>
    </div>
  )
}

export default PaymentTermsPage
