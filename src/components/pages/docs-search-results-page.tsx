'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Search, BookOpen, HelpCircle, ChevronRight,
  FileText, ShieldCheck
} from 'lucide-react'

interface SearchResultArticle {
  id: string
  slug: string
  category: string
  titleEn: string
  titleBn?: string
  views: number
}

interface SearchResultFaq {
  id: string
  category: string
  questionEn: string
  answerEn: string
}

export function DocsSearchResultsPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const initialQuery = pageParams.query || ''
  const [query, setQuery] = useState(initialQuery)
  const [articles, setArticles] = useState<SearchResultArticle[]>([])
  const [faqs, setFaqs] = useState<SearchResultFaq[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchResults(search: string) {
    setLoading(true)
    try {
      const [artRes, faqRes] = await Promise.all([
        fetch(`/api/support/articles?q=${encodeURIComponent(search)}`),
        fetch(`/api/support/faqs?q=${encodeURIComponent(search)}`),
      ])
      if (artRes.ok) {
        const json = await artRes.json()
        setArticles(json.data || [])
      }
      if (faqRes.ok) {
        const json = await faqRes.json()
        setFaqs(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (query.trim()) {
      fetchResults(query.trim())
    } else {
      setLoading(false)
    }
  }, [query])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) fetchResults(query.trim())
  }

  const totalMatches = articles.length + faqs.length

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Search Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <form onSubmit={handleSearch} className="flex-1 relative">
            <input
              type="text"
              placeholder="Search wholesale documentation, policies, FAQs..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-red-500"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </form>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 max-w-3xl mx-auto lg:max-w-6xl w-full space-y-6 md:space-y-8 pb-24 md:pb-8">
        <div>
          <h1 className="text-sm md:text-xl font-bold text-gray-900">
            {loading ? 'Searching...' : `Search Results for "${query}" (${totalMatches} found)`}
          </h1>
          <p className="text-xs md:text-sm text-gray-400">Documentation articles and answered questions</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : totalMatches === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl p-6 border border-gray-100 space-y-2">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-800">No matching documentation</p>
            <p className="text-xs text-gray-400">Try searching for keywords like "payment", "moq", "verification", or "dispute".</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Policy Articles Section */}
            {articles.length > 0 && (
              <div className="space-y-2.5">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Policy Documents ({articles.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {articles.map((art, idx) => (
                    <motion.div
                      key={art.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => navigate('docs-browser', { slug: art.slug })}
                      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-red-200 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                          {art.category}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-red-600 transition">
                          {art.titleEn}
                        </h3>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition flex-shrink-0" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQs Section */}
            {faqs.length > 0 && (
              <div className="space-y-2.5">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Matching FAQs ({faqs.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {faqs.map((faq, idx) => (
                    <motion.div
                      key={faq.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => navigate('faq', { category: faq.category })}
                      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-red-200 transition cursor-pointer space-y-1 group"
                    >
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-red-600 transition">
                        {faq.questionEn}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {faq.answerEn}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DocsSearchResultsPage
