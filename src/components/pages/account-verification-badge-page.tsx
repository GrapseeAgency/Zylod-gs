'use client'

/**
 * Trust & Verification — derived from the REAL verification API (t187-d).
 *
 * GET /api/profile/verification returns: level, levelName
 * ('Verified Partner' | 'Standard Merchant'), status ('active_verified' |
 * 'pending'), description, benefits, nextLevel. Milestone states are derived
 * from those fields ONLY — the API exposes no per-document statuses, so every
 * milestone it can't speak for renders an honest "Not started" / "Pending"
 * default, never a fabricated completed:true. No invented level-name
 * fallback and no invented conversion statistics.
 */
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/page-loader'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'
import {
  ArrowLeft, Award, ShieldCheck, CheckCircle2,
  Clock, Upload, Check,
} from 'lucide-react'

interface Milestone {
  label: string
  // 'verified'  — the API confirms completion
  // 'pending'   — the API points at this as the active next step
  // 'not-started' — the API provides no state; we do NOT claim progress
  state: 'verified' | 'pending' | 'not-started'
  required: boolean
  description: string
}

interface VerificationData {
  level: number
  levelName: string
  status: string
  description: string
}

export function AccountVerificationBadgePage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()

  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadVerification() {
      if (!token) {
        if (mounted) setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/profile/verification', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!mounted) return
        if (res.ok) {
          const json = await res.json()
          if (json?.data) {
            setVerificationData(json.data)
          } else {
            setFetchFailed(true)
          }
        } else {
          setFetchFailed(true)
          toast.error('Could not load your verification status. Showing an honest placeholder instead.')
        }
      } catch {
        if (mounted) {
          setFetchFailed(true)
          toast.error('Could not load your verification status. Showing an honest placeholder instead.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadVerification()
    return () => { mounted = false }
  }, [token])

  // Real tier name from the API — no invented fallback. When we have no data
  // at all, the badge area says so honestly.
  const levelName = verificationData?.levelName
  const isVerified = verificationData?.status === 'active_verified'

  // Milestones derived from the real response. The verification endpoint
  // speaks for exactly one thing — the trade-license verification that flips
  // status to 'active_verified'. For everything else it provides no state,
  // so those milestones honestly default to 'not-started'.
  const milestones: Milestone[] = [
    {
      label: 'Trade License & Commercial Registration',
      // 'verified' only when the API confirms it; 'pending' only when the API
      // itself reported a live verification state; if the fetch produced no
      // data we claim NOTHING — 'not-started'.
      state: isVerified ? 'verified' : (verificationData ? 'pending' : 'not-started'),
      required: true,
      description: isVerified
        ? 'Business documents reviewed and approved by Zylod.'
        : verificationData
          ? (verificationData.description || 'Upload your trade license to start verification.')
          : 'Your verification state could not be loaded just now.',
    },
    {
      label: 'National Identity / Passport KYC',
      state: 'not-started',
      required: true,
      description: 'Authorized signatory identity check — not offered on your account yet.',
    },
    {
      label: 'Tax Identification Number (TIN / BIN)',
      state: 'not-started',
      required: true,
      description: 'National Board of Revenue (NBR) e-TIN check — not started.',
    },
    {
      label: 'Bank Account Solvency Certificate',
      state: 'not-started',
      required: true,
      description: 'Official letter from an authorized commercial bank — not started.',
    },
    {
      label: 'Physical Factory & Warehouse Audit',
      state: 'not-started',
      required: false,
      description: 'On-site facility verification — not scheduled.',
    },
  ]

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <PageLoader />
      </div>
    )
  }

  // ─── Not signed in — no fabrication of someone else's status ──────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-7 w-7 text-slate-400 dark:text-slate-500" />
          </div>
          <h1 className="text-base font-black">Sign in to view your verification status</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Verification milestones are tied to your account — sign in to see the real state of your KYC documents.
          </p>
          <Button
            onClick={() => navigate('login')}
            className="bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs px-6"
          >
            Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Trust &amp; Verification</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-3xl">
        {/* Verification Badge Showcase */}
        <div className="bg-gradient-to-br from-slate-100 via-rose-100 to-slate-100 dark:from-slate-900 dark:via-rose-950 dark:to-slate-900 rounded-3xl p-6 text-gray-900 dark:text-white text-center shadow-xl space-y-3 relative overflow-hidden">
          <div className="w-16 h-16 rounded-3xl bg-black/5 dark:bg-gray-900/10 border-2 border-black/10 dark:border-white/20 mx-auto flex items-center justify-center shadow-inner">
            <Award className="h-8 w-8 text-rose-600 dark:text-rose-300" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">
              {levelName || 'Not verified yet'}
            </span>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mt-2">
              {isVerified ? 'Verified B2B Credential' : 'Verification Status'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto mt-1 leading-relaxed">
              {isVerified
                ? 'Displayed across all your wholesale catalog listings.'
                : (verificationData?.description || fetchFailed
                  ? 'Your verification state could not be loaded just now — the milestone list below shows only what is known for certain.'
                  : 'Complete trade license upload to receive the Verified Partner badge.')}
            </p>
          </div>
        </div>

        {/* Benefits of Verification */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            What Verification Unlocks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {[
              { title: 'Trust Badge on Catalog Listings', desc: 'Buyers see your real verification status on every listing you publish' },
              { title: 'Payment Verification Trust', desc: 'Buyers see your real verification status on every listing' },
              { title: 'Catalog Visibility', desc: 'Your listings appear in the wholesale catalog searches' },
              { title: 'Direct RFQ Inquiries', desc: 'Receive quote requests from buyers in your categories' },
            ].map(({ title, desc }) => (
              <div key={title} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">{title}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestone Verification Checkpoints */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">KYC &amp; Verification Milestones</span>
          </div>

          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {milestones.map((m) => {
              const verified = m.state === 'verified'
              const pending = m.state === 'pending'
              return (
                <div key={m.label} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      verified
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                    }`}>
                      {verified ? <Check className="h-4 w-4 stroke-[3]" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{m.label}</h3>
                        {m.required && (
                          <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{m.description}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                    verified
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                      : pending
                        ? 'text-amber-700 bg-amber-50 border border-amber-100'
                        : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                  }`}>
                    {verified ? 'Verified' : pending ? 'Pending' : 'Not started'}
                  </span>
                </div>
              )
            })}
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
