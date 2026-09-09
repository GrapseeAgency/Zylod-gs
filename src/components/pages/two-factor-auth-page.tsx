'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCountdown } from '@/lib/auth-security'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  HelpCircle,
  Shield,
  ShieldCheck,
  Lock,
  Smartphone,
  MessageSquare,
  Loader2,
  Copy,
  CheckCircle2,
} from 'lucide-react'

type TwoFAMethod = 'authenticator' | 'sms'
type SetupStep = 'select' | 'setup' | 'verify'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
  }),
}

export function TwoFactorAuthPage() {
  const { goBack, navigate, pageParams } = useNavigationStore()
  const { user: storeUser, token: storeToken, login: authLogin } = useAuthStore()
  const isMobile = useIsMobile()

  // flow: 'login' = completing a sign-in that requires the 2FA code;
  //       undefined = enabling 2FA on an already-authenticated account.
  const flow = pageParams.flow || ''
  const userId = pageParams.userId || storeUser?.id || ''
  const challengeMethods = String(pageParams.methods || 'authenticator').split(',')
  const hasPhoneParam = pageParams.hasPhone === 'true'
  const maskedPhone = pageParams.maskedPhone || ''

  // Bearer for authenticated setup calls: login-flow tokens arrive via params.
  const bearerToken = storeToken || ''

  const isLoginChallenge = flow === 'login'

  const availableMethods: TwoFAMethod[] = isLoginChallenge
    ? [
        ...(challengeMethods.includes('authenticator') ? ['authenticator' as const] : []),
        ...(hasPhoneParam ? ['sms' as const] : []),
      ]
    : ['authenticator', 'sms']

  const [selectedMethod, setSelectedMethod] = useState<TwoFAMethod>(availableMethods[0])
  const [step, setStep] = useState<SetupStep>(isLoginChallenge ? 'verify' : 'select')
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Server-issued enrollment data (never generated client-side)
  const [secretKey, setSecretKey] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  // Resend countdown for SMS
  const { isRunning: smsIsRunning, reset: resetSmsCountdown, formatted: smsFormatted } = useCountdown(60)

  useEffect(() => {
    if (!availableMethods.includes(selectedMethod)) {
      setSelectedMethod(availableMethods[0])
    }
     
  }, [])

  /** Auth headers when we hold a session (settings flow); challenge flow sends none. */
  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (bearerToken) h.Authorization = `Bearer ${bearerToken}`
    return h
  }

  // ─── Begin setup (enrollment only) ───
  const handleSetup = useCallback(async () => {
    if (!userId) {
      setError('User ID is required. Please log in first.')
      return
    }

    setIsSettingUp(true)
    setError(null)

    try {
      if (selectedMethod === 'sms') {
        const res = await fetch('/api/auth/2fa/setup', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ userId, method: 'sms' }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to send verification code')
          return
        }
        toast.success('Verification code sent to your phone!')
        resetSmsCountdown()
        setStep('verify')
        return
      }

      // Authenticator enrollment — server generates secret + otpauth URI
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId, method: 'authenticator' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start authenticator setup')
        return
      }
      setSecretKey(data.secret)
      setOtpauthUri(data.otpauth)
      setStep('setup')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSettingUp(false)
    }
     
  }, [userId, selectedMethod, bearerToken, resetSmsCountdown])

  // ─── Verify code (both enrollment confirmation and login challenge) ───
  const handleVerify = useCallback(async () => {
    if (otp.length < 6) {
      setError('Please enter all 6 digits')
      return
    }
    if (!userId) {
      setError('Missing user context. Please restart the flow.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: otp,
          method: selectedMethod === 'sms' && smsIsRunning !== undefined ? selectedMethod : selectedMethod,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'ACCOUNT_SUSPENDED') {
          navigate('account-suspended', {
            reason: data.suspension?.reason || '',
            reference: data.suspension?.reference || '',
            status: data.accountStatus || 'suspended',
          })
          return
        }
        setError(data.error || 'Verification failed. Please try again.')
        setOtp('')
        return
      }

      if (isLoginChallenge) {
        // Complete the withheld sign-in with the freshly issued session
        if (data.user && data.token) {
          authLogin(
            {
              id: data.user.id,
              userType: data.user.userType as 'buyer' | 'supplier' | 'admin' | null,
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
          toast.success('Identity confirmed!', {
            description: 'Welcome back to Zylod.',
          })
          navigate(
            data.user.userType === 'supplier'
              ? 'supplier-dashboard'
              : data.user.userType === 'admin'
                ? 'admin-dashboard'
                : 'home'
          )
          return
        }
        setError('Sign-in could not be completed. Please try again.')
        setOtp('')
        return
      }

      toast.success('2FA enabled successfully!', {
        description: 'Your account is now protected with two-factor authentication.',
      })
      navigate('backup-codes', { userId, method: selectedMethod })
    } catch {
      setError('Network error. Please check your connection and try again.')
      setOtp('')
    } finally {
      setIsSubmitting(false)
    }
  }, [otp, userId, selectedMethod, isLoginChallenge, smsIsRunning, authLogin, navigate])

  // ─── Resend SMS Code (challenge mode reuses the setup route; it issues a new code) ───
  const handleResendSms = useCallback(async () => {
    if (smsIsRunning) return
    setIsSettingUp(true)

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId, method: 'sms' }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to resend code')
        return
      }

      toast.success('New verification code sent!')
      setOtp('')
      resetSmsCountdown()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsSettingUp(false)
    }
     
  }, [userId, smsIsRunning, resetSmsCountdown, bearerToken])

  // ─── Copy Secret Key ───
  const handleCopyKey = useCallback(() => {
    navigator.clipboard.writeText(secretKey).then(() => {
      setIsCopied(true)
      toast.success('Secret key copied to clipboard!')
      setTimeout(() => setIsCopied(false), 2000)
    }).catch(() => {
      toast.error('Failed to copy. Please select and copy manually.')
    })
  }, [secretKey])

  // ─── Header Bar ───
  const headerBar = (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 bg-white border-b border-[#E0E0E0]">
      <button
        onClick={
          isLoginChallenge
            ? goBack
            : step === 'select'
              ? goBack
              : step === 'verify' && !isLoginChallenge
                ? () => { setStep(selectedMethod === 'authenticator' ? 'setup' : 'select'); setOtp(''); setError(null) }
                : () => { setStep('select'); setOtp(''); setError(null); setSecretKey(''); setOtpauthUri('') }
        }
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

  // ─── Hero Section ───
  const heroSection = (
    <motion.div
      custom={0}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center pt-8 pb-2"
    >
      <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center">
        <div className="relative">
          <Shield className="w-12 h-12 text-[#C8102E]" />
          <Lock className="w-5 h-5 text-[#C8102E] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    </motion.div>
  )

  // ─── Heading ───
  const heading = (
    <motion.div
      custom={1}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="text-center px-6 pb-2"
    >
      <h1 className="text-[24px] leading-tight font-bold text-[#1A1A1A]">
        {isLoginChallenge
          ? 'Two-Factor Verification'
          : step === 'select'
            ? 'Protect Your Account'
            : step === 'setup'
              ? 'Set Up Authenticator'
              : 'Verify Code'}
      </h1>
      <p className="text-[15px] text-[#6B7280] mt-2 leading-relaxed">
        {isLoginChallenge
          ? selectedMethod === 'sms'
            ? maskedPhone
              ? `Enter the 6-digit code we sent to ${maskedPhone}.`
              : 'Enter the 6-digit code sent to your registered phone.'
            : 'Enter the 6-digit code from your authenticator app to finish signing in.'
          : step === 'select'
            ? 'Choose a second layer of security to keep your wholesale transactions safe.'
            : step === 'setup'
              ? 'Scan the QR code with your authenticator app, or enter the key manually.'
              : selectedMethod === 'authenticator'
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Enter the 6-digit code sent to your phone.'}
      </p>
    </motion.div>
  )

  // ─── Method Selection Cards ───
  const methodCards = (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-4 space-y-3"
    >
      {/* Authenticator App Card */}
      <button
        onClick={() => setSelectedMethod('authenticator')}
        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all bg-white ${
          selectedMethod === 'authenticator'
            ? 'border-[#C8102E] shadow-md'
            : 'border-[#E0E0E0] shadow-sm'
        }`}
        type="button"
      >
        <div className="w-12 h-12 rounded-lg bg-[#FFE4E6] flex items-center justify-center shrink-0">
          <Smartphone className="w-6 h-6 text-[#C8102E]" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-[#1A1A1A]">Authenticator App</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">
            Use Google Authenticator or Authy for maximum security without cellular signal.
          </p>
        </div>
        <div className="shrink-0 ml-2">
          {selectedMethod === 'authenticator' ? (
            <div className="w-5 h-5 rounded-full bg-[#C8102E] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB]" />
          )}
        </div>
      </button>

      {/* SMS Message Card */}
      <button
        onClick={() => setSelectedMethod('sms')}
        disabled={!availableMethods.includes('sms')}
        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all bg-white ${
          selectedMethod === 'sms'
            ? 'border-[#C8102E] shadow-md'
            : 'border-[#E0E0E0] shadow-sm'
        } ${!availableMethods.includes('sms') ? 'opacity-50 cursor-not-allowed' : ''}`}
        type="button"
      >
        <div className="w-12 h-12 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
          <MessageSquare className="w-6 h-6 text-[#6B7280]" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-[#1A1A1A]">SMS Message</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">
            {availableMethods.includes('sms')
              ? 'Receive a 6-digit code via text message to your registered phone number.'
              : 'No phone number on this account. Add one in Profile to enable SMS codes.'}
          </p>
        </div>
        <div className="shrink-0 ml-2">
          {selectedMethod === 'sms' ? (
            <div className="w-5 h-5 rounded-full bg-[#C8102E] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB]" />
          )}
        </div>
      </button>

      {/* Continue Button */}
      <Button
        onClick={handleSetup}
        disabled={isSettingUp}
        className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D25] text-white rounded-xl text-base font-semibold disabled:opacity-50"
      >
        {isSettingUp ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Setting up...
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </motion.div>
  )

  // ─── Authenticator Setup Section (real server-issued QR) ───
  const authenticatorSetup = (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-4 space-y-4"
    >
      <Card className="rounded-xl shadow-md border-0 bg-white py-0 gap-0">
        <CardContent className="p-5 flex flex-col items-center">
          {/* Live QR encoding the server's otpauth:// enrollment URI */}
          <div className="bg-white p-3 rounded-xl mb-4">
            {otpauthUri ? (
              <QRCodeSVG value={otpauthUri} size={168} level="M" />
            ) : (
              <div className="w-[168px] h-[168px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#C8102E] animate-spin" />
              </div>
            )}
          </div>
          <p className="text-xs text-[#6B7280] -mt-2 mb-4">
            Scan with Google Authenticator / Authy
          </p>

          {/* Manual Entry Key */}
          <div className="w-full">
            <p className="text-xs font-semibold text-[#1A1A1A] mb-2">Manual Entry Key</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#F3F4F6] rounded-lg p-3 font-mono text-xs text-[#1A1A1A] break-all leading-relaxed">
                {secretKey || '...'}
              </div>
              <button
                onClick={handleCopyKey}
                className="p-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors shrink-0"
                aria-label="Copy secret key"
                type="button"
              >
                {isCopied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-[#6B7280]" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Continue to Verify Button */}
      <Button
        onClick={() => setStep('verify')}
        className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D25] text-white rounded-xl text-base font-semibold"
      >
        I&apos;ve Set Up My Authenticator
      </Button>
    </motion.div>
  )

  // ─── Verification Code Section ───
  const verificationSection = (
    <motion.div
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-4"
    >
      <Card className="rounded-xl shadow-md border-0 bg-white py-0 gap-0">
        <CardContent className="p-5 space-y-4">
          {/* Label row */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1A1A1A]">
              Verification Code
            </p>
            {selectedMethod === 'sms' ? (
              smsIsRunning ? (
                <span className="text-[13px] text-[#C8102E] font-semibold">
                  Resend in {smsFormatted}
                </span>
              ) : (
                <button
                  className="text-[13px] font-semibold text-[#C8102E] hover:underline"
                  onClick={handleResendSms}
                  disabled={isSettingUp}
                  type="button"
                >
                  {isSettingUp ? 'Sending...' : 'Resend Code'}
                </button>
              )
            ) : (
              <button
                className="text-[13px] font-semibold text-[#C8102E] hover:underline"
                onClick={() => setOtp('')}
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(v) => { setOtp(v); if (error) setError(null) }}
              containerClassName="gap-2"
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-12 text-lg border-[#E0E0E0] data-[active=true]:border-[#C8102E] data-[active=true]:ring-[#C8102E]/20 rounded-lg"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Helper text */}
          <p className="text-center text-[12px] text-[#6B7280]">
            {selectedMethod === 'authenticator'
              ? 'Enter the rotating 6-digit code shown in your authenticator app'
              : 'Enter the code sent to your phone'}
          </p>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-red-50 border border-red-200"
            >
              <p className="text-sm text-red-600 text-center">{error}</p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )

  // ─── Primary Button ───
  const secureButton = (
    <motion.div
      custom={4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-5"
    >
      <Button
        onClick={handleVerify}
        disabled={otp.length < 6 || isSubmitting}
        className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D25] text-white rounded-xl text-base font-semibold gap-2 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            {isLoginChallenge ? 'Confirm & Sign In' : 'Secure My Account'}
          </>
        )}
      </Button>
    </motion.div>
  )

  // ─── Footer Trust Badges ───
  const trustBadges = (
    <motion.div
      custom={5}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-6 pb-8"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-xl p-3">
          <Shield className="w-5 h-5 text-[#6B7280] shrink-0" />
          <span className="text-[10px] font-bold text-[#6B7280] tracking-wider leading-tight">
            END-TO-END
            <br />
            ENCRYPTION
          </span>
        </div>

        <div className="flex items-center gap-2 bg-[#F3F4F6] rounded-xl p-3">
          <ShieldCheck className="w-5 h-5 text-[#6B7280] shrink-0" />
          <span className="text-[10px] font-bold text-[#6B7280] tracking-wider leading-tight">
            B2B VERIFIED
            <br />
            SECURITY
          </span>
        </div>
      </div>
    </motion.div>
  )

  // ─── Render the appropriate step content ───
  const stepContent = isLoginChallenge ? (
    <>
      {verificationSection}
      {secureButton}
    </>
  ) : step === 'select' ? (
    methodCards
  ) : step === 'setup' && selectedMethod === 'authenticator' ? (
    authenticatorSetup
  ) : (
    <>
      {verificationSection}
      {secureButton}
    </>
  )

  /* ─── Mobile Layout ─── */
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        {headerBar}
        <main className="flex-1 flex flex-col">
          {heroSection}
          {heading}
          {stepContent}
          {trustBadges}
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
          {stepContent}
          {trustBadges}
        </div>
      </main>
    </div>
  )
}

export default TwoFactorAuthPage
