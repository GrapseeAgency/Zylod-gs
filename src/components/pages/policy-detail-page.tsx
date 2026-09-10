'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { DocMarkdownRenderer } from '@/components/ui/doc-markdown-renderer'
import {
  ArrowLeft, BookOpen, Globe, ThumbsUp, ThumbsDown,
  CheckCircle2, Share2, Printer, ChevronRight
} from 'lucide-react'

interface Article {
  id: string
  slug: string
  category: string
  titleEn: string
  titleBn?: string
  contentEn: string
  contentBn?: string
  views: number
  updatedAt: string
}

export function PolicyDetailPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const slug = pageParams.slug || 'terms-and-conditions'
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<'en' | 'bn'>('en')
  const [feedbackSent, setFeedbackSent] = useState(false)

  useEffect(() => {
    fetchArticle()
  }, [slug])

  async function fetchArticle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/support/articles/${slug}`)
      if (res.ok) {
        const json = await res.json()
        setArticle(json.data)
      }
    } catch {}
    setLoading(false)
  }

  async function handleFeedback(helpful: boolean) {
    if (feedbackSent || !article) return
    setFeedbackSent(true)
    try {
      await fetch(`/api/support/articles/${article.slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
    } catch {}
  }

  const title = language === 'bn' && article?.titleBn ? article.titleBn : article?.titleEn
  const content = language === 'bn' && article?.contentBn ? article.contentBn : article?.contentEn

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-sm md:text-base truncate max-w-xs md:max-w-none">
            {title || 'Policy Document'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(l => l === 'en' ? 'bn' : 'en')}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-red-50 text-xs font-semibold text-gray-700 rounded-full transition"
          >
            <Globe className="w-3.5 h-3.5 text-red-600" />
            {language === 'en' ? 'বাংলা' : 'English'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full pb-24 md:px-6 md:py-8 md:pb-10 lg:max-w-4xl">
        {loading ? (
          <div className="space-y-4 bg-white p-6 rounded-3xl border border-gray-100">
            <Skeleton className="h-8 w-2/3 rounded-xl" />
            <Skeleton className="h-4 w-1/3 rounded-md" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : !article ? (
          <div className="text-center py-20 bg-white rounded-3xl p-6 border border-gray-100 space-y-2">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Policy document not found</p>
            <button
              onClick={() => navigate('docs-browser')}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold"
            >
              Browse All Policies
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-md">
                {article.category}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mt-2">
                {title}
              </h1>
            </div>

            <DocMarkdownRenderer
              content={content || ''}
              title={title}
              lastUpdated={article.updatedAt ? new Date(article.updatedAt).toLocaleDateString() : undefined}
              views={article.views}
              language={language}
            />

            {/* Helpful widget */}
            <div className="border-t border-gray-100 pt-6 flex items-center justify-between text-xs text-gray-600">
              <span>{language === 'bn' ? 'এই নীতিটি কি স্পষ্ট ও সহায়ক?' : 'Was this policy clear and helpful?'}</span>
              {feedbackSent ? (
                <span className="text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Thank you!
                </span>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFeedback(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-green-50 hover:text-green-700 rounded-xl text-xs font-semibold transition"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Yes
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 rounded-xl text-xs font-semibold transition"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> No
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PolicyDetailPage
