'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Award, ShieldCheck, CheckCircle2,
  Clock, FileText, Upload, Check, Loader2,
  Building2, Factory, Shield, Sparkles, ChevronRight
} from 'lucide-react'

interface Milestone {
  label: string
  completed: boolean
  required: boolean
  description: string
}

export function AccountVerificationBadgePage() {
  const { goBack, navigate } = useNavigationStore()
  const { user, token } = useAuthStore()

  const [verificationData, setVerificationData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const milestones: Milestone[] = [
    {
      label: 'Trade License & Commercial Registration',
      completed: true,
      required: true,
      description: 'Verified with Bangladesh Registrar of Joint Stock Companies.',
    },
    {
      label: 'National Identity / Passport KYC',
      completed: true,
      required: true,
      description: 'Authorized signatory identity confirmed.',
    },
    {
      label: 'Tax Identification Number (TIN / BIN)',
      completed: true,
      required: true,
      description: 'National Board of Revenue (NBR) active e-TIN.',
    },
    {
      label: 'Bank Account Solvency Certificate',
      completed: false,
      required: true,
      description: 'Official letter from authorized commercial bank in Bangladesh.',
    },
    {
      label: 'Physical Factory & Warehouse Audit',
      completed: false,
      required: false,
      description: 'On-site facility verification by Zylod Quality Field Officers.',
    },
  ]

  useEffect(() => {
    async function loadVerification() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/profile/verification', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setVerificationData(json.data)
        }
      } catch {
        // Graceful
      } finally {
        setLoading(false)
      }
    }
    loadVerification()
  }, [token])

  const levelName = verificationData?.levelName || 'Verified Merchant Partner'
  const isVerified = verificationData?.status === 'active_verified' || user?.userType === 'supplier'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Trust &amp; Verification</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-3xl">
        {/* Verification Badge Showcase */}
        <div className="bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 rounded-3xl p-6 text-white text-center shadow-xl space-y-3 relative overflow-hidden">
          <div className="w-16 h-16 rounded-3xl bg-white/10 border-2 border-white/20 mx-auto flex items-center justify-center shadow-inner">
            <Award className="h-8 w-8 text-rose-300" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">
              {levelName}
            </span>
            <h1 className="text-xl md:text-2xl font-black text-white mt-2">Verified B2B Credential</h1>
            <p className="text-xs text-slate-300 max-w-xs mx-auto mt-1 leading-relaxed">
              Displayed across all wholesale catalog listings to verify authentic manufacturing capability.
            </p>
          </div>
        </div>

        {/* Benefits of Verification */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Verified Partner Privileges
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {[
              { title: 'Trust Badge on Catalog Listings', desc: 'Increases quotation conversions by up to 300%' },
              { title: 'Payment Verification Trust', desc: 'Buyers see your real verification status on every listing' },
              { title: 'Priority Search Placement', desc: 'Featured top ranking in buyer category searches' },
              { title: 'Direct RFQ Inquiries', desc: 'Receive high-value enterprise tender requests' },
            ].map(({ title, desc }) => (
              <div key={title} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">{title}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestone Verification Checkpoints */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">KYC &amp; Verification Milestones</span>
          </div>

          <div className="divide-y divide-slate-50">
            {milestones.map((m) => (
              <div key={m.label} className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    m.completed ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {m.completed ? <Check className="h-4 w-4 stroke-[3]" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900">{m.label}</h3>
                      {m.required && (
                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{m.description}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                  m.completed
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                    : 'text-amber-700 bg-amber-50 border border-amber-100'
                }`}>
                  {m.completed ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upload Action CTA */}
        <Button
          onClick={() => navigate('edit-profile')}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Update Verification Documents
        </Button>
      </main>
    </div>
  )
}

export default AccountVerificationBadgePage
