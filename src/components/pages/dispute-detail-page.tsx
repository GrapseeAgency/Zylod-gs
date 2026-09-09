'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Scale, Paperclip, Send, CheckCircle2,
  FileText, Building2, User, AlertTriangle, ShieldCheck
} from 'lucide-react'

export function DisputeDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const caseId = pageParams.caseId || 'WD-84729'

  const [message, setMessage] = useState('')
  const [resolutionAccepted, setResolutionAccepted] = useState(false)

  const handleAccept = () => {
    setResolutionAccepted(true)
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setMessage('')
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Dispute Thread</h1>
              <p className="text-[10px] text-slate-400 font-mono">CASE #{caseId}</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-rose-50 text-primary flex items-center justify-center border border-rose-100">
            <Scale className="h-4 w-4" />
          </div>
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-5 md:space-y-6 max-w-lg mx-auto lg:max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 items-start">
        <div className="space-y-5 md:space-y-6 lg:col-span-2">
        <h2 className="text-base font-black text-slate-900">Case Record</h2>

        {/* Vertical Timeline Thread */}
        <div className="space-y-4 pl-2 relative before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {/* Entry 1: Dispute Initiated */}
          <div className="relative flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs shrink-0 z-10">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
              <h3 className="text-xs font-bold text-slate-900">Dispute Initiated by Buyer (You)</h3>
              <p className="text-[10px] text-slate-400 font-mono">OCT 12, 2023 • 09:41 AM EST</p>
              <p className="text-xs text-slate-600 pt-1 leading-relaxed">
                Reason: <strong>Items significantly not as described / Damaged in transit</strong>.<br />
                Requested: Full Refund ($900.00).
              </p>
            </div>
          </div>

          {/* Entry 2: Your Message & Evidence */}
          <div className="relative flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shrink-0 z-10">
              ME
            </div>
            <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
              <h3 className="text-xs font-bold text-slate-900">Your Message &amp; Evidence</h3>
              <p className="text-[10px] text-slate-400 font-mono">OCT 12, 2023 • 09:45 AM EST</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Attached are photos of the shipment as it arrived. The outer master carton was crushed on the bottom left corner, resulting in structural damage to 15 individual retail units inside. Unsellable condition.
              </p>

              {/* Photos */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80"
                    alt="Damaged box"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1586528116493-a029325540fa?w=400&auto=format&fit=crop&q=80"
                    alt="Damaged items"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Entry 3: Supplier Response */}
          <div className="relative flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs shrink-0 z-10">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-900">GlobalTech Suppliers Inc.</h3>
                <CheckCircle2 className="h-3 w-3 text-primary" />
              </div>
              <p className="text-[10px] text-slate-400 font-mono">OCT 13, 2023 • 11:20 AM EST</p>
              <p className="text-xs text-slate-600 pt-1 leading-relaxed">
                We apologize for the inconvenience. Our warehouse records show the master carton left our facility in perfect condition. This appears to be mishandling by the freight forwarder. However, to maintain a good relationship, we are willing to offer a partial refund for the 15 damaged units.
              </p>
            </div>
          </div>

          {/* Entry 4: Mediation Center */}
          <div className="relative flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs shrink-0 z-10 shadow-md shadow-primary/25">
              <Scale className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs space-y-2 border-l-4 border-l-primary">
              <h3 className="text-xs font-bold text-slate-900">Zylod Resolution Center</h3>
              <p className="text-[10px] text-slate-400 font-mono">OCT 14, 2023 • 02:15 PM EST</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Thank you both for providing details. Based on the Zylod Buyer Protection Policy, since the shipping terms were DAP (Delivered at Place), the supplier bears responsibility for transit damage until received.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                We have reviewed the evidence and the supplier&apos;s acknowledgment of 15 damaged units. We propose a formal resolution below based on the prorated value of the damaged goods.
              </p>

              {/* PDF Policy Attachment */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-xs font-semibold text-slate-700">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Zylod_Policy_Section4.pdf</span>
              </div>
            </div>
          </div>
        </div>

        </div>

        <div className="space-y-5 md:space-y-6">
        {/* Proposed Resolution Card */}
        <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black text-slate-900">Proposed Resolution</h3>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Resolution Type</span>
              <p className="text-xs font-bold text-slate-900 mt-0.5">Partial Refund</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Amount to Refund</span>
              <p className="text-base font-black text-primary mt-0.5">$225.00</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            By accepting this resolution, the supplier will refund $225.00 to your original payment method. You retain all shipped goods. The dispute will be closed permanently.
          </p>

          {resolutionAccepted ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Resolution Accepted! Refund is processing.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={handleAccept}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept Resolution
              </Button>
              <Button
                variant="outline"
                onClick={() => {}}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
              >
                Reject &amp; Escalate
              </Button>
            </div>
          )}
        </div>

        {/* Order Details Mini Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Order Details</h3>
          <div className="text-xs space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span>Order ID</span>
              <span className="font-bold text-slate-900 font-mono">#ORD-8920-11A</span>
            </div>
            <div className="flex justify-between">
              <span>Total Value</span>
              <span className="font-bold text-slate-900">$900.00</span>
            </div>
            <div className="flex justify-between">
              <span>Supplier</span>
              <span className="font-bold text-slate-900">GlobalTech Suppliers</span>
            </div>
          </div>
        </div>
        </div>
        </div>
      </main>

      {/* Sticky Bottom Response Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-3 shadow-xl z-30">
        <form onSubmit={handleSendMessage} className="max-w-lg mx-auto lg:max-w-3xl space-y-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your response to the thread..."
            className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
          />
          <div className="flex items-center justify-between">
            <button type="button" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium">
              <Paperclip className="h-3.5 w-3.5" />
              Add Evidence
            </button>
            <Button type="submit" className="h-8 px-4 text-xs font-bold bg-slate-200 hover:bg-primary text-slate-800 hover:text-white rounded-xl">
              Send Message
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DisputeDetailPage
