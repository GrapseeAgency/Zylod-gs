'use client'

import React, { useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, CheckCircle2, Mail, Building2 } from 'lucide-react'

export function InvestorContactPage() {
  const { navigate, goBack } = useNavigationStore()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    inquiryType: 'general',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [refNo, setRefNo] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/investor/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        setRefNo(data.data.ref)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm md:hidden">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-base">Investor Relations Contact Desk</h1>
          <p className="text-xs text-gray-400">Institutional Inquiries & Financial Disclosures</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8 lg:max-w-4xl">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-6">Investor Relations Contact Desk</h1>
        <div className="space-y-4 md:space-y-6">
        {submitted ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-gray-900">Inquiry Received</h2>
            <p className="text-xs text-gray-600">
              Your inquiry reference is <strong>{refNo}</strong>. Our Head of Investor Relations will respond within 2 business days.
            </p>
            <Button onClick={() => navigate('investor-relations')} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold">
              Back to Investor Portal
            </Button>
          </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Institutional Representative</h3>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Full Name *</label>
                  <Input
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Corporate Email *</label>
                  <Input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. s.jenkins@vcfund.com"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Fund / Organization Name</label>
                  <Input
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. Apex Venture Partners"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Nature of Inquiry *</label>
                  <select
                    value={formData.inquiryType}
                    onChange={e => setFormData({ ...formData, inquiryType: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="general">General Investor Information</option>
                    <option value="annual_report">Audited Financial Queries</option>
                    <option value="financial_data">Unit Economics & GMV Telemetry</option>
                    <option value="media_request">Financial Media Request</option>
                    <option value="analyst_coverage">Equity Research & Coverage</option>
                    <option value="esg">ESG & Sustainability Inquiries</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-700">Message / Inquiry *</label>
                  <textarea
                    required
                    rows={3}
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Please specify your request or scheduled meeting requirements..."
                    className="w-full mt-1 p-3 bg-slate-50 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold py-3.5 shadow-lg shadow-emerald-700/20"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Sending Inquiry...' : 'Submit Investor Inquiry'}
            </Button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}

export default InvestorContactPage
