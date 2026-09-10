'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Search, ThumbsUp, ThumbsDown, ChevronDown,
  HelpCircle, MessageCircle, Mail, Globe, Check
} from 'lucide-react'

interface FAQItem {
  id: string
  category: string
  questionEn: string
  answerEn: string
  questionBn?: string
  answerBn?: string
  helpfulYes: number
  helpfulNo: number
  sortOrder: number
}

export function FAQPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const initialCategory = pageParams.category || 'all'
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [language, setLanguage] = useState<'en' | 'bn'>('en')
  const [searchQuery, setSearchQuery] = useState('')
  const [faqs, setFaqs] = useState<FAQItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [votedMap, setVotedMap] = useState<Record<string, 'yes' | 'no'>>({})

  const categories = [
    { id: 'all', labelEn: 'All Topics', labelBn: 'সকল বিষয়' },
    { id: 'orders', labelEn: 'Orders & MOQs', labelBn: 'অর্ডার ও MOQ' },
    { id: 'payments', labelEn: 'SafePay Escrow', labelBn: 'এস্ক্রো পেমেন্ট' },
    { id: 'shipping', labelEn: 'Shipping & Delivery', labelBn: 'ডেলিভারি ও কুরিয়ার' },
    { id: 'returns', labelEn: 'Returns & Disputes', labelBn: 'রিটার্ন ও ডিসপুট' },
    { id: 'sellers', labelEn: 'Seller & Verification', labelBn: 'সেলার ও ভেরিফিকেশন' },
    { id: 'account', labelEn: 'Account & Security', labelBn: 'নিরাপত্তা ও অ্যাকাউন্ট' },
  ]

  useEffect(() => {
    fetchFaqs()
  }, [selectedCategory])

  async function fetchFaqs() {
    setLoading(true)
    try {
      const url = selectedCategory === 'all'
        ? '/api/support/faqs'
        : `/api/support/faqs?category=${selectedCategory}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setFaqs(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  async function handleVote(id: string, helpful: boolean) {
    if (votedMap[id]) return
    setVotedMap(prev => ({ ...prev, [id]: helpful ? 'yes' : 'no' }))
    try {
      await fetch(`/api/support/faqs/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
      // Update local count
      setFaqs(prev => prev.map(f => f.id === id ? {
        ...f,
        helpfulYes: helpful ? f.helpfulYes + 1 : f.helpfulYes,
        helpfulNo: !helpful ? f.helpfulNo + 1 : f.helpfulNo,
      } : f))
    } catch {}
  }

  const filteredFaqs = faqs.filter(faq => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return faq.questionEn.toLowerCase().includes(q) ||
      faq.answerEn.toLowerCase().includes(q) ||
      (faq.questionBn && faq.questionBn.includes(q)) ||
      (faq.answerBn && faq.answerBn.includes(q))
  })

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition md:hidden">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="font-bold text-gray-900 text-base md:text-lg">
              {language === 'bn' ? 'সাধারণ জিজ্ঞাসাসমূহ (FAQ)' : 'Frequently Asked Questions'}
            </h1>
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(l => l === 'en' ? 'bn' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-red-50 text-xs font-semibold text-gray-700 rounded-full transition"
          >
            <Globe className="w-3.5 h-3.5 text-red-600" />
            {language === 'en' ? 'বাংলা' : 'English'}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder={language === 'bn' ? 'প্রশ্ন দিয়ে খুঁজুন...' : 'Search questions or keywords...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-red-500 placeholder:text-gray-400"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        </div>

        {/* Category horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {language === 'bn' ? cat.labelBn : cat.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* FAQs List */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6 space-y-3 max-w-3xl lg:max-w-4xl mx-auto w-full pb-24 md:pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-gray-100">
            <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800">
              {language === 'bn' ? 'কোনো প্রশ্ন পাওয়া যায়নি' : 'No matching questions found'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {language === 'bn' ? 'সরাসরি লাইভ চ্যাটে আমাদের সাথে যোগাযোগ করুন' : 'Try searching another keyword or contact live support'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredFaqs.map((faq, idx) => {
              const isExpanded = expandedId === faq.id
              const question = language === 'bn' && faq.questionBn ? faq.questionBn : faq.questionEn
              const answer = language === 'bn' && faq.answerBn ? faq.answerBn : faq.answerEn

              return (
                <motion.div
                  key={faq.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                    className="w-full p-4 flex items-center justify-between text-left gap-3 hover:bg-slate-50/50 transition"
                  >
                    <span className="text-xs sm:text-sm md:text-base font-bold text-gray-900 leading-snug">
                      {question}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 border-t border-gray-50 pt-3"
                      >
                        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                          {answer}
                        </p>

                        {/* Helpful vote section */}
                        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400">
                          <span>
                            {language === 'bn' ? 'এই উত্তরটি কি সহায়ক ছিল?' : 'Was this answer helpful?'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVote(faq.id, true)}
                              disabled={!!votedMap[faq.id]}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                                votedMap[faq.id] === 'yes'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'hover:bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>Yes ({faq.helpfulYes})</span>
                            </button>
                            <button
                              onClick={() => handleVote(faq.id, false)}
                              disabled={!!votedMap[faq.id]}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                                votedMap[faq.id] === 'no'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'hover:bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <ThumbsDown className="w-3 h-3" />
                              <span>No</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Still need help CTA */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-5 text-white mt-6 shadow-md text-center space-y-2">
          <h3 className="font-bold text-sm">
            {language === 'bn' ? 'এখনো কোনো প্রশ্ন আছে?' : 'Still have questions?'}
          </h3>
          <p className="text-xs text-red-100 max-w-sm mx-auto">
            {language === 'bn'
              ? 'আমাদের গ্রাহক সেবা দল আপনার যেকোনো পাইকারি সহায়তায় প্রস্তুত রয়েছে।'
              : 'Our dedicated wholesale support specialists are ready to assist with your inquiries.'}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => navigate('live-chat')}
              className="px-4 py-2 bg-white text-red-700 rounded-xl text-xs font-bold shadow hover:bg-red-50 transition flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {language === 'bn' ? 'লাইভ চ্যাট' : 'Start Live Chat'}
            </button>
            <button
              onClick={() => navigate('submit-ticket')}
              className="px-4 py-2 bg-red-800 text-white rounded-xl text-xs font-bold hover:bg-red-900 transition flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              {language === 'bn' ? 'টিকেট খুলুন' : 'Submit Ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FAQPage
