'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Truck, MapPin, Clock, ChevronDown, ChevronRight,
  Package, Globe, AlertCircle, CheckCircle2
} from 'lucide-react'

interface LegalDoc { id: string; titleEn: string; contentEn: string; version: string; updatedAt: string }
interface LegalFaq { id: string; questionEn: string; answerEn: string }

export function ShippingPolicyPage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/shipping_policy').then(r => r.json()),
      fetch('/api/legal/faq?docType=shipping_policy').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const couriers = [
    { name: 'Steadfast Courier', coverage: 'Nationwide', sla: '1–3 days', type: 'Standard' },
    { name: 'Pathao Courier', coverage: 'Dhaka Metro', sla: 'Same day', type: 'Express' },
    { name: 'RedX', coverage: 'Nationwide', sla: '2–4 days', type: 'Economy' },
    { name: 'eCourier', coverage: '64 Districts', sla: '1–3 days', type: 'Standard' },
    { name: 'Paperfly', coverage: 'Dhaka + Major Cities', sla: '1–2 days', type: 'Express' },
  ]

  const zones = [
    { zone: 'Dhaka Metro', rate: '৳60–100', sla: 'Same-day / Next-day' },
    { zone: 'Dhaka Outskirts', rate: '৳80–130', sla: '1–2 days' },
    { zone: 'Chittagong', rate: '৳100–150', sla: '2–3 days' },
    { zone: 'Sylhet / Rajshahi', rate: '৳120–180', sla: '2–4 days' },
    { zone: 'Rangpur / Khulna', rate: '৳130–200', sla: '3–5 days' },
    { zone: 'Remote / Char Areas', rate: '৳200–350', sla: '4–7 days' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Shipping Policy</h1>
          {doc && <p className="text-xs text-gray-400">v{doc.version} · Updated {new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Shipping Policy</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-5 pb-24">
        {/* Hero */}
        <div className="bg-indigo-600 rounded-3xl p-5 text-white space-y-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            <span className="font-bold text-sm">Nationwide Wholesale Delivery</span>
          </div>
          <p className="text-xs text-indigo-100 leading-relaxed">
            Zylod ships bulk wholesale orders across all 64 districts of Bangladesh via verified courier partners.
          </p>
          <div className="flex gap-4 pt-1">
            <div><p className="text-xs font-black">64</p><p className="text-xs text-indigo-200">Districts</p></div>
            <div><p className="text-xs font-black">5+</p><p className="text-xs text-indigo-200">Couriers</p></div>
            <div><p className="text-xs font-black">72 hrs</p><p className="text-xs text-indigo-200">Processing</p></div>
          </div>
        </div>

        {/* Sub-page links */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Shipping Resources</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Domestic Shipping', id: 'domestic-shipping' },
              { label: 'International Options', id: 'international-shipping' },
              { label: 'Shipping Calculator', id: 'shipping-calculator' },
              { label: 'Shipping FAQs', id: 'shipping-faq' },
              { label: 'Track Shipment', id: 'shipping-tracker' },
              { label: 'Delivery Zones', id: 'shipping-zone-editor' },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition">
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Delivery zones table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-gray-900">Delivery Zones & Rates</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {zones.map(zone => (
              <div key={zone.zone} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-gray-800">{zone.zone}</p>
                  <p className="text-xs text-gray-500">{zone.sla}</p>
                </div>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-bold">{zone.rate}</Badge>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-gray-100">
            <p className="text-xs text-gray-500">* Rates are per shipment for standard courier. Bulk discounts available for 500+ kg.</p>
          </div>
        </div>

        {/* Courier partners */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Approved Courier Partners</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {couriers.map(c => (
              <div key={c.name} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.coverage}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-indigo-700">{c.sla}</p>
                  <Badge variant="outline" className="text-xs">{c.type}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full policy */}
        {doc && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Full Shipping Policy</h3>
            <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</div>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">Shipping FAQs</h3></div>
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

        <Button onClick={() => navigate('shipping-calculator')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold py-3">
          <Truck className="w-4 h-4 mr-2" />
          Calculate Shipping Cost
        </Button>
      </div>
    </div>
  )
}

export default ShippingPolicyPage
