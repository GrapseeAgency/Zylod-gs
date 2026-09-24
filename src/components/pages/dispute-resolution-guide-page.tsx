'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, Scale, Clock, ShieldCheck, FileCheck,
  CheckCircle2, AlertTriangle, ChevronRight, Video, Camera
} from 'lucide-react'

export function DisputeResolutionGuidePage() {
  const { navigate, goBack } = useNavigationStore()

  // HONESTY NOTE: Zylod has no escrow system and no automated dispute engine.
  // Disputes are reported by email/ticket and reviewed by the Zylod team; the
  // outcome is documented on the ticket. No invented SLAs or guarantees.
  const steps = [
    {
      time: 'Step 1: On Delivery',
      title: 'Inspect & Keep Evidence',
      desc: 'Count all units, test product operation, and record clear unboxing video/photos. Keep your order number handy — you will need it for every support contact.',
      icon: Clock,
    },
    {
      time: 'Step 2: Report the Issue',
      title: 'Contact Zylod Support',
      desc: 'Email support@zylod.com or open a support ticket with your order number, photos, and video. Every report is read by the Zylod team.',
      icon: Scale,
    },
    {
      time: 'Step 3: Team Review',
      title: 'Human Review of Your Case',
      desc: 'A Zylod team member reviews your evidence against the product listing and follows up with you and the supplier. There are no automated decisions.',
      icon: ShieldCheck,
    },
    {
      time: 'Step 4: Documented Outcome',
      title: 'Outcome Recorded in Writing',
      desc: 'The decision is documented on your ticket. Where a refund is approved, it is returned to your original payment method — timing depends on your bank or mobile-money provider.',
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="font-bold text-gray-900 text-base">Dispute & Arbitration Guide</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8 max-w-3xl mx-auto lg:max-w-4xl w-full pb-24 md:pb-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wide">
            <Scale className="w-4 h-4" />
            Order Dispute Help
          </div>
          <h1 className="text-lg md:text-2xl font-bold">How Zylod Handles Order Disputes</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Zylod has no escrow system and makes no automatic-protection guarantee. What we do promise: every dispute is reviewed by a real person on the Zylod team, and the outcome is documented on your ticket.
          </p>
        </div>

        {/* Timeline Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {steps.map((s, idx) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                    {s.time}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 pt-0.5">{s.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Required Evidence Checklist */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <FileCheck className="w-4 h-4 text-red-600" />
            Evidence That Helps Your Case
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Video className="w-3.5 h-3.5 text-red-600" />
                Unboxing Video
              </div>
              <p className="text-[11px] text-gray-500">Continuous video showing sealed shipping label and opening parcel.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <Camera className="w-3.5 h-3.5 text-red-600" />
                Defect Photographs
              </div>
              <p className="text-[11px] text-gray-500">Close-ups of broken parts, missing units, or incorrect color/specs.</p>
            </div>
          </div>
        </div>

        {/* CTA: Dispute + Report */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('submit-ticket', { category: 'seller_issue' })}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition"
          >
            Open a Support Ticket
          </button>
          <button
            onClick={() => navigate('report-user')}
            className="px-6 py-3 bg-white border border-red-200 hover:bg-red-50 text-red-700 font-bold rounded-xl text-xs shadow-sm transition"
          >
            Report Seller Misconduct →
          </button>
        </div>
      </div>
    </div>
  )
}

export default DisputeResolutionGuidePage
