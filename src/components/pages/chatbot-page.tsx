'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Send, Sparkles, Bot, User, Globe,
  BookOpen, ExternalLink, ShieldCheck, ChevronRight
} from 'lucide-react'

interface BotMessage {
  id: string
  sender: 'user' | 'bot'
  text: string
  articleSlug?: string
  articleTitle?: string
  time: string
}

export function ChatbotPage() {
  const { navigate, goBack } = useNavigationStore()
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: "Hi! I search Zylod's help articles and FAQs. Ask me about orders, payments, MOQs, verification, or returns.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ])
  const [inputQuery, setInputQuery] = useState('')
  const [language, setLanguage] = useState<'en' | 'bn'>('en')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickPrompts = [
    { textEn: 'How do payments work on Zylod?', textBn: 'জাইলডে পেমেন্ট কীভাবে কাজ করে?' },
    { textEn: 'What is Minimum Order Quantity (MOQ)?', textBn: 'মিনিমাম অর্ডার কোয়ান্টিটি (MOQ) কী?' },
    { textEn: 'How to return defective or damaged goods?', textBn: 'নষ্ট বা ভুল পণ্য কীভাবে রিটার্ন করব?' },
    { textEn: 'What documents are required for Seller Verification?', textBn: 'সেলার ভেরিফিকেশনের জন্য কী কী লাগবে?' },
    { textEn: 'How are delivery charges calculated?', textBn: 'ডেলিভারি চার্জ কীভাবে নির্ধারিত হয়?' },
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(queryText?: string) {
    const textToSend = queryText || inputQuery
    if (!textToSend.trim() || loading) return

    const userMsg: BotMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, userMsg])
    setInputQuery('')
    setLoading(true)

    try {
      const res = await fetch('/api/support/chatbot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend.trim(), language }),
      })
      const json = await res.json()

      const botMsg: BotMessage = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: json.answer || 'I could not find that in our knowledge base. Please try rephrasing, or email support@zylod.com.',
        articleSlug: json.articleSlug,
        articleTitle: json.articleTitle,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      const errorMsg: BotMessage = {
        id: 'bot-err-' + Date.now(),
        sender: 'bot',
        text: 'Unable to reach the knowledge base. Please check your connection or email support@zylod.com.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, errorMsg])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 max-w-2xl lg:max-w-4xl mx-auto w-full border-x border-gray-200">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm md:text-base font-bold text-gray-900 flex items-center gap-1.5">
              Zylod Help Assistant
            </h1>
            <p className="text-[10px] text-gray-400 font-medium">Searches our published help articles & FAQs</p>
          </div>
        </div>

        <button
          onClick={() => setLanguage(l => l === 'en' ? 'bn' : 'en')}
          className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-red-50 text-xs font-semibold text-gray-700 rounded-full transition"
        >
          <Globe className="w-3.5 h-3.5 text-red-600" />
          {language === 'en' ? 'বাংলা' : 'English'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isUser = msg.sender === 'user'
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-red-600 text-white rounded-br-none'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-line">{msg.text}</p>

                {msg.articleSlug && (
                  <button
                    onClick={() => navigate('policy-detail', { slug: msg.articleSlug! })}
                    className="mt-3 w-full p-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl flex items-center justify-between text-[11px] font-semibold transition"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                      {msg.articleTitle || 'Read Full Policy Article'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 ml-1" />
                  </button>
                )}

                <p className={`text-[9px] mt-1.5 ${isUser ? 'text-red-200 text-right' : 'text-gray-400'}`}>
                  {msg.time}
                </p>
              </div>
            </motion.div>
          )
        })}

        {loading && (
          <div className="flex gap-2.5 items-center text-xs text-gray-500">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl shadow-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </span>
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="pt-2">
            <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              {language === 'bn' ? 'প্রস্তাবিত প্রশ্নাবলী' : 'Suggested Inquiries'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(language === 'bn' ? p.textBn : p.textEn)}
                  className="px-3 py-1.5 bg-white hover:bg-red-50 hover:text-red-600 border border-gray-200 rounded-full text-xs text-gray-700 transition text-left"
                >
                  {language === 'bn' ? p.textBn : p.textEn}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-3 md:px-6">
        <form onSubmit={e => { e.preventDefault(); handleSend() }} className="flex items-center gap-2">
          <input
            type="text"
            placeholder={language === 'bn' ? 'প্রশ্ন লিখুন...' : 'Ask about payments, MOQs, verification, disputes...'}
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-xs md:text-sm text-gray-900 outline-none focus:ring-1 focus:ring-red-500 placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatbotPage
