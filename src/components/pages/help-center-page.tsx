'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search, ArrowLeft, HelpCircle, MessageSquare, Phone, Mail,
  FileText, ShieldCheck, AlertTriangle, MessageCircle, ChevronRight,
  Sparkles, ExternalLink, Activity
} from 'lucide-react'

interface FAQItem {
  id: string
  category: string
  questionEn: string
  answerEn: string
  questionBn?: string
  answerBn?: string
  helpfulYes: number
}

interface SystemStatus {
  overallStatus: string
  services: { name: string; status: string }[]
}

export function HelpCenterPage() {
  const { navigate, goBack } = useNavigationStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [popularFaqs, setPopularFaqs] = useState<FAQItem[]>([])
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [faqRes, statusRes] = await Promise.all([
        fetch('/api/support/faqs?limit=4'),
        fetch('/api/support/status')
      ])
      if (faqRes.ok) {
        const json = await faqRes.json()
        setPopularFaqs(json.data || [])
      }
      if (statusRes.ok) {
        const json = await statusRes.json()
        setStatus(json.data || null)
      }
    } catch {}
    setLoading(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    navigate('docs-search-results', { query: searchQuery.trim() })
  }

  const topicCards = [
    { title: 'Orders & Shipping', desc: 'Tracking, courier delivery, MOQs', icon: FileText, page: 'faq', category: 'orders' },
    { title: 'SafePay Escrow', desc: '48h buyer protection & payment terms', icon: ShieldCheck, page: 'escrow-protection-guide' },
    { title: 'Supplier Hub & KYC', desc: 'Trade license, NID verification, listings', icon: HelpCircle, page: 'seller-verification-guide' },
    { title: 'Returns & Disputes', desc: 'Defective stock claims & arbitration', icon: AlertTriangle, page: 'dispute-resolution-guide' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-red-600 to-red-700 text-white px-4 pt-4 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-6 md:hidden">
          <button onClick={goBack} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="font-semibold text-lg">Help & Support Center</span>
        </div>

        <div className="max-w-md mx-auto text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">How can we help you?</h1>
          <p className="text-xs text-red-100">
            Search Bangladesh wholesale policies, FAQs, or contact our Dhaka team
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative mt-4">
            <input
              type="text"
              placeholder="Search help, policies, dispute rules, escrow..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white text-gray-900 rounded-2xl pl-11 pr-4 py-3.5 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" />
          </form>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-4xl mx-auto w-full pb-24 md:px-6 md:pb-8">
        {/* Quick Contact Banners */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('chatbot')}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">AI Assistant</p>
              <p className="text-xs text-gray-500">Instant policy lookups</p>
            </div>
          </button>

          <button
            onClick={() => navigate('live-chat')}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition flex-shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Live Chat</p>
              <p className="text-xs text-gray-500">Human support rep</p>
            </div>
          </button>
        </div>

        {/* Browse by Topic */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Browse Help Topics</h2>
            <button
              onClick={() => navigate('docs-browser')}
              className="text-xs font-semibold text-red-600 flex items-center gap-1 hover:underline"
            >
              All Docs <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topicCards.map((topic, idx) => {
              const Icon = topic.icon
              return (
                <motion.button
                  key={topic.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(topic.page, topic.category ? { category: topic.category } : {})}
                  className="flex items-start gap-3.5 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-red-200 transition text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 group-hover:bg-red-50 group-hover:text-red-600 transition flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 group-hover:text-red-600 transition">{topic.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{topic.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Top FAQs */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-red-600" />
              Frequently Asked Questions
            </h2>
            <button
              onClick={() => navigate('faq')}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {popularFaqs.map(faq => (
                <button
                  key={faq.id}
                  onClick={() => navigate('faq', { category: faq.category })}
                  className="w-full py-3 flex items-center justify-between text-left hover:text-red-600 transition group"
                >
                  <span className="text-xs font-medium text-gray-800 group-hover:text-red-600 pr-2">
                    {faq.questionEn}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Direct Actions (Tickets & Reports) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate('submit-ticket')}
            className="p-3 bg-white rounded-xl border border-gray-100 text-center hover:border-red-200 transition"
          >
            <Mail className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-xs font-semibold text-gray-800">Submit Ticket</p>
          </button>
          <button
            onClick={() => navigate('contact-us')}
            className="p-3 bg-white rounded-xl border border-gray-100 text-center hover:border-red-200 transition"
          >
            <Phone className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-xs font-semibold text-gray-800">Contact Us</p>
          </button>
          <button
            onClick={() => navigate('safety-center')}
            className="p-3 bg-white rounded-xl border border-gray-100 text-center hover:border-red-200 transition"
          >
            <ShieldCheck className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-xs font-semibold text-gray-800">Safety Center</p>
          </button>
          <button
            onClick={() => navigate('community-guidelines')}
            className="p-3 bg-white rounded-xl border border-gray-100 text-center hover:border-red-200 transition"
          >
            <FileText className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-xs font-semibold text-gray-800">Guidelines</p>
          </button>
        </div>

        {/* System Status Banner */}
        {status && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs font-semibold text-gray-800">
                System Status: <span className="text-green-600">{status.overallStatus}</span>
              </p>
            </div>
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-gray-400" />
              All Courier APIs Active
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default HelpCenterPage
