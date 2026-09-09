'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Cookie, Shield, BarChart3, Megaphone,
  ChevronDown, ChevronRight, CheckCircle2, Info
} from 'lucide-react'

interface LegalDoc { id: string; titleEn: string; contentEn: string; version: string; updatedAt: string }
interface LegalFaq { id: string; questionEn: string; answerEn: string }

export function CookiePolicyPage() {
  const { navigate, goBack } = useNavigationStore()
  const [doc, setDoc] = useState<LegalDoc | null>(null)
  const [faqs, setFaqs] = useState<LegalFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/legal/cookie_policy').then(r => r.json()),
      fetch('/api/legal/faq?docType=cookie_policy').then(r => r.json()),
    ]).then(([docData, faqData]) => {
      if (docData.success) setDoc(docData.data.document)
      if (faqData.success) setFaqs(faqData.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const savePreferences = async () => {
    setSaving(true)
    try {
      const sessionId = `session-${Math.random().toString(36).slice(2)}`
      await fetch('/api/legal/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, analyticsAllowed: analytics, marketingAllowed: marketing }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const cookieTypes = [
    { type: 'Strictly Necessary', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'Essential for platform operation — authentication, cart, security', required: true },
    { type: 'Analytics', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Help us understand platform usage patterns to improve your experience', required: false },
    { type: 'Marketing', icon: Megaphone, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Personalise wholesale deals, promotions, and recommendations', required: false },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Cookie Policy</h1>
          {doc && <p className="text-xs text-gray-400">Updated {new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-5 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        {/* Cookie preference center */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-900">Cookie Preferences</h3>
          </div>
          <p className="text-xs text-gray-500">Choose which cookies you allow. Strictly necessary cookies cannot be disabled.</p>
          <div className="space-y-3">
            {cookieTypes.map(ct => (
              <div key={ct.type} className={`rounded-2xl p-3.5 ${ct.bg} flex items-start justify-between gap-3`}>
                <div className="flex items-start gap-3 flex-1">
                  <ct.icon className={`w-4 h-4 ${ct.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-bold ${ct.color}`}>{ct.type}</p>
                      {ct.required && <Badge className="bg-white text-gray-500 border-gray-200 text-xs py-0">Required</Badge>}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{ct.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={ct.required ? true : ct.type === 'Analytics' ? analytics : marketing}
                  onCheckedChange={ct.required ? undefined : (v) => ct.type === 'Analytics' ? setAnalytics(v) : setMarketing(v)}
                  disabled={ct.required}
                  className="flex-shrink-0"
                />
              </div>
            ))}
          </div>
          <Button
            onClick={savePreferences}
            disabled={saving}
            className={`w-full rounded-xl text-sm font-bold py-3 ${saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'} text-white`}
          >
            {saved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Preferences Saved!</> : saving ? 'Saving...' : 'Save Cookie Preferences'}
          </Button>
        </div>

        {/* Sub-page links */}
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cookie Resources</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Cookie Preferences', id: 'cookie-preferences' },
              { label: 'Cookie FAQs', id: 'cookie-faq' },
              { label: 'Privacy Policy', id: 'privacy-policy' },
              { label: 'Data Rights', id: 'data-rights' },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition">
                {link.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Full policy */}
        {doc && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Full Cookie Policy</h3>
            <div className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{doc.contentEn}</div>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">Cookie FAQs</h3></div>
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

export default CookiePolicyPage
