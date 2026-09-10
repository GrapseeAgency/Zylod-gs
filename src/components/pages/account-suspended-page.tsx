'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  ArrowLeft,
  HelpCircle,
  Shield,
  AlertCircle,
  Clock,
  Mail,
  ExternalLink,
  History,
  MessageCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
  }),
}

interface SuspensionInfo {
  status: string
  email: string
  reason: string | null
  reference: string | null
  suspendedAt: string | null
  banned: boolean
}

export function AccountSuspendedPage() {
  const { navigate, goBack, pageParams } = useNavigationStore()
  const isMobile = useIsMobile()

  const [suspension, setSuspension] = useState<SuspensionInfo>({
    status: pageParams.status || 'suspended',
    email: pageParams.email || '',
    // Values forwarded by the login route when available; refined via the API below.
    reason: pageParams.reason || null,
    reference: pageParams.reference || null,
    suspendedAt: null,
    banned: pageParams.status === 'banned',
  })
  const [isFetching, setIsFetching] = useState(Boolean(pageParams.email))
  const [supportState, setSupportState] = useState<'idle' | 'sending' | 'sent'>('idle')

  // Pull the authoritative suspension record for this account.
  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      if (!pageParams.email) {
        setIsFetching(false)
        return
      }
      try {
        const res = await fetch(`/api/auth/account-status?email=${encodeURIComponent(String(pageParams.email))}`)
        const data = await res.json()
        if (!cancelled && res.ok && data.suspended) {
          setSuspension((s) => ({
            ...s,
            status: data.accountStatus,
            reason: data.suspension.reason,
            reference: data.suspension.reference,
            suspendedAt: data.suspension.suspendedAt,
            banned: Boolean(data.suspension.banned),
          }))
        }
      } catch {
        /* keep the forwarded values */
      } finally {
        if (!cancelled) setIsFetching(false)
      }
    }

    loadStatus()
    return () => { cancelled = true }
  }, [pageParams.email])

  /** Submit an appeal through the public contact channel. */
  const handleContactSupport = async () => {
    if (!suspension.email) {
      navigate('contact-us')
      return
    }

    setSupportState('sending')

    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suspension.email.split('@')[0],
          email: suspension.email,
          category: 'account_issue',
          subject: `Suspension appeal — ${suspension.reference || suspension.email}`,
          message: `My account (${suspension.email}) has been ${suspension.banned ? 'banned' : 'suspended'}. Reference: ${suspension.reference || 'n/a'}. I would like to appeal this decision and understand the steps required to restore access.`,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        navigate('contact-us')
        return
      }

      setSupportState('sent')
    } catch {
      navigate('contact-us')
    }
  }

  /* ─── Header Bar ─── */
  const headerBar = (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 bg-white border-b border-[#E0E0E0]">
      <button
        onClick={goBack}
        className="p-1.5 rounded-lg active:scale-95 transition-transform"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5 text-[#C8102E]" />
      </button>
      <span className="text-lg font-bold text-[#C8102E]">Zylod</span>
      <button
        onClick={() => navigate('help-center')}
        className="p-1.5 rounded-lg active:scale-95 transition-transform"
        aria-label="Help"
      >
        <HelpCircle className="w-5 h-5 text-[#6B7280]" />
      </button>
    </header>
  )

  /* ─── Hero Section ─── */
  const heroSection = (
    <motion.div
      custom={0}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center pt-8 pb-4"
    >
      <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center">
        <AlertCircle className="w-14 h-14 text-[#C8102E]" strokeWidth={3} />
      </div>
    </motion.div>
  )

  /* ─── Main Headline ─── */
  const headline = (
    <motion.div
      custom={1}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="text-center px-6 pb-4"
    >
      <h1 className="text-[24px] leading-tight font-semibold text-[#1A1A1A]">
        Your account has been{' '}
        <span className="font-bold">
          {suspension.banned ? 'permanently banned' : 'temporarily suspended'}
        </span>
      </h1>
    </motion.div>
  )

  /* ─── Information Card ─── */
  const infoCard = (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4"
    >
      <Card className="rounded-xl shadow-md border-0 bg-white py-0 gap-0">
        <CardContent className="p-5 space-y-0">
          {/* Section 1: Reason for Suspension */}
          <div className="flex gap-3">
            <div className="mt-0.5 shrink-0">
              <Shield className="w-5 h-5 text-[#C8102E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
                Reason for {suspension.banned ? 'Ban' : 'Suspension'}
              </p>
              {isFetching ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 text-[#9CA3AF] animate-spin" />
                  <p className="text-[13px] text-[#9CA3AF]">Loading account details...</p>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-[#6B7280]">
                  {suspension.reason ||
                    'Our security compliance team needs to review recent activity on your account before it can be restored.'}
                </p>
              )}
            </div>
          </div>

          <Separator className="my-4 bg-[#E0E0E0]" />

          {/* Section 2: Current Status */}
          <div className="flex gap-3">
            <div className="mt-0.5 shrink-0">
              <Clock className="w-5 h-5 text-[#C8102E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
                Current Status
              </p>
              <p className="text-[13px] leading-relaxed text-[#6B7280]">
                {suspension.banned
                  ? 'This account has been permanently closed and cannot be reinstated.'
                  : 'Account functions (buying, selling, and messaging) are restricted while our compliance team completes its manual review.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  /* ─── Primary Button ─── */
  const contactButton = (
    <motion.div
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-5 space-y-3"
    >
      {supportState === 'sent' ? (
        <div className="w-full flex items-center justify-center gap-2 h-[52px] rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm font-semibold text-green-700">
            Appeal submitted — we&apos;ll reach out within 24 hours.
          </p>
        </div>
      ) : !suspension.banned && (
        <Button
          onClick={handleContactSupport}
          disabled={supportState === 'sending'}
          className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D25] text-white rounded-xl text-base font-semibold gap-2 disabled:opacity-50"
        >
          {supportState === 'sending' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting appeal...
            </>
          ) : (
            <>
              <MessageCircle className="w-5 h-5" />
              Appeal This Decision
            </>
          )}
        </Button>
      )}
    </motion.div>
  )

  /* ─── Secondary Link ─── */
  const reviewLink = (
    <motion.div
      custom={4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex justify-center pt-4"
    >
      <button
        onClick={() => navigate('terms')}
        className="flex items-center gap-1.5 text-[#C8102E] text-sm font-semibold hover:underline"
      >
        Review Policy
        <ExternalLink className="w-4 h-4" />
      </button>
    </motion.div>
  )

  /* ─── Info Cards ─── */
  const infoCards = (
    <motion.div
      custom={5}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-5 space-y-3"
    >
      {/* Card 1: Review Duration */}
      {!suspension.banned && (
        <div className="flex items-start gap-3 bg-[#F3F4F6] rounded-xl p-4">
          <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-[#6B7280]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Review Duration</p>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Typically resolved within 24-48 business hours.
            </p>
          </div>
        </div>
      )}

      {/* Card 2: Email Notification */}
      <div className="flex items-start gap-3 bg-[#F3F4F6] rounded-xl p-4">
        <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-[#6B7280]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1A1A1A]">
            Email Notification
          </p>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Updates are sent to {suspension.email || 'your registered email'} as the review progresses.
          </p>
        </div>
      </div>
    </motion.div>
  )

  /* ─── Footer ─── */
  const footer = (
    <motion.div
      custom={6}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center gap-1 pt-6 pb-8"
    >
      {suspension.reference && (
        <p className="text-[11px] text-[#6B7280]">
          Reference Ticket: #{suspension.reference.startsWith('BD-') ? suspension.reference : `BD-${suspension.reference}`}
        </p>
      )}
      <p className="text-[11px] text-[#6B7280]">
        &copy; {new Date().getFullYear()} Zylod Global Marketplace
      </p>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {headerBar}
      <main className={`flex-1 flex flex-col ${isMobile ? '' : 'justify-center px-4 py-10'}`}>
        {isMobile ? (
          <>
            {heroSection}
            {headline}
            {infoCard}
            {contactButton}
            {reviewLink}
            {infoCards}
            {footer}
          </>
        ) : (
          <div className="w-full max-w-md mx-auto flex flex-col">
            {heroSection}
            {headline}
            {infoCard}
            {contactButton}
            {reviewLink}
            {infoCards}
            {footer}
          </div>
        )}
      </main>
    </div>
  )
}

export default AccountSuspendedPage
