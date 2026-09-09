'use client'

import React, { useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, CheckCircle2, Briefcase, Paperclip } from 'lucide-react'

export function JobApplyPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const jobId = pageParams?.jobId || 'cm0job001'
  const jobTitle = pageParams?.jobTitle || 'Position Application'

  const [formData, setFormData] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    resumeUrl: '',
    linkedInUrl: '',
    portfolioUrl: '',
    yearsExp: '3',
    coverLetter: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [appRef, setAppRef] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, ...formData }),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        setAppRef(data.data.applicationRef)
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
          <h1 className="font-bold text-gray-900 text-base">Apply for Position</h1>
          <p className="text-xs text-gray-400">{jobTitle}</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8 lg:max-w-4xl">
        <h1 className="hidden md:block text-2xl font-bold text-gray-900 mb-1">Apply for Position</h1>
        <p className="hidden md:block text-sm text-gray-500 mb-6">{jobTitle}</p>
        <div className="space-y-4 md:space-y-6">
        {submitted ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto" />
            <h2 className="text-base font-bold text-gray-900">Application Submitted!</h2>
            <p className="text-xs text-gray-600">
              Thank you for applying. Your application tracking code is <strong>{appRef}</strong>. Our Talent Acquisition team will contact you within 5 business days.
            </p>
            <Button onClick={() => navigate('careers-page')} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold">
              View Other Openings
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Details</h3>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Full Name *</label>
                  <Input
                    required
                    value={formData.applicantName}
                    onChange={e => setFormData({ ...formData, applicantName: e.target.value })}
                    placeholder="e.g. Asif Rahman"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Email Address *</label>
                  <Input
                    required
                    type="email"
                    value={formData.applicantEmail}
                    onChange={e => setFormData({ ...formData, applicantEmail: e.target.value })}
                    placeholder="e.g. asif@example.com"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Phone Number *</label>
                  <Input
                    required
                    value={formData.applicantPhone}
                    onChange={e => setFormData({ ...formData, applicantPhone: e.target.value })}
                    placeholder="e.g. +880 1711 000000"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Links & Experience</h3>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">Resume / CV Link (Google Drive / Dropbox) *</label>
                  <Input
                    required
                    value={formData.resumeUrl}
                    onChange={e => setFormData({ ...formData, resumeUrl: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">LinkedIn Profile URL</label>
                  <Input
                    value={formData.linkedInUrl}
                    onChange={e => setFormData({ ...formData, linkedInUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Years of Relevant Experience</label>
                  <Input
                    type="number"
                    value={formData.yearsExp}
                    onChange={e => setFormData({ ...formData, yearsExp: e.target.value })}
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-700">Cover Letter / Note to Hiring Manager</label>
                  <textarea
                    rows={3}
                    value={formData.coverLetter}
                    onChange={e => setFormData({ ...formData, coverLetter: e.target.value })}
                    placeholder="Why are you excited to join Zylod?"
                    className="w-full mt-1 p-3 bg-slate-50 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold py-3.5 shadow-lg shadow-teal-600/20"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </Button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}

export default JobApplyPage
