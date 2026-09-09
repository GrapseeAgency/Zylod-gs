'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, MessageSquare, ThumbsUp, Star, Plus,
  CheckCircle2, Sparkles, Send, Filter, AlertCircle
} from 'lucide-react'

interface FeedbackItem {
  id: string
  type: string
  subject: string
  description: string
  rating?: number
  status: string
  createdAt: string
}

export function FeedbackSuggestionsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  const [formData, setFormData] = useState({
    type: 'feature_request',
    subject: '',
    description: '',
    rating: 5,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const types = [
    { value: 'all', label: 'All Ideas' },
    { value: 'feature_request', label: 'Feature Request' },
    { value: 'suggestion', label: 'Improvement' },
    { value: 'general_feedback', label: 'General Experience' },
  ]

  useEffect(() => {
    fetchFeedback()
  }, [typeFilter])

  async function fetchFeedback() {
    setLoading(true)
    try {
      const url = typeFilter === 'all' ? '/api/support/feedback' : `/api/support/feedback?type=${typeFilter}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setItems(json.data || [])
      }
    } catch {}
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/support/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setSubmitted(true)
        setTimeout(() => {
          setShowSubmitModal(false)
          setSubmitted(false)
          setFormData({ type: 'feature_request', subject: '', description: '', rating: 5 })
          fetchFeedback()
        }, 1200)
      }
    } catch {}
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition md:hidden">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Feedback & Suggestions</span>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Share Idea
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-5 md:space-y-8 max-w-3xl mx-auto w-full pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-3xl p-6 text-white shadow-md space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-200 uppercase tracking-wide">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            Shape the Future of Wholesale
          </div>
          <h1 className="text-lg md:text-2xl font-bold">Have an idea to improve Zylod?</h1>
          <p className="text-xs text-red-100 max-w-md">
            Suggest features, new payment options, logistics integrations, or report workflow bottlenecks.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {types.map(t => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                typeFilter === t.value
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Feedback List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:items-start">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl p-6 border border-gray-100 md:col-span-2">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800">No suggestions in this category yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Be the first to share an idea with our product team!</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                    {item.type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    {item.rating && (
                      <span className="flex items-center gap-0.5 text-yellow-500 font-semibold mr-2">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {item.rating}.0
                      </span>
                    )}
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-gray-900">{item.subject}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Share Feedback & Ideas</h2>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-6 space-y-2 text-green-600">
                <CheckCircle2 className="w-10 h-10 mx-auto" />
                <p className="text-sm font-bold">Feedback Submitted!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Feedback Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="feature_request">Feature Request</option>
                    <option value="suggestion">Workflow Improvement</option>
                    <option value="general_feedback">General Feedback</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Add instant bank invoice PDF export"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Details</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe how this feature will help your wholesale operations..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow transition disabled:opacity-40"
                >
                  {submitting ? 'Submitting...' : 'Post Feedback'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default FeedbackSuggestionsPage
