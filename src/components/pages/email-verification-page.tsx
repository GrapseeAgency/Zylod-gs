'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCountdown } from '@/lib/auth-security'
import { toast } from 'sonner'
import {
  ArrowLeft,
  HelpCircle,
  Mail,
  Shield,
  RefreshCw,
  Pencil,
  ExternalLink,
  Zap,
  Loader2,
  CheckCircle2,
  KeyRound,
} from 'lucide-react'
import Image from 'next/image'

/* ─── Animation variants ─── */
const fadeSlideUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
}

/* ─── Header Bar ─── */
function HeaderBar({ onBack }: { onBack: () => void }) {
  const { navigate } = useNavigationStore()
  return (
    <div className="flex items-center justify-between px-4 h-14">
      <button
        onClick={onBack}
        className="p-2 -ml-2 rounded-lg active:scale-95 transition-transform"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5 text-[#C8102E]" />
      </button>
      <span className="text-lg font-bold text-[#C8102E]">Zylod</span>
      <button
        onClick={() => navigate('help-center')}
        className="p-2 -mr-2 rounded-lg active:scale-95 transition-transform"
        aria-label="Help"
      >
        <HelpCircle className="w-5 h-5 text-[#6B7280]" />
      </button>
    </div>
  )
}

/* ─── Feature Badge ─── */
function FeatureBadge({
  icon,
  title,
  subtitle,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F3F4F6] border border-[#E0E0E0]"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#1A1A1A]">{title}</p>
        <p className="text-xs text-[#6B7280]">{subtitle}</p>
      </div>
    </motion.div>
  )
}

/* ─── Main Page Component ─── */
export default function EmailVerificationPage() {
  const isMobile = useIsMobile()
  const { navigate, goBack, pageParams } = useNavigationStore()
  // The address always comes from the previous step in the flow.
  const email = pageParams.email || ''
  const flow = pageParams.flow || 'register' // 'register' | 'forgot-password'
  // Dev-mode delivery token issued by the API for the current flow.
  const [flowToken, setFlowToken] = useState(pageParams.token || '')

  const [isResending, setIsResending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isSendingInitial, setIsSendingInitial] = useState(flow !== 'forgot-password')

  const { remaining, isRunning, reset: resetCountdown, formatted } = useCountdown(60)

  // ─── Forgot-password flow: poll nothing, token already issued. Register flow:
  // trigger the verification email on mount and start polling verified state.
  useEffect(() => {
    if (flow === 'forgot-password') return

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    const sendInitialEmail = async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

        const data = await res.json()

        if (!cancelled && res.ok && data.devToken) {
          setFlowToken(data.devToken)
        }
      } catch {
        // Silently fail on initial send — user can hit Resend
      } finally {
        if (!cancelled) setIsSendingInitial(false)
      }
    }

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?email=${encodeURIComponent(email)}`)
        const data = await res.json()
        if (!cancelled && res.ok && data.isEmailVerified) {
          setIsVerified(true)
          return
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled) pollTimer = setTimeout(pollStatus, 5000)
    }

    sendInitialEmail()
    if (email) pollStatus()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [email, flow])

  // ─── Resend Email ───
  const handleResendEmail = useCallback(async () => {
    if (isRunning || !email) return
    setIsResending(true)

    try {
      // In the forgot-password flow the resent email carries a new reset token.
      const endpoint = flow === 'forgot-password' ? '/api/auth/forgot-password' : '/api/auth/verify-email'
      const body = flow === 'forgot-password' ? { email } : { email }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to resend email')
        return
      }

      if (data.devToken) setFlowToken(data.devToken)
      toast.success(
        flow === 'forgot-password' ? 'New reset link sent!' : 'Verification email resent!',
        { description: `A new link has been sent to ${email}` }
      )
      resetCountdown()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsResending(false)
    }
  }, [email, flow, isRunning, resetCountdown])

  // ─── Change Email ───
  const handleChangeEmail = () => {
    navigate(flow === 'forgot-password' ? 'forgot-password' : 'register')
  }

  // ─── Open Email App ───
  const handleOpenEmailApp = () => {
    window.location.href = `mailto:${email}`
  }

  // ─── Continue to Reset Password (forgot-password flow) ───
  const handleContinueToReset = useCallback(() => {
    navigate('reset-password', { token: flowToken, email })
  }, [flowToken, email, navigate])

  // ─── Verify with token (dev-mode equivalent of clicking the email link) ───
  const handleVerifyWithToken = useCallback(async (token: string) => {
    if (!token) return
    setIsVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Verification failed')
        return
      }

      setIsVerified(true)
      toast.success('Email verified successfully!', {
        description: 'Your account is now active',
      })
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }, [])

  // ─── Shared Content ───
  const pageContent = (
    <>
      {/* Bird Illustration */}
      <motion.div
        variants={fadeSlideUp}
        className="flex flex-col items-center mt-4 mb-2"
      >
        <div className="relative">
          <Image
            src="/images/auth/email-verification-bird.png"
            alt="Email verification bird"
            width={300}
            height={280}
            className="w-[280px] sm:w-[300px] h-auto"
            priority
          />
          {/* Floating badge circle */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#C8102E] flex items-center justify-center shadow-lg">
            {isVerified ? (
              <CheckCircle2 className="w-7 h-7 text-white" />
            ) : (
              <Mail className="w-7 h-7 text-white" />
            )}
          </div>
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div variants={fadeSlideUp} className="text-center mt-6 mb-2">
        <h1 className="text-[26px] font-bold text-[#1A1A1A] leading-tight">
          {isVerified ? 'Email Verified!' : 'Please check your inbox'}
        </h1>
      </motion.div>

      {/* Body Text */}
      <motion.div variants={fadeSlideUp} className="text-center px-2 mb-6">
        {isVerified ? (
          <p className="text-[16px] text-green-600 leading-relaxed">
            Your email has been verified successfully. You can now access all features of your Zylod account.
          </p>
        ) : flow === 'forgot-password' ? (
          <p className="text-[16px] text-[#6B7280] leading-relaxed">
            We&apos;ve sent a password reset link to{' '}
            <span className="font-bold text-[#1A1A1A]">{email || 'your email'}</span>. Open the
            link to set a new password.
          </p>
        ) : (
          <p className="text-[16px] text-[#6B7280] leading-relaxed">
            We&apos;ve sent a verification link to{' '}
            <span className="font-bold text-[#1A1A1A]">{email || 'your email'}</span>. Click the
            link in the email to activate your account.
          </p>
        )}
      </motion.div>

      {/* Primary Button */}
      {isVerified ? (
        <motion.div variants={fadeSlideUp}>
          <Button
            onClick={() => navigate('home')}
            className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D24] text-white rounded-xl text-base font-semibold shadow-lg"
            size="lg"
          >
            Go to Home
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={fadeSlideUp} className="space-y-3">
          {flow === 'forgot-password' ? (
            /* Forgot-password: continue straight into Reset Password with the issued token */
            <Button
              onClick={handleContinueToReset}
              disabled={!flowToken}
              className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D24] text-white rounded-xl text-base font-semibold shadow-lg disabled:opacity-50"
              size="lg"
            >
              <KeyRound className="w-5 h-5 mr-2" />
              Continue to Reset Password
            </Button>
          ) : (
            <>
              <Button
                onClick={() => handleVerifyWithToken(flowToken)}
                disabled={isSendingInitial || !flowToken || isVerifying}
                className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D24] text-white rounded-xl text-base font-semibold shadow-lg disabled:opacity-50"
                size="lg"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : isSendingInitial ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    I&apos;ve Clicked the Email Link — Verify Now
                  </>
                )}
              </Button>
              <Button
                onClick={handleOpenEmailApp}
                variant="outline"
                className="w-full h-[52px] border-[#E0E0E0] bg-white hover:bg-[#F8F9FA] text-[#1A1A1A] rounded-xl text-base font-semibold"
                size="lg"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Open Email App
              </Button>
            </>
          )}
        </motion.div>
      )}

      {/* Secondary Links */}
      {!isVerified && (
        <motion.div
          variants={fadeSlideUp}
          className="flex flex-col items-center gap-3 mt-5"
        >
          <p className="text-sm text-[#6B7280]">
            Didn&apos;t receive the email?
          </p>
          <div className={`flex items-center gap-4 ${flow === 'forgot-password' ? '' : 'flex-wrap justify-center'}`}>
            <button
              onClick={handleResendEmail}
              disabled={isResending || isRunning}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#C8102E] hover:text-[#A50D24] transition-colors disabled:opacity-50"
              type="button"
            >
              {isResending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {isRunning ? `Resend in ${formatted}` : 'Resend Email'}
            </button>
            <button
              onClick={handleChangeEmail}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
              type="button"
            >
              <Pencil className="w-3.5 h-3.5" />
              Change Email Address
            </button>
          </div>
        </motion.div>
      )}

      {/* Bottom Feature Badges */}
      <motion.div
        variants={fadeSlideUp}
        className="grid grid-cols-2 gap-3 mt-7"
      >
        <FeatureBadge
          icon={<Shield className="w-5 h-5 text-[#C8102E]" />}
          title="Secure B2B"
          subtitle="Encrypted Link"
          delay={0.15}
        />
        <FeatureBadge
          icon={<Zap className="w-5 h-5 text-[#C8102E]" />}
          title="Fast Sync"
          subtitle="Instant Delivery"
          delay={0.25}
        />
      </motion.div>
    </>
  )

  /* ─── Mobile Layout ─── */
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <HeaderBar onBack={goBack} />

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex-1 px-5 pb-8 overflow-y-auto"
        >
          {pageContent}
        </motion.div>
      </div>
    )
  }

  /* ─── Desktop Layout ─── */
  if (isMobile === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <HeaderBar onBack={goBack} />

        <div className="flex-1 flex items-start justify-center pt-6 pb-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {pageContent}
          </motion.div>
        </div>
      </div>
    )
  }

  /* ─── SSR Loading State ─── */
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-64 h-48 bg-gray-200 rounded" />
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

export { EmailVerificationPage }
