'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import { DocMarkdownRenderer } from '@/components/ui/doc-markdown-renderer'
import {
  ArrowLeft, Search, BookOpen, Globe, ThumbsUp, ThumbsDown,
  ChevronRight, ChevronDown, CheckCircle2, ShieldCheck, FileText,
  HelpCircle, ExternalLink, Menu, X
} from 'lucide-react'

interface ArticleItem {
  id: string
  category: string
  slug: string
  titleEn: string
  titleBn?: string
  contentEn?: string
  contentBn?: string
  views: number
  updatedAt?: string
}

interface TableOfContentCategory {
  category: string
  articles: {
    id: string
    slug: string
    titleEn: string
    titleBn?: string
    views: number
  }[]
}

export function DocsBrowserPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const initialSlug = pageParams.slug || 'how-it-works'
  const [activeSlug, setActiveSlug] = useState(initialSlug)
  const [language, setLanguage] = useState<'en' | 'bn'>('en')
  const [searchQuery, setSearchQuery] = useState('')
  const [toc, setToc] = useState<TableOfContentCategory[]>([])
  const [activeArticle, setActiveArticle] = useState<ArticleItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [articleLoading, setArticleLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)

  useEffect(() => {
    fetchTableOfContents()
  }, [])

  useEffect(() => {
    if (activeSlug) {
      fetchArticle(activeSlug)
    }
  }, [activeSlug])

  async function fetchTableOfContents() {
    setLoading(true)
    try {
      const res = await fetch('/api/support/policies')
      if (res.ok) {
        const json = await res.json()
        setToc(json.data?.tableOfContents || [])
      }
    } catch {}
    setLoading(false)
  }

  async function fetchArticle(slug: string) {
    setArticleLoading(true)
    setFeedbackSent(false)
    try {
      const res = await fetch(`/api/support/articles/${slug}`)
      if (res.ok) {
        const json = await res.json()
        setActiveArticle(json.data)
      }
    } catch {}
    setArticleLoading(false)
  }

  async function handleFeedback(helpful: boolean) {
    if (feedbackSent || !activeArticle) return
    setFeedbackSent(true)
    try {
      await fetch(`/api/support/articles/${activeArticle.slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
    } catch {}
  }

  function handleSelectArticle(slug: string) {
    setActiveSlug(slug)
    setMobileMenuOpen(false)
  }

  const title = language === 'bn' && activeArticle?.titleBn ? activeArticle.titleBn : activeArticle?.titleEn
  const content = language === 'bn' && activeArticle?.contentBn ? activeArticle.contentBn : activeArticle?.contentEn

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg border border-gray-200 text-gray-700"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-white">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-gray-900 text-sm hidden sm:inline">
              Zylod Wholesale Documentation
            </span>
          </div>
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
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Amazon / Stripe Style Docs Navigation) */}
        <aside
          className={`fixed inset-y-0 left-0 top-[57px] z-20 w-72 bg-slate-50 border-r border-gray-200 flex flex-col transition-transform duration-200 md:static md:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Search within docs */}
          <div className="p-3 border-b border-gray-200 bg-white">
            <div className="relative">
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-red-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Navigation Tree */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {loading ? (
              <div className="space-y-3 p-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : (
              toc.map(section => {
                const filteredArticles = section.articles.filter(a => {
                  if (!searchQuery.trim()) return true
                  const q = searchQuery.toLowerCase()
                  return a.titleEn.toLowerCase().includes(q) || (a.titleBn && a.titleBn.includes(q))
                })

                if (filteredArticles.length === 0) return null

                return (
                  <div key={section.category} className="space-y-1">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2.5">
                      {section.category}
                    </p>
                    <div className="space-y-0.5">
                      {filteredArticles.map(art => {
                        const isSelected = activeSlug === art.slug
                        const articleTitle = language === 'bn' && art.titleBn ? art.titleBn : art.titleEn
                        return (
                          <button
                            key={art.slug}
                            onClick={() => handleSelectArticle(art.slug)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition text-left ${
                              isSelected
                                ? 'bg-red-600 text-white font-semibold shadow-sm'
                                : 'text-gray-700 hover:bg-gray-200/60'
                            }`}
                          >
                            <span className="truncate pr-1">{articleTitle}</span>
                            {isSelected && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Sidebar Footer Link */}
          <div className="p-3 border-t border-gray-200 bg-white text-center">
            <button
              onClick={() => navigate('chatbot')}
              className="w-full py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-xs font-semibold transition"
            >
              Ask AI Policy Assistant
            </button>
          </div>
        </aside>

        {/* Main Document Content Area */}
        <main className="flex-1 overflow-y-auto bg-white p-6 sm:p-10 max-w-4xl mx-auto w-full">
          {articleLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-2/3 rounded-xl" />
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : !activeArticle ? (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-800">Select an article from the left sidebar</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 border-b border-gray-100 pb-3">
                <span className="hover:text-red-600 cursor-pointer" onClick={() => navigate('help-center')}>Docs</span>
                <ChevronRight className="w-3 h-3" />
                <span>{activeArticle.category}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-gray-900 font-semibold truncate">{title}</span>
              </div>

              {/* High-Performance Stripe/Amazon Doc Renderer */}
              <DocMarkdownRenderer
                content={content || ''}
                title={title}
                lastUpdated={activeArticle.updatedAt ? new Date(activeArticle.updatedAt).toLocaleDateString() : undefined}
                views={activeArticle.views}
                language={language}
              />

              {/* App Cross-Navigation Callout Card */}
              <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 not-prose mt-8">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Need specific order assistance?</p>
                    <p className="text-[11px] text-gray-500">You can open a formal dispute ticket or connect with human support.</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate('submit-ticket')}
                    className="px-3.5 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition"
                  >
                    Open Ticket
                  </button>
                  <button
                    onClick={() => navigate('live-chat')}
                    className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition"
                  >
                    Live Chat
                  </button>
                </div>
              </div>

              {/* Was this article helpful widget */}
              <div className="border-t border-gray-100 pt-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 not-prose">
                <p className="text-xs font-semibold text-gray-600">
                  {language === 'bn' ? 'এই ডকুমেন্টটি কি সহায়ক ছিল?' : 'Was this documentation helpful?'}
                </p>
                {feedbackSent ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Thank you for your feedback!
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFeedback(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-green-50 hover:text-green-700 rounded-xl text-xs font-semibold transition"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Yes
                    </button>
                    <button
                      onClick={() => handleFeedback(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 rounded-xl text-xs font-semibold transition"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> No
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default DocsBrowserPage
