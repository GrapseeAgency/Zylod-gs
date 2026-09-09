'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import {
  ArrowLeft, CheckCircle2, Clock, ShieldCheck, AlertCircle,
  FileCheck2, Building2, UploadCloud, MessageSquare
} from 'lucide-react'

interface AuditStep {
  title: string
  desc: string
  date: string
  status: 'completed' | 'in_progress' | 'pending'
}

const TIMELINE_STEPS: AuditStep[] = [
  {
    title: 'Application & Trade Data Submitted',
    desc: 'Company registration number and banking profiles logged',
    date: 'Step 1 • Completed',
    status: 'completed'
  },
  {
    title: 'KYC Document Authentication',
    desc: 'Government NID & e-TIN database verification check',
    date: 'Step 2 • Completed',
    status: 'completed'
  },
  {
    title: 'Trade License & Physical Address Verification',
    desc: 'City Corporation business trade jurisdiction validation',
    date: 'Step 3 • In Progress',
    status: 'in_progress'
  },
  {
    title: 'Wholesale Factory Quality & Safety Clearance',
    desc: 'Final compliance review before full Gold Supplier badge issuance',
    date: 'Step 4 • Pending',
    status: 'pending'
  }
]

export function SellerVerificationStatusPage() {
  const { navigate } = useNavigationStore()

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('seller-verification')}
            className="p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              Compliance Review Timeline
            </h1>
            <p className="text-xs text-neutral-400">Real-time status of merchant vetting process</p>
          </div>
        </div>

        <Button
          onClick={() => navigate('seller-create-ticket')}
          variant="outline"
          size="sm"
          className="border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          <MessageSquare className="w-4 h-4 mr-1 text-[#C8102E]" />
          Contact Support
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 md:max-w-2xl md:px-6 md:py-6">
        {/* Status Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-100">Application Under Verification</h2>
              <p className="text-xs text-neutral-400">Estimated turnaround: 24 - 48 business hours</p>
            </div>
          </div>
        </div>

        {/* Timeline Stepper */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-6">
          <h3 className="font-bold text-xs text-neutral-400 uppercase tracking-wider">
            Verification Milestones
          </h3>

          <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-800">
            {TIMELINE_STEPS.map((step, idx) => (
              <div key={idx} className="relative">
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    step.status === 'completed'
                      ? 'bg-emerald-500 border-emerald-500 text-neutral-950'
                      : step.status === 'in_progress'
                      ? 'bg-neutral-950 border-sky-400 text-sky-400 animate-pulse'
                      : 'bg-neutral-950 border-neutral-700 text-neutral-600'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-neutral-200">{step.title}</h4>
                    <span className="text-[10px] text-neutral-500">{step.date}</span>
                  </div>
                  <p className="text-xs text-neutral-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Callout */}
        <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
          <div className="text-xs text-neutral-400">
            Need to update an uploaded document or add a missing certificate?
          </div>
          <Button
            size="sm"
            onClick={() => navigate('seller-verification-upload')}
            className="bg-[#C8102E] hover:bg-[#A00D24] text-white text-xs shrink-0"
          >
            Upload More
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SellerVerificationStatusPage
