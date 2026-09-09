'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  QrCode, Bell, Search, CheckCircle2, ThumbsUp,
  MessageCircle, HelpCircle, Store, UserCheck
} from 'lucide-react'

interface QAItem {
  id: string
  question: string
  askedBy: string
  timeAgo: string
  category: string
  answers: {
    id: string
    authorType: 'supplier' | 'buyer'
    authorLabel: string
    isExpertVerified?: boolean
    content: string
    helpfulCount: number
    timeAgo: string
  }[]
}

export function ProductQAPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate } = useNavigationStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'specs' | 'shipping' | 'bulk'>('all')
  const [helpfulMap, setHelpfulMap] = useState<Record<string, boolean>>({})

  const [qaList, setQaList] = useState<QAItem[]>([
    {
      id: 'qa-1',
      question: 'Can these industrial storage bins support heavy metal parts?',
      askedBy: 'IndustrialCorp',
      timeAgo: '2 days ago',
      category: 'specs',
      answers: [
        {
          id: 'ans-1-1',
          authorType: 'supplier',
          authorLabel: 'Answered by Supplier',
          isExpertVerified: true,
          content: 'Yes, these bins are manufactured from high-density polyethylene (HDPE) and have a reinforced ribbed base. They are rated to hold up to 150 lbs of metal parts without bowing or cracking.',
          helpfulCount: 12,
          timeAgo: '1 day ago',
        },
      ],
    },
    {
      id: 'qa-2',
      question: 'What is the Minimum Order Quantity (MOQ) for custom branding?',
      askedBy: 'RetailPlus',
      timeAgo: '5 days ago',
      category: 'bulk',
      answers: [
        {
          id: 'ans-2-1',
          authorType: 'buyer',
          authorLabel: 'Answered by Verified Buyer',
          content: 'I recently ordered these with custom logos. The supplier required an MOQ of 500 units for the screen printing service, and there was a small setup fee.',
          helpfulCount: 3,
          timeAgo: '3 days ago',
        },
        {
          id: 'ans-2-2',
          authorType: 'supplier',
          authorLabel: 'Answered by Supplier',
          content: 'The buyer above is correct. Standard MOQ for custom branding is 500 units. Please message us directly through the platform if you need to discuss specific logo requirements.',
          helpfulCount: 8,
          timeAgo: '2 days ago',
        },
      ],
    },
  ])

  const filteredList = useMemo(() => {
    return qaList.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchQ = item.question.toLowerCase().includes(q)
        const matchA = item.answers.some((a) => a.content.toLowerCase().includes(q))
        if (!matchQ && !matchA) return false
      }
      return true
    })
  }, [qaList, activeCategory, searchQuery])

  const toggleHelpful = (answerId: string) => {
    setHelpfulMap((prev) => ({ ...prev, [answerId]: !prev[answerId] }))
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700" title="QR">
            <QrCode className="h-6 w-6 text-primary" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700" title="Notifications">
            <Bell className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 space-y-4 md:px-6 md:py-6 md:max-w-4xl md:mx-auto md:w-full md:space-y-6">
        <h1 className="hidden md:block text-2xl font-black text-slate-900 tracking-tight">Customer Questions &amp; Answers</h1>
        {/* Title */}
        <div>
          <h1 className="text-lg md:hidden font-black text-slate-900 tracking-tight">
            Customer Questions & Answers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Find answers from the supplier and experienced buyers.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Have a question? Search for answers"
            className="pl-10 pr-16 h-11 bg-white border-slate-200 rounded-xl text-xs font-medium focus-visible:ring-primary shadow-xs"
          />
          <button className="absolute right-3 text-xs font-bold text-primary hover:underline">
            Search
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Q&A' },
            { key: 'specs', label: 'Product Specs' },
            { key: 'shipping', label: 'Shipping' },
            { key: 'bulk', label: 'Bulk Orders' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Q&A Cards */}
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs space-y-3.5"
            >
              {/* Question */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  Q
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">
                    {item.question}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Asked by {item.askedBy} - {item.timeAgo}
                  </p>
                </div>
              </div>

              {/* Answers */}
              <div className="space-y-3 pl-4 border-l-2 border-slate-100 ml-3">
                {item.answers.map((ans) => {
                  const hasHelpful = helpfulMap[ans.id]
                  const count = ans.helpfulCount + (hasHelpful ? 1 : 0)

                  return (
                    <div key={ans.id} className="space-y-2">
                      {/* Author Header */}
                      <div className="flex items-center gap-2">
                        {ans.authorType === 'supplier' ? (
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                            A
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800">
                            {ans.authorLabel}
                          </span>
                          {ans.isExpertVerified && (
                            <Badge className="bg-rose-50 text-primary border-none text-[8px] font-bold px-1.5 py-0.2 rounded">
                              Expert Verified
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-xs text-slate-600 leading-relaxed pl-8">
                        {ans.content}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center gap-4 pl-8 text-[10px] text-slate-400 font-medium">
                        <button
                          onClick={() => toggleHelpful(ans.id)}
                          className={`flex items-center gap-1 transition-colors ${
                            hasHelpful ? 'text-primary font-bold' : 'hover:text-slate-700'
                          }`}
                        >
                          <ThumbsUp className={`h-3 w-3 ${hasHelpful ? 'fill-primary' : ''}`} />
                          Helpful ({count})
                        </button>
                        <span>{ans.timeAgo}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold text-xs h-11 rounded-2xl shadow-xs"
          >
            Load More Questions
          </Button>
        </div>
      </main>
    </div>
  )
}
