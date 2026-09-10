'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCountdown } from '@/lib/auth-security'
import { getPendingRegistration, clearPendingRegistration } from '@/lib/pending-registration'
import { ArrowLeft, ArrowRight, HelpCircle, Mail, Shield, Loader2, Smartphone, Phone, Info } from 'lucide-react'
import { toast } from 'sonner'

const RESEND_COUNTDOWN = 58

type OtpPurpose = 'login' | 'register' | 'reset_password' | 'phone_verify' | 'email_verify'

/** Mask a contact target so the page never invents one. */
function maskTarget(target: string): string {
  if (!target) return ''
  if (target.includes('@')) {
    const [name, domain] = target.split('@')
    const shown = name.slice(0, 2)
    return `${shown}${'•'.repeat(Math.max(name.length - 2, 2))}@${domain}`
  }
  return `${target.slice(0, 6)}${'•'.repeat(Math.max(target.length - 10, 3))}${target.slice(-4)}`
}

export default function OtpVerificationPage() {
  const isMobile = useIsMobile()
  const { navigate, goBack, pageParams } = useNavigationStore()
  const { login: authLogin } = useAuthStore()

  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasAutoSubmitted = useRef(false)

  const phoneOrEmail = pageParams.phoneOrEmail || pageParams.phone || pageParams.email || ''
  const purpose: OtpPurpose = (pageParams.purpose as OtpPurpose) || 'login'
  // Dev delivery: when no SMS/email provider is configured the API returns the
  // generated code inline. Surfaced here instead of silently discarded.
  const [devCode] = useState(pageParams.devCode || '')

  const { remaining, isRunning, reset: resetCountdown, formatted } = useCountdown(RESEND_COUNTDOWN)

  // ─── Verify OTP ───
  const handleVerify = useCallback(async (code?: string) => {
    const otpValue = code || otp
    if (otpValue.length < 6) {
      setError('Please enter all 6 digits')
      return
    }

    if (!phoneOrEmail) {
      setError('Missing verification target. Please restart the flow.')
      return
    }

    if (hasAutoSubmitted.current) return
    hasAutoSubmitted.current = true

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneOrEmail,
          code: otpValue,
          purpose,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verification failed. Please try again.')
        setOtp('')
        hasAutoSubmitted.current = false
        return
      }

      // Success - handle based on purpose
      if (data.user && data.token && purpose !== 'register') {
        authLogin(
          {
            id: data.user.id,
            userType: data.user.userType,
            email: data.user.email,
            phone: data.user.phone,
            fullName: null,
            businessName: null,
            avatarUrl: null,
            isProfileComplete: false,
            profileCompletionPct: 0,
          },
          data.token
        )
      }

      switch (purpose) {
        case 'register': {
          // OTP verified — now create the real account from the pending payload.
          const pending = getPendingRegistration()
          if (!pending) {
            navigate('register')
            return
          }

          const regRes = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...pending,
              authProvider: 'phone_otp',
              // Mark the channel that was just verified
              isPhoneVerified: !phoneOrEmail.includes('@'),
              isEmailVerified: phoneOrEmail.includes('@'),
            }),
          })

          const regData = await regRes.json()

          if (!regRes.ok) {
            clearPendingRegistration()
            toast.error(regData.error || 'Account creation failed')
            navigate('register')
            return
          }

          clearPendingRegistration()

          // Sign the user in immediately with the fresh session token
          if (regData.user && regData.token) {
            authLogin(
              {
                id: regData.user.id,
                userType: regData.user.userType,
                email: regData.user.email,
                phone: regData.user.phone,
                fullName: pending.fullName,
                businessName: pending.businessName || null,
                avatarUrl: null,
                isProfileComplete: false,
                profileCompletionPct: 20,
              },
              regData.token
            )
          }

          if (regData.user?.email) {
            // Trigger the welcome verification email and continue to its inbox screen
            try {
              const evRes = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: regData.user.email }),
              })
              const evData = await evRes.json()
              navigate('email-verification', {
                email: regData.user.email,
                flow: 'register',
                token: evData.devToken || '',
              })
            } catch {
              navigate('email-verification', { email: regData.user.email, flow: 'register', token: '' })
            }
          } else {
            // Phone-only registration — fully verified already
            toast.success('Account created successfully!')
            navigate(pending.userType === 'supplier' ? 'supplier-dashboard' : 'home')
          }
          break
        }
        case 'phone_verify':
          navigate(pageParams.returnTo || 'profile')
          break
        case 'reset_password': {
          const resetToken = data.resetToken || pageParams.token || ''
          if (!resetToken) {
            setError('Reset session expired. Please request a new link.')
            hasAutoSubmitted.current = false
            return
          }
          navigate('reset-password', { token: resetToken })
          break
        }
        case 'email_verify':
          navigate(pageParams.returnTo || 'home')
          break
        case 'login':
        default:
          navigate('home')
          break
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
      setOtp('')
      hasAutoSubmitted.current = false
    } finally {
      setIsLoading(false)
    }
  }, [otp, phoneOrEmail, purpose, pageParams.returnTo, pageParams.token, authLogin, navigate])

  // ─── Resend OTP ───
  const handleResend = useCallback(async () => {
    if (isRunning) return
    setIsResending(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneOrEmail,
          purpose,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to resend code')
        return
      }

      toast.success('A new verification code has been sent!')
      setOtp('')
      hasAutoSubmitted.current = false
      resetCountdown()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsResending(false)
    }
  }, [isRunning, phoneOrEmail, purpose, resetCountdown])

  // ─── Auto-verify when all 6 digits are entered ───
  useEffect(() => {
    if (otp.length === 6 && !hasAutoSubmitted.current && !isLoading) {
      const timer = setTimeout(() => {
        handleVerify(otp)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [otp, isLoading, handleVerify])

  // ─── Purpose-aware subtitle ───
  const getPurposeLabel = () => {
    switch (purpose) {
      case 'login': return 'to sign in to your account'
      case 'register': return 'to complete your registration'
      case 'reset_password': return 'to reset your password'
      case 'phone_verify': return 'to verify your phone number'
      case 'email_verify': return 'to verify your email address'
      default: return 'to continue'
    }
  }

  const getIcon = () => {
    switch (purpose) {
      case 'phone_verify':
        return <Phone className="h-10 w-10 text-[#C8102E]" strokeWidth={1.8} />
      case 'login':
      case 'register':
        return <Smartphone className="h-10 w-10 text-[#C8102E]" strokeWidth={1.8} />
      case 'email_verify':
      case 'reset_password':
      default:
        return <Mail className="h-10 w-10 text-[#C8102E]" strokeWidth={1.8} />
    }
  }

  // ─── Shared OTP Input Section ───
  const otpInputSection = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="w-full flex flex-col items-center gap-3"
    >
      {/* Dev delivery hint — shown only when the API returned the code inline
          because no SMS/email provider is configured. Tap to autofill. */}
      {devCode && (
        <button
          type="button"
          onClick={() => setOtp(devCode)}
          className="w-full max-w-[320px] flex items-center justify-center gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 active:scale-[0.98] transition-transform"
        >
          <Info className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
          <span className="text-xs text-[#92400E]">
            Delivery provider not configured — your code is{' '}
            <span className="font-mono font-bold">{devCode}</span> (tap to fill)
          </span>
        </button>
      )}
      <InputOTP
        maxLength={6}
        value={otp}
        onChange={setOtp}
        containerClassName="justify-center gap-2"
      >
        <InputOTPGroup className="gap-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot
              key={index}
              index={index}
              className="h-[52px] w-[48px] rounded-xl border-[#E0E0E0] text-lg font-semibold text-[#1A1A1A] data-[active=true]:border-[#C8102E] data-[active=true]:ring-[#C8102E]/20 shadow-sm"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </motion.div>
  )

  // ─── Error Message ───
  const errorMessage = error && (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full p-3 rounded-lg bg-red-50 border border-red-200"
    >
      <p className="text-sm text-red-600 text-center">{error}</p>
    </motion.div>
  )

  // ─── Resend Section ───
  const resendSection = (
    <div className="text-center">
      <p className="text-sm text-[#6B7280]">
        Didn&apos;t receive the code?{' '}
        {isRunning ? (
          <span className="text-[#C8102E] font-semibold">
            Resend in {formatted}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-[#C8102E] font-semibold hover:underline disabled:opacity-50"
          >
            {isResending ? 'Sending...' : 'Resend Code'}
          </button>
        )}
      </p>
    </div>
  )

  // ─── Verify Button ───
  const verifyButton = (
    <Button
      onClick={() => handleVerify()}
      disabled={isLoading || otp.length < 6}
      className="w-full h-[54px] bg-[#C8102E] hover:bg-[#A50D25] text-white text-base font-semibold rounded-xl shadow-lg shadow-red-200/50 transition-all disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Verifying...
        </>
      ) : (
        <>
          Verify & Continue
          <ArrowRight className="h-5 w-5 ml-1" />
        </>
      )}
    </Button>
  )

  // ─── Security Notice ───
  const securityNotice = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="w-full bg-gray-50 border border-[#E0E0E0] rounded-xl p-4 flex items-start gap-3"
    >
      <Shield className="h-5 w-5 text-[#6B7280] shrink-0 mt-0.5" />
      <p className="text-xs text-[#6B7280] leading-relaxed">
        Zylod will never ask for your account password or other sensitive details via SMS or email.
      </p>
    </motion.div>
  )

  // ─── Mobile Layout ───
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E0E0E0]">
          <button
            onClick={goBack}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-[#1A1A1A]" />
          </button>
          <h1 className="text-lg font-bold text-[#C8102E]">Zylod</h1>
          <button
            onClick={() => navigate('help-center')}
            className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            {/* Hero Section */}
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center">
                <div className="relative">
                  {getIcon()}
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C8102E] flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">1</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-[25px] font-bold text-[#1A1A1A] text-center mb-2">
              Verify Your Identity
            </h2>
            <p className="text-[15px] text-[#6B7280] text-center mb-8 max-w-xs leading-relaxed">
              We&apos;ve sent a code {getPurposeLabel()} to{' '}
              <span className="font-medium text-[#1A1A1A]">{phoneOrEmail ? maskTarget(phoneOrEmail) : "your registered contact"}</span>. Please enter the 6-digit
              code below to continue.
            </p>

            {/* OTP Input */}
            <div className="w-full mb-6">
              {otpInputSection}
            </div>

            {/* Error Message */}
            {errorMessage && <div className="w-full mb-4">{errorMessage}</div>}

            {/* Resend */}
            <div className="mb-6 w-full">
              {resendSection}
            </div>

            {/* Verify Button */}
            {verifyButton}

            {/* Security Notice */}
            <div className="mt-8">
              {securityNotice}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ─── Desktop Layout ───
  if (isMobile === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={goBack}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-[#1A1A1A]" />
            </button>
            <h1 className="text-lg font-bold text-[#C8102E]">Zylod</h1>
            <button
              onClick={() => navigate('help-center')}
              className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5 text-[#6B7280]" />
            </button>
          </div>

          {/* Hero Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-5">
              <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center">
                <div className="relative">
                  {getIcon()}
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C8102E] flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">1</span>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-[26px] font-bold text-[#1A1A1A] text-center mb-2">
              Verify Your Identity
            </h2>
            <p className="text-[15px] text-[#6B7280] text-center max-w-xs leading-relaxed">
              We&apos;ve sent a code {getPurposeLabel()} to{' '}
              <span className="font-medium text-[#1A1A1A]">{phoneOrEmail ? maskTarget(phoneOrEmail) : "your registered contact"}</span>. Please enter the 6-digit
              code below to continue.
            </p>
          </div>

          {/* OTP Input */}
          <div className="mb-6">
            {otpInputSection}
          </div>

          {/* Error Message */}
          {errorMessage && <div className="mb-4">{errorMessage}</div>}

          {/* Resend */}
          <div className="mb-6">
            {resendSection}
          </div>

          {/* Verify Button */}
          {verifyButton}

          {/* Security Notice */}
          <div className="mt-8">
            {securityNotice}
          </div>
        </motion.div>
      </div>
    )
  }

  // ─── SSR Loading State ───
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-28 h-28 rounded-full bg-[#FFE4E6]" />
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

export { OtpVerificationPage }
