'use client'

import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronDown } from 'lucide-react'

export function ShippingFaqPage() {
  const { navigate, goBack } = useNavigationStore()
  const [faqs, setFaqs] = useState<Array<{ id: string; questionEn: string; answerEn: string }>>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/legal/faq?docType=shipping_policy')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (json?.success) setFaqs(json.data)
        else throw new Error(json?.error || 'Unexpected response')
      })
      .catch(() => setLoadError('Could not load the FAQ list right now. Check your connection and retry.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Shipping & Logistics FAQ</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Timelines, Courier Partners, Freight Slabs & Tracking</p>
        </div>
      </div>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Shipping & Logistics FAQ</h1>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-4 pb-24">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}
          </div>
        ) : loadError ? (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 text-center text-xs font-bold text-red-600 dark:text-red-400">
            {loadError}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden divide-y divide-gray-50">
            {faqs.map(faq => (
              <div key={faq.id} className="p-4 space-y-2">
                <button
                  onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 pr-2">{faq.questionEn}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openId === faq.id ? 'rotate-180' : ''}`} />
                </button>
                {openId === faq.id && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed pt-1">{faq.answerEn}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Button onClick={() => navigate('shipping-policy')} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold py-3">
          Back to Shipping Policy
        </Button>
      </div>
    </div>
  )
}

export default ShippingFaqPage
