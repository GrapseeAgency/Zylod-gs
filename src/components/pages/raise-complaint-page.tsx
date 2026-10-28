'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { usePublicSettings } from '@/lib/use-public-settings'
import {
  ArrowLeft, ShieldCheck,
  CheckCircle2, AlertCircle
} from 'lucide-react'
import { AccountGate } from '@/components/shared/account-gate'

// HONESTY NOTE: this form previously faked success with setTimeout, an invented
// case id (#DSP-2023-9012), a fake supplier name, and a "funds frozen in Zylod
// Escrow" claim. It now POSTs to the real /api/support/report-problem endpoint
// (persists to feedbackSubmissions) and shows only the real saved reference.
export function RaiseComplaintPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || pageParams.id || ''

  const [complaintType, setComplaintType] = useState('damaged')
  const [desiredOutcome, setDesiredOutcome] = useState('refund')
  const [refundAmount, setRefundAmount] = useState('')
  const [statement, setStatement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  // Owner-published support contact (Admin → System Settings) — error and
  // evidence copy point to the Help Center when nothing is published, never
  // an invented email.
  const { settings } = usePublicSettings()
  const supportEmail = settings['support.email'] ?? ''
  // Honesty fix: complaints are saved against the signed-in account — a 401
  // shows a sign-in gate, never a fake "complaint saved".
  const [sessionExpired, setSessionExpired] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/support/report-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType: complaintType,
          subject: `Order complaint (${desiredOutcome})${orderId ? ` — order ${orderId}` : ''}`,
          description: statement.trim(),
          pageContext: 'raise-complaint',
        }),
      })
      const json = await res.json()
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (res.ok && json.data) {
        setReference(json.data.id || '')
        setSubmitted(true)
      } else {
        setErrorMsg(json.error || (supportEmail
          ? `Failed to submit complaint. Please try again or email ${supportEmail}.`
          : 'Failed to submit complaint. Please try again or reach us through the Help Center.'))
      }
    } catch {
      setErrorMsg(supportEmail
        ? `Network error. Please try again or email ${supportEmail}.`
        : 'Network error. Please try again or reach us through the Help Center.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionExpired) {
    return (
      <AccountGate
        title="Sign in to raise a complaint"
        message="Complaints are saved to your account so the Zylod team can follow up. Sign in to continue."
      />
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <div className="w-16 h-16 bg-rose-50 text-primary rounded-full flex items-center justify-center mb-4 border border-rose-100 shadow-md">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Complaint Saved</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs leading-relaxed">
          {reference ? `Reference: ${reference}. ` : ''}
          Your complaint has been saved to our inbox for review by the Zylod team — we reply by email when action is needed. Zylod does not hold funds in escrow; approved refunds go back to your original payment method.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('help-center')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            Back to Help Center
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Raise Complaint</h1>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto md:max-w-2xl md:px-6 md:py-8 md:space-y-6">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Raise Complaint</h1>
        {/* Order Target Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 block">
            Associated Order
          </span>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{orderId ? `#${orderId}` : 'No specific order attached'}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Complaint Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Complaint Category */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Complaint Type *
            </label>
            <select
              value={complaintType}
              onChange={(e) => setComplaintType(e.target.value)}
              className="w-full h-11 rounded-2xl bg-slate-50 dark:bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="damaged">Damaged or Broken Items on Arrival</option>
              <option value="missing">Missing Quantity / Incomplete Shipment</option>
              <option value="specs">Product Specifications Differ from Sample</option>
              <option value="delay">Severe Logistics Delay</option>
              <option value="quality">Substandard Materials / Batch Defect</option>
            </select>
          </div>

          {/* Desired Resolution */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Requested Resolution *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'refund', label: 'Full Refund' },
                { id: 'partial', label: 'Partial Refund' },
                { id: 'replace', label: 'Replacement' },
              ].map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setDesiredOutcome(res.id)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    desiredOutcome === res.id
                      ? 'bg-rose-50 text-primary border-primary'
                      : 'bg-slate-50 dark:bg-background text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>

            {(desiredOutcome === 'refund' || desiredOutcome === 'partial') && (
              <div className="space-y-1 pt-2">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Claim Amount (৳)</label>
                <Input
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="e.g. 12500"
                  className="h-10 rounded-xl bg-slate-50 dark:bg-background border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
                />
              </div>
            )}
          </div>

          {/* Statement & Details */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Detailed Statement &amp; Evidence *
            </label>
            <Textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder={supportEmail
                ? `Explain what went wrong, and email photos/video to ${supportEmail} with your reference afterwards...`
                : 'Explain what went wrong. Afterwards, share photos/video with the Zylod team through the Help Center using your reference...'}
              rows={4}
              className="rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-slate-800 text-xs font-medium resize-none"
              required
            />

            <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
              {supportEmail
                ? `Photo or video evidence cannot be uploaded here yet — include it in your follow-up email to ${supportEmail}.`
                : 'Photo or video evidence cannot be uploaded here yet — share it with the Zylod team through the Help Center afterwards.'}
            </p>
          </div>

          {/* Honest Protection Info */}
          <div className="p-4 bg-slate-100 dark:bg-card/70 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex gap-3 items-start text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Zylod does not hold payments in escrow. Your complaint is reviewed by the Zylod team and the outcome is documented — nothing is decided automatically.
            </p>
          </div>

          {/* Submit CTA */}
          <Button
            type="submit"
            disabled={submitting || !statement.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
          >
            {submitting ? 'Submitting...' : 'Submit Complaint'}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default RaiseComplaintPage
