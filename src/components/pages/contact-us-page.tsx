'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Phone, Mail, MapPin, Clock, Send,
  MessageCircle, CheckCircle2, AlertCircle, Building2, ShieldCheck
} from 'lucide-react'

export function ContactUsPage() {
  const { navigate, goBack } = useNavigationStore()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    category: 'general',
    subject: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const categories = [
    { value: 'order_issue', label: 'Order & Consignment Issue' },
    { value: 'payment_issue', label: 'Payments & Verification' },
    { value: 'seller_issue', label: 'Supplier Onboarding / Verification' },
    { value: 'product_issue', label: 'Product Specifications / RFQ' },
    { value: 'general', label: 'General Commercial Inquiry' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (res.ok) {
        setSubmitted(true)
      } else {
        setErrorMsg(json.error || 'Failed to submit inquiry')
      }
    } catch {
      setErrorMsg('Network error. Please check connection and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Contact Zylod Support</span>
        </div>
        <button
          onClick={() => navigate('live-chat')}
          className="text-xs font-semibold text-red-600 flex items-center gap-1 hover:underline"
        >
          <MessageCircle className="w-4 h-4" /> Live Chat
        </button>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8 max-w-2xl lg:max-w-4xl mx-auto w-full pb-24 md:pb-8">
        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <Phone className="w-5 h-5 text-red-600 mb-2" />
            <p className="text-xs font-semibold text-gray-900">Support Hotline</p>
            <p className="text-xs font-bold text-red-600">+880 9612-345678</p>
            <p className="text-[11px] text-gray-400">9:00 AM – 10:00 PM Daily</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <Mail className="w-5 h-5 text-red-600 mb-2" />
            <p className="text-xs font-semibold text-gray-900">Email Support</p>
            <p className="text-xs font-bold text-gray-800">support@zylod.com.bd</p>
            <p className="text-[11px] text-gray-400">24-hour response SLA</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <MapPin className="w-5 h-5 text-red-600 mb-2" />
            <p className="text-xs font-semibold text-gray-900">Dhaka Headquarters</p>
            <p className="text-xs text-gray-700">Gulshan-2, Dhaka 1212</p>
            <p className="text-[11px] text-gray-400">Bangladesh</p>
          </div>
        </div>

        {/* Contact Form */}
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
              <h2 className="text-lg font-bold text-gray-900">Inquiry Received</h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Thank you for contacting Zylod Wholesale. A support representative will review your message and reach out via phone or email within 24 hours.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false)
                  setFormData({ name: '', email: '', phone: '', category: 'general', subject: '', message: '' })
                }}
                className="mt-4 px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition"
              >
                Send Another Message
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-sm font-bold text-gray-900">Send an Inquiry</h2>
                <p className="text-xs text-gray-400">Fill out this form and our merchant support team will respond promptly.</p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tanvir Ahmed"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. tanvir@business.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 01712345678"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Inquiry Category *</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs bg-white focus:outline-none focus:border-red-500"
                  >
                    {categories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="Brief summary of your inquiry"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Message Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide all relevant wholesale details, order numbers, or supplier questions..."
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Inquiry
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

export default ContactUsPage
