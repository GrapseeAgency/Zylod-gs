'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react'

export function TermsFaqPage() {
  const { navigate, goBack } = useNavigationStore()
  const [faqs, setFaqs] = useState<Array<{ id: string; questionEn: string; answerEn: string }>>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/legal/faq?docType=terms_of_service')
      .then(res => res.json())
      .then(res => {
        if (res.success) setFaqs(res.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Terms of Service FAQ</h1>
          <p className="text-xs text-gray-400">Common Questions on Platform Usage & Agreements</p>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Terms of Service FAQ</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {faqs.map(faq => (
              <div key={faq.id} className="p-4 space-y-2">
                <button
                  onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-xs font-bold text-gray-900 pr-2">{faq.questionEn}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openId === faq.id ? 'rotate-180' : ''}`} />
                </button>
                {openId === faq.id && (
                  <p className="text-xs text-gray-600 leading-relaxed pt-1">{faq.answerEn}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Button onClick={() => navigate('terms-of-service')} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-3">
          Back to Terms of Service
        </Button>
      </div>
    </div>
  )
}

export default TermsFaqPage
