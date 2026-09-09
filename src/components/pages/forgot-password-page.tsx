'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMathCaptcha, isRateLimited, recordFailedAttempt, resetRateLimit, useCountdown } from '@/lib/auth-security'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  ArrowLeft,
  HelpCircle,
  Mail,
  Send,
  Shield,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'

/* ─── Constants ─── */
const FORGOT_PASSWORD_RATE_KEY = 'zylod-forgot-ratelimit'
const MAX_RESET_REQUESTS = 3

/* ─── Animation variants ─── */
const containerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' as const },
  }),
}

/* ─── Client-side rate limit for forgot-password ─── */
function getForgotPasswordAttempts(): number {
  if (typeof window === 'undefined') return 0
  try {
    const stored = localStorage.getItem(FORGOT_PASSWORD_RATE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Reset if older than 1 hour
      if (Date.now() - parsed.timestamp > 3600000) {
        localStorage.removeItem(FORGOT_PASSWORD_RATE_KEY)
        return 0
      }
      return parsed.count || 0
    }
  } catch { /* ignore */ }
  return 0
}

function recordForgotPasswordAttempt(): number {
  const current = getForgotPasswordAttempts()
  const newCount = current + 1
  localStorage.setItem(FORGOT_PASSWORD_RATE_KEY, JSON.stringify({ count: newCount, timestamp: Date.now() }))
  return newCount
}

function isForgotPasswordRateLimited(): boolean {
  return getForgotPasswordAttempts() >= MAX_RESET_REQUESTS
}

/* ─── Main Forgot Password Page ─── */
export function ForgotPasswordPage() {
  const isMobile = useIsMobile()
  const { navigate } = useNavigationStore()

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRateLimitedLocal, setIsRateLimitedLocal] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_RESET_REQUESTS)

  // Captcha hook — single instance used for both display and validation
  const { captcha, userAnswer, setUserAnswer, isValid, validate, refresh } = useMathCaptcha()

  // Check rate limit on mount
  useEffect(() => {
    const limited = isForgotPasswordRateLimited()
    setIsRateLimitedLocal(limited)
    const attempts = getForgotPasswordAttempts()
    setAttemptsRemaining(MAX_RESET_REQUESTS - attempts)
  }, [])

  /* ─── Submit handler ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    // Simple email format check
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address')
      return
    }

    // Check rate limit
    if (isForgotPasswordRateLimited()) {
      setError('Too many reset requests. Please try again later.')
      setIsRateLimitedLocal(true)
      return
    }

    // Validate CAPTCHA
    if (!userAnswer.trim()) {
      setError('Please solve the math verification')
      return
    }
    if (!validate()) {
      setError('Incorrect answer. Please try the new question.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Record failed attempt for rate limiting
        const newCount = recordForgotPasswordAttempt()
        setAttemptsRemaining(MAX_RESET_REQUESTS - newCount)
        if (newCount >= MAX_RESET_REQUESTS) {
          setIsRateLimitedLocal(true)
        }
        setError(data.error || 'Something went wrong. Please try again.')
        setIsLoading(false)
        return
      }

      // Success
      setIsSuccess(true)
      toast.success('Reset link sent!', {
        description: 'Check your email for the password reset link.',
      })

      // Continue the flow with the issued reset token (dev delivery) so
      // Reset Password is fully reachable end-to-end.
      setTimeout(() => {
        navigate('email-verification', {
          email,
          flow: 'forgot-password',
          token: data.devToken || '',
        })
      }, 1500)
    } catch (err) {
      console.error('Forgot password error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  /* ─── Header bar ─── */
  const headerBar = (
    <motion.div
      variants={itemVariants}
      custom={0}
      className="flex items-center justify-between px-4 h-14 bg-white border-b border-[#E0E0E0]/60"
    >
      <button
        type="button"
        onClick={() => navigate('login')}
        className="p-2 rounded-lg hover:bg-[#F8F9FA] transition-colors active:scale-95"
        aria-label="Go back to login"
      >
        <ArrowLeft className="w-5 h-5 text-[#C8102E]" />
      </button>
      <h1 className="text-base font-bold text-[#C8102E]">Zylod</h1>
      <button
        type="button"
        onClick={() => navigate('help-center')}
        className="p-2 rounded-lg hover:bg-[#F8F9FA] transition-colors"
        aria-label="Help"
      >
        <HelpCircle className="w-5 h-5 text-[#6B7280]" />
      </button>
    </motion.div>
  )

  /* ─── Main content ─── */
  const mainContent = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center px-6 pt-8 pb-6"
    >
      {/* ─── Hero Section: Lock icon in circular bg ─── */}
      <motion.div variants={itemVariants} custom={1} className="flex flex-col items-center mb-6">
        <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center mb-5 shadow-sm">
          <div className="relative">
            <KeyRound className="w-12 h-12 text-[#C8102E]" strokeWidth={1.8} />
            {/* Circular arrow overlay indicating reset */}
            <svg
              className="absolute -top-1 -right-1 w-5 h-5 text-[#C8102E]"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M4 10a6 6 0 0111.3-2.8M16 10a6 6 0 01-11.3 2.8" strokeLinecap="round" />
              <path d="M15 4v3.2h-3.2M5 16v-3.2h3.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <h2 className="text-[26px] sm:text-[28px] font-bold text-[#1A1A1A] text-center">
          Forgot Password?
        </h2>
        <p className="text-base text-[#6B7280] text-center mt-2 max-w-[280px]">
          Enter your email to receive a password reset link
        </p>
      </motion.div>

      {/* ─── Rate limit warning ─── */}
      <AnimatePresence>
        {isRateLimitedLocal && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full bg-[#FEF2F2] border border-[#C8102E]/20 rounded-lg p-4 mb-4"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-[#C8102E]">Too Many Requests</h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  You&apos;ve exceeded the maximum number of reset requests. Please try again later.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Success state ─── */}
      {isSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center"
        >
          <p className="text-sm font-medium text-green-700">
            Reset link sent! Redirecting to verification...
          </p>
        </motion.div>
      )}

      {/* ─── Email Form ─── */}
      <motion.form
        variants={itemVariants}
        custom={2}
        onSubmit={handleSubmit}
        className="w-full space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email" className="text-sm font-medium text-[#1A1A1A]">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#6B7280]" />
            <Input
              id="forgot-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              disabled={isLoading || isSuccess || isRateLimitedLocal}
              className="pl-10 h-11 bg-[#F8F9FA] border-[#E0E0E0] rounded-lg text-[#1A1A1A] placeholder:text-[#9CA3AF] focus-visible:ring-[#C8102E]/30 focus-visible:border-[#C8102E]"
            />
          </div>
        </div>

        {/* Attempts remaining indicator */}
        {!isRateLimitedLocal && attemptsRemaining < MAX_RESET_REQUESTS && attemptsRemaining > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-[#6B7280] flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-[#F97316]" />
            {attemptsRemaining} request{attemptsRemaining !== 1 ? 's' : ''} remaining
          </motion.p>
        )}

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-sm text-[#C8102E] bg-[#C8102E]/5 rounded-lg px-3 py-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Math CAPTCHA — inline using parent's hook */}
        {!isRateLimitedLocal && !isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#C8102E]" />
              <span>Verify you&apos;re human</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-[#F8F9FA] border border-[#E0E0E0] rounded-lg px-3 py-2.5">
                <span className="text-sm font-semibold text-[#1A1A1A] whitespace-nowrap">{captcha.question}</span>
                <span className="text-[#6B7280]">=</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Answer"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-20 h-8 border-[#E0E0E0] bg-white text-center text-sm font-semibold rounded-md px-2 focus-visible:ring-[#C8102E]/30 focus-visible:border-[#C8102E]"
                />
              </div>
              <button
                type="button"
                onClick={refresh}
                className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#6B7280] hover:text-[#1A1A1A]"
                aria-label="Refresh CAPTCHA"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <AnimatePresence>
              {isValid === false && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-[#C8102E] flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Wrong answer. A new question has been generated.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Send Reset Link Button */}
        <Button
          type="submit"
          disabled={isLoading || isSuccess || isRateLimitedLocal}
          className="w-full h-[50px] bg-[#C8102E] hover:bg-[#A00D24] text-white font-semibold text-base rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Send Reset Link
              <Send className="h-5 w-5" />
            </span>
          )}
        </Button>
      </motion.form>

      {/* ─── Divider ─── */}
      <motion.div variants={itemVariants} custom={3} className="flex items-center gap-3 w-full mt-6">
        <div className="flex-1 h-px bg-[#E0E0E0]" />
        <span className="text-xs font-medium text-[#6B7280] tracking-wider uppercase">OR</span>
        <div className="flex-1 h-px bg-[#E0E0E0]" />
      </motion.div>

      {/* ─── Back to Login Link ─── */}
      <motion.div variants={itemVariants} custom={4} className="mt-4">
        <button
          type="button"
          onClick={() => navigate('login')}
          className="text-sm font-semibold text-[#C8102E] hover:text-[#A00D24] transition-colors"
        >
          Back to Login
        </button>
      </motion.div>

      {/* ─── Trust Badges ─── */}
      <motion.div
        variants={itemVariants}
        custom={5}
        className="flex items-center justify-center gap-4 mt-8 pt-4"
      >
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#6B7280]" />
          <span className="text-[10px] font-semibold text-[#6B7280] tracking-wider uppercase">
            Secure Portal
          </span>
        </div>
        <span className="text-[#E0E0E0]">•</span>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#6B7280]" />
          <span className="text-[10px] font-semibold text-[#6B7280] tracking-wider uppercase">
            B2B Verified
          </span>
        </div>
      </motion.div>

      {/* ─── Copyright ─── */}
      <motion.p
        variants={itemVariants}
        custom={6}
        className="text-[10px] text-[#9CA3AF] text-center mt-3"
      >
        © 2024 Zylod Logistics &amp; Distribution.
      </motion.p>
    </motion.div>
  )

  /* ─── Mobile Layout ─── */
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        {headerBar}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full max-w-[400px]">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="bg-white rounded-2xl shadow-lg border border-[#E0E0E0]/60 mx-4 mt-6 overflow-hidden"
            >
              {mainContent}
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Desktop Layout ─── */
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-2xl shadow-lg border border-[#E0E0E0]/60 overflow-hidden"
        >
          {/* Desktop header bar */}
          <div className="flex items-center justify-between px-6 h-14 bg-white border-b border-[#E0E0E0]/60">
            <button
              type="button"
              onClick={() => navigate('login')}
              className="p-2 rounded-lg hover:bg-[#F8F9FA] transition-colors"
              aria-label="Go back to login"
            >
              <ArrowLeft className="w-5 h-5 text-[#C8102E]" />
            </button>
            <h1 className="text-base font-bold text-[#C8102E]">Zylod</h1>
            <button
              type="button"
              onClick={() => navigate('help-center')}
              className="p-2 rounded-lg hover:bg-[#F8F9FA] transition-colors"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
          {mainContent}
        </motion.div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
