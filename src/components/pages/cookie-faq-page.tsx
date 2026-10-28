'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronDown, AlertCircle } from 'lucide-react'

export function CookieFaqPage() {
  const { navigate, goBack } = useNavigationStore()
  const [faqs, setFaqs] = useState<Array<{ id: string; questionEn: string; answerEn: string }>>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    fetch('/api/legal/faq?docType=cookie_policy')
      .then(res => res.json())
      .then(res => {
        if (res?.success && Array.isArray(res.data)) setFaqs(res.data)
        else setLoadError(true)
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base">Cookie Policy FAQ</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Information about Local Storage, Sessions & Tracking</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 pb-24 md:pb-8 lg:max-w-4xl">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}
          </div>
        ) : loadError ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Could not load the FAQ</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">The FAQ list is temporarily unavailable — please try again later.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden divide-y divide-gray-50 md:divide-y-0 grid grid-cols-1 md:grid-cols-2 gap-x-6">
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

        <Button onClick={() => navigate('cookie-policy')} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold py-3">
          Back to Cookie Policy
        </Button>
      </div>
    </div>
  )
}

export default CookieFaqPage
