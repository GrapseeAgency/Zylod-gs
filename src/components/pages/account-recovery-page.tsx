'use client'

import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ShieldCheck,
  Mail,
  IdCard,
  Headphones,
  Info,
  Lock,
} from 'lucide-react'

type RecoveryMethod = 'identity' | 'security-team'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
  }),
}

export function AccountRecoveryPage() {
  const { goBack, navigate } = useNavigationStore()
  const isMobile = useIsMobile()

  const [email, setEmail] = useState('')
  const [selectedMethod, setSelectedMethod] = useState<RecoveryMethod>('identity')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRecover = useCallback(async () => {
    if (!email.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          method: selectedMethod,
        }),
      })
      const data = await res.json()
      if (data.success) {
        navigate('email-verification', { email: email.trim(), purpose: 'recovery' })
      } else {
        // Still navigate — don't reveal whether account exists
        navigate('email-verification', { email: email.trim(), purpose: 'recovery' })
      }
    } catch {
      // On error, still navigate to not leak info
      navigate('email-verification', { email: email.trim(), purpose: 'recovery' })
    } finally {
      setIsSubmitting(false)
    }
  }, [email, selectedMethod, navigate])

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
      <span className="text-lg font-bold text-[#1A1A1A]">Account Recovery</span>
      <button className="p-1.5 rounded-lg" aria-label="Notifications">
        <Bell className="w-5 h-5 text-[#C8102E]" />
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
      className="flex flex-col items-center pt-8 pb-2"
    >
      <div className="w-28 h-28 rounded-full bg-[#FEE2E2] flex items-center justify-center">
        <ShieldCheck className="w-14 h-14 text-[#C8102E]" strokeWidth={1.5} />
      </div>
    </motion.div>
  )

  /* ─── Heading ─── */
  const heading = (
    <motion.div
      custom={1}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="text-center px-6 pb-2"
    >
      <h1 className="text-[26px] leading-tight font-bold text-[#1A1A1A]">
        Recover Your Account
      </h1>
      <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">
        Lost access to your password and 2FA device? Follow the steps below to securely
        verify your identity and regain access.
      </p>
    </motion.div>
  )

  /* ─── Progress Stepper ─── */
  const stepper = (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-6 pt-4"
    >
      <div className="flex items-center justify-between">
        {/* Step 1 - Active */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-9 h-9 rounded-full bg-[#C8102E] flex items-center justify-center">
            <span className="text-white text-sm font-bold">1</span>
          </div>
          <span className="text-[10px] font-bold text-[#C8102E] tracking-wider">
            VERIFY EMAIL
          </span>
        </div>

        {/* Connector 1 */}
        <div className="flex-1 h-[2px] bg-[#D1D5DB] mx-2 mt-[-18px]" />

        {/* Step 2 - Inactive */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-9 h-9 rounded-full bg-[#E5E7EB] flex items-center justify-center">
            <span className="text-[#6B7280] text-sm font-bold">2</span>
          </div>
          <span className="text-[10px] font-bold text-[#9CA3AF] tracking-wider">
            IDENTIFY
          </span>
        </div>

        {/* Connector 2 */}
        <div className="flex-1 h-[2px] bg-[#D1D5DB] mx-2 mt-[-18px]" />

        {/* Step 3 - Inactive */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-9 h-9 rounded-full bg-[#E5E7EB] flex items-center justify-center">
            <span className="text-[#6B7280] text-sm font-bold">3</span>
          </div>
          <span className="text-[10px] font-bold text-[#9CA3AF] tracking-wider">
            REVIEW
          </span>
        </div>
      </div>
    </motion.div>
  )

  /* ─── Email Input Card ─── */
  const emailCard = (
    <motion.div
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-5"
    >
      <Card className="rounded-xl shadow-md border-0 bg-white py-0 gap-0">
        <CardContent className="p-5 space-y-3">
          <Label className="text-[14px] font-semibold text-[#1A1A1A]">
            Original Registered Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@company.com"
              className="h-11 pl-10 rounded-xl border-[#E0E0E0] text-[14px] focus-visible:border-[#C8102E] focus-visible:ring-[#C8102E]/20"
            />
          </div>
          <p className="text-[12px] text-[#6B7280] leading-relaxed">
            This must be the email address you used to create your Zylod account.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )

  /* ─── Recovery Method Selection ─── */
  const methodSelection = (
    <motion.div
      custom={4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-5 space-y-3"
    >
      <p className="text-[14px] font-semibold text-[#1A1A1A] px-1">
        Select Recovery Method
      </p>

      {/* Option 1 - Identity Verification */}
      <button
        onClick={() => setSelectedMethod('identity')}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all bg-white ${
          selectedMethod === 'identity'
            ? 'border-[#C8102E] bg-[#FFF5F5] shadow-md'
            : 'border-[#E0E0E0] shadow-sm'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#FFE4E6] flex items-center justify-center shrink-0">
            <IdCard className="w-5 h-5 text-[#C8102E]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#1A1A1A]">
              Recover via Identity Verification
            </p>
            <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
              Securely upload a photo ID (Passport or Driver&apos;s License) to confirm your
              identity. Fast and secure.
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <IdCard className="w-3.5 h-3.5 text-[#C8102E]" />
              <span className="text-[11px] font-semibold text-[#C8102E]">
                Requires Photo ID Upload
              </span>
            </div>
          </div>
          <div className="shrink-0 ml-2 mt-1">
            {selectedMethod === 'identity' ? (
              <div className="w-5 h-5 rounded-full bg-[#C8102E] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB]" />
            )}
          </div>
        </div>
      </button>

      {/* Option 2 - Contact Security Team */}
      <button
        onClick={() => setSelectedMethod('security-team')}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all bg-white ${
          selectedMethod === 'security-team'
            ? 'border-[#C8102E] bg-[#FFF5F5] shadow-md'
            : 'border-[#E0E0E0] shadow-sm'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5 text-[#6B7280]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#1A1A1A]">
              Contact Security Team
            </p>
            <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
              If you don&apos;t have access to your ID, speak with a security specialist to
              manually verify your business ownership.
            </p>
          </div>
          <div className="shrink-0 ml-2 mt-1">
            {selectedMethod === 'security-team' ? (
              <div className="w-5 h-5 rounded-full bg-[#C8102E] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB]" />
            )}
          </div>
        </div>
      </button>
    </motion.div>
  )

  /* ─── Verification Notice ─── */
  const verificationNotice = (
    <motion.div
      custom={5}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-4"
    >
      <div className="flex items-start gap-3 bg-white rounded-xl p-4 border-l-4 border-l-[#C8102E] shadow-sm">
        <Info className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-bold text-[#1A1A1A]">Verification Notice:</p>
          <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
            Our security team typically reviews recovery requests within 24 hours. You will
            receive an update at your registered email address.
          </p>
        </div>
      </div>
    </motion.div>
  )

  /* ─── Primary Button ─── */
  const recoverButton = (
    <motion.div
      custom={6}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-5"
    >
      <Button
        onClick={handleRecover}
        disabled={!email.trim() || isSubmitting}
        className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D25] text-white rounded-xl text-base font-semibold gap-2 disabled:opacity-50"
      >
        {isSubmitting ? 'Processing...' : 'Start Recovery Process'}
        {!isSubmitting && <ArrowRight className="w-5 h-5" />}
      </Button>
    </motion.div>
  )

  /* ─── Footer ─── */
  const footer = (
    <motion.div
      custom={7}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-6 pb-8"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#9CA3AF]" />
          <span className="text-[10px] font-bold text-[#9CA3AF] tracking-wider uppercase">
            End-to-End Encrypted Verification
          </span>
        </div>
        <p className="text-[11px] text-[#9CA3AF] text-center leading-relaxed max-w-xs">
          Zylod uses industry-standard encryption to protect your sensitive data
          during recovery.
        </p>
      </div>
    </motion.div>
  )

  /* ─── Mobile Layout ─── */
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        {headerBar}
        <main className="flex-1 flex flex-col">
          {heroSection}
          {heading}
          {stepper}
          {emailCard}
          {methodSelection}
          {verificationNotice}
          {recoverButton}
          {footer}
        </main>
      </div>
    )
  }

  /* ─── Desktop Layout ─── */
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {headerBar}
      <main className="flex-1 flex justify-center px-4 py-10">
        <div className="w-full max-w-md flex flex-col">
          {heroSection}
          {heading}
          {stepper}
          {emailCard}
          {methodSelection}
          {verificationNotice}
          {recoverButton}
          {footer}
        </div>
      </main>
    </div>
  )
}

export default AccountRecoveryPage
