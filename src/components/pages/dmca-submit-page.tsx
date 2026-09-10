'use client'

import React, { useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react'

export function DmcaSubmitPage() {
  const { navigate, goBack } = useNavigationStore()
  const [formData, setFormData] = useState({
    complainantName: '',
    complainantEmail: '',
    complainantPhone: '',
    copyrightOwner: '',
    infringingUrl: '',
    originalWorkUrl: '',
    copyrightWorkDesc: '',
    declarationSigned: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketRef, setTicketRef] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.declarationSigned) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/legal/dmca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        setTicketRef(data.data.ticketRef)
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
          <h1 className="font-bold text-gray-900 text-base">File DMCA Takedown Notice</h1>
          <p className="text-xs text-gray-400">Formal Copyright & Trademark Infringement Report</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 lg:max-w-4xl pb-24 md:pb-8">
        <div className="hidden md:block">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">File DMCA Takedown Notice</h1>
          <p className="text-sm text-gray-400 mt-1">Formal Copyright &amp; Trademark Infringement Report</p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-base font-bold text-gray-900">DMCA Notice Received</h2>
            <p className="text-xs text-gray-600">
              Your official report reference is <strong>{ticketRef}</strong>. Our Legal & Compliance Desk will examine the claim and take necessary enforcement action within 72 hours.
            </p>
            <Button onClick={() => navigate('dmca-policy')} className="bg-slate-900 text-white rounded-xl text-xs font-bold">
              Back to DMCA Policy
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3.5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Claimant Information</h3>
              <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-2.5">
                <div>
                  <label className="text-xs font-bold text-gray-700">Full Legal Name *</label>
                  <Input
                    required
                    value={formData.complainantName}
                    onChange={e => setFormData({ ...formData, complainantName: e.target.value })}
                    placeholder="e.g. John Doe / Legal Representative"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Corporate Email Address *</label>
                  <Input
                    required
                    type="email"
                    value={formData.complainantEmail}
                    onChange={e => setFormData({ ...formData, complainantEmail: e.target.value })}
                    placeholder="e.g. legal@brand.com"
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Copyright / Brand Owner Name *</label>
                  <Input
                    required
                    value={formData.copyrightOwner}
                    onChange={e => setFormData({ ...formData, copyrightOwner: e.target.value })}
                    placeholder="e.g. Acme Apparel Industries Ltd."
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3.5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Infringement Details</h3>
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs font-bold text-gray-700">Infringing Listing URL on Zylod *</label>
                  <Input
                    required
                    value={formData.infringingUrl}
                    onChange={e => setFormData({ ...formData, infringingUrl: e.target.value })}
                    placeholder="https://zylod.com/product/..."
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">Description of Original Work & Infringement *</label>
                  <textarea
                    required
                    rows={3}
                    value={formData.copyrightWorkDesc}
                    onChange={e => setFormData({ ...formData, copyrightWorkDesc: e.target.value })}
                    placeholder="Describe how the listing violates your intellectual property rights..."
                    className="w-full mt-1 p-3 bg-slate-50 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  required
                  id="dmca-signed"
                  checked={formData.declarationSigned}
                  onChange={e => setFormData({ ...formData, declarationSigned: e.target.checked })}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="dmca-signed" className="text-[11px] text-gray-600 leading-relaxed cursor-pointer">
                  I state under penalty of perjury that I am authorized to act on behalf of the copyright owner and that the information in this notice is accurate.
                </label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || !formData.declarationSigned}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold py-3"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting Notice...' : 'Submit DMCA Takedown Notice'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

export default DmcaSubmitPage
