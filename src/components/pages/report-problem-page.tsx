'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Bug, AlertTriangle, CheckCircle2, Laptop,
  Send, AlertCircle, Info, RefreshCw
} from 'lucide-react'

export function ReportProblemPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const [formData, setFormData] = useState({
    issueType: 'ui_bug',
    subject: '',
    description: '',
  })
  const [systemInfo, setSystemInfo] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSystemInfo({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer || 'direct',
      })
    }
  }, [])

  const issueTypes = [
    { value: 'ui_bug', label: 'UI / Display Error' },
    { value: 'payment_failure', label: 'Payment Gateway Error' },
    { value: 'cart_issue', label: 'Cart or MOQ Calculation Error' },
    { value: 'slow_loading', label: 'Slow Loading / Timeout' },
    { value: 'other', label: 'Other Technical Problem' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const res = await fetch('/api/support/report-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          systemInfo,
          pageContext: pageParams.fromPage || 'app',
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setSubmitted(true)
      } else {
        setErrorMsg(json.error || 'Failed to submit report')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Report a Technical Problem</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-24 md:px-6 md:py-8 md:pb-10">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900">Report a Technical Problem</h1>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          {submitted ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8 space-y-3"
            >
              <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Problem Report Logged</h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Thank you for helping us make Zylod more reliable. Our engineering team has received your diagnostic report and is working on a fix.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false)
                  setFormData({ issueType: 'ui_bug', subject: '', description: '' })
                }}
                className="mt-4 px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition"
              >
                Submit Another Report
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-red-600" />
                  What went wrong?
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Let us know what bug or glitch occurred on the platform.</p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Issue Type *</label>
                <select
                  value={formData.issueType}
                  onChange={e => setFormData({ ...formData, issueType: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:border-red-500"
                >
                  {issueTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Summary / Error Message *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Button disabled on bKash checkout step 2"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Steps to Reproduce *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="1. What were you trying to do?&#10;2. What happened instead?&#10;3. Any error codes displayed?"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 leading-relaxed font-mono"
                />
              </div>

              {/* Auto Diagnostics Box */}
              <div className="bg-slate-50 border border-gray-100 rounded-2xl p-3.5 space-y-2">
                <p className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-gray-500" />
                  Auto-Captured Diagnostics (Included automatically)
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-mono bg-white p-2 rounded-xl border border-gray-100">
                  <div>Platform: {systemInfo.platform || 'Linux'}</div>
                  <div>Screen: {systemInfo.screen || '1920x1080'}</div>
                  <div>Language: {systemInfo.language || 'en'}</div>
                  <div>Viewport: {systemInfo.viewport || '1200x800'}</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Bug Report
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportProblemPage
