'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMathCaptcha, isRateLimited, recordFailedAttempt, resetRateLimit, useCountdown } from '@/lib/auth-security'
import { openProviderConsent, exchangeSocialConsent, type SocialProvider } from '@/lib/social-auth'
import type { LoginApiResponse } from '@/lib/auth-api-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'

/* ─── Types ─── */
// Response shapes live in @/lib/auth-api-types (shared with the service layer).

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
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
}

/* ─── Google SVG icon ─── */
function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.28v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

/* ─── Facebook SVG icon ─── */
function FacebookIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

/* ─── Rate Limit Lockout Overlay ─── */
function LockoutOverlay({ remainingMs }: { remainingMs: number }) {
  const seconds = Math.ceil(remainingMs / 1000)
  const { remaining, formatted } = useCountdown(seconds)

  if (remaining <= 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-[#FEF2F2] border border-[#C8102E]/20 rounded-xl p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#C8102E]/10 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-[#C8102E]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#C8102E]">Account Temporarily Locked</h3>
          <p className="text-xs text-[#6B7280] mt-1">
            Too many failed login attempts. Please try again in{' '}
            <span className="font-mono font-bold text-[#C8102E]">{formatted}</span>
          </p>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Main Login Page ─── */
export function LoginPage() {
  const isMobile = useIsMobile()
  const { navigate } = useNavigationStore()
  const { login } = useAuthStore()

  const [activeTab, setActiveTab] = useState<'buyer' | 'supplier'>('buyer')
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)
  const [rateLimitState, setRateLimitState] = useState<{ limited: boolean; remainingMs: number; attemptsRemaining: number }>({ limited: false, remainingMs: 0, attemptsRemaining: 5 })

  // Captcha hook — single instance used for both display and validation
  const { captcha, userAnswer, setUserAnswer, isValid, validate, refresh } = useMathCaptcha()

  // Check rate limit on mount
  useEffect(() => {
    const check = isRateLimited()
    setRateLimitState(check)
    // If there were previous failed attempts, load count
    const stored = localStorage.getItem('zylod-auth-ratelimit')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.attempts >= 2) {
          setShowCaptcha(true)
          setFailedAttempts(parsed.attempts)
        }
      } catch { /* ignore */ }
    }
  }, [])

  /* ─── Form submit handler ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!emailOrPhone.trim() || !password.trim()) {
      setError('Please enter your email/phone and password')
      return
    }

    // Check rate limit
    const rlCheck = isRateLimited()
    setRateLimitState(rlCheck)
    if (rlCheck.limited) {
      setError('Account temporarily locked due to too many failed attempts')
      return
    }

    // Validate CAPTCHA if visible
    if (showCaptcha) {
      if (!userAnswer.trim()) {
        setError('Please solve the math verification')
        return
      }
      if (!validate()) {
        setError('Incorrect answer. Please try the new question.')
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      // Determine if input is email or phone
      const isEmail = emailOrPhone.includes('@')
      const payload: Record<string, string> = { password }
      if (isEmail) {
        payload.email = emailOrPhone.trim()
      } else {
        payload.phone = emailOrPhone.trim()
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data: LoginApiResponse = await res.json()

      if (!res.ok) {
        // Handle specific error codes
        if (res.status === 401) {
          const newFailed = failedAttempts + 1
          setFailedAttempts(newFailed)
          recordFailedAttempt()
          setRateLimitState(isRateLimited())
          // Show CAPTCHA after 2 failed attempts
          if (newFailed >= 2) {
            setShowCaptcha(true)
          }
          setError(data.error || 'Invalid email/phone or password')
          if (isRateLimited().limited) {
            setError('Too many failed attempts. Account temporarily locked.')
          }
        } else if (res.status === 403) {
          navigate('account-suspended', {
            email: emailOrPhone.includes('@') ? emailOrPhone.trim() : '',
            reason: data.suspension?.reason || '',
            reference: data.suspension?.reference || '',
            status: data.accountStatus || 'suspended',
          })
          return
        } else if (res.status === 404) {
          setError('No account found with this email/phone')
          recordFailedAttempt()
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        setIsLoading(false)
        return
      }

      // Success — reset rate limit
      resetRateLimit()
      setRateLimitState({ limited: false, remainingMs: 0, attemptsRemaining: 5 })

      // Two-factor challenge — session withheld until the code is verified
      if (data.requires2FA && data.userId) {
        toast.info('Security verification required', {
          description: 'Enter your two-factor authentication code to continue.',
        })
        navigate('two-factor-auth', {
          flow: 'login',
          userId: data.userId,
          methods: (data.methods || ['authenticator']).join(','),
          hasPhone: String(Boolean(data.hasPhone)),
          maskedPhone: data.maskedPhone || '',
        })
        return
      }

      if (data.user && data.token) {
        const user = data.user

        // Check 2FA requirement
        if (user.requires2FA) {
          navigate('two-factor-auth', { token: data.token, userId: user.id })
          return
        }

        // Build the user profile for auth store
        const userProfile = {
          id: user.id,
          userType: user.userType as 'buyer' | 'supplier' | 'admin' | null,
          email: user.email || null,
          phone: user.phone || null,
          fullName: null,
          businessName: null,
          avatarUrl: null,
          isProfileComplete: false,
          profileCompletionPct: 0,
        }

        login(userProfile, data.token)

        // Navigate based on user type
        if (user.userType === 'supplier') {
          navigate('supplier-dashboard')
        } else if (user.userType === 'admin') {
          navigate('admin-dashboard')
        } else {
          navigate('home')
        }

        toast.success('Welcome back!', {
          description: 'You have been logged in successfully.',
        })
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  /* ─── Social login handler ─── */
  const handleSocialLogin = async (provider: SocialProvider) => {
    setError(null)
    setSocialLoading(provider)

    try {
      // Step 1: provider consent — yields the verified account identity
      const consent = await openProviderConsent(provider)

      if (!consent) {
        setSocialLoading(null)
        return
      }

      // Step 2: exchange with the backend for a real session
      const result = await exchangeSocialConsent(provider, consent)

      if (!result.success) {
        if (result.suspended) {
          navigate('account-suspended', {
            email: consent.email,
            reason: result.suspended.reason,
            reference: result.suspended.reference,
            status: 'suspended',
          })
          setSocialLoading(null)
          return
        }
        setError(result.error || 'Sign-in failed. Please try again.')
        setSocialLoading(null)
        return
      }

      resetRateLimit()

      // Two-factor challenge after social sign-in
      if (result.requires2FA && result.userId) {
        navigate('two-factor-auth', {
          flow: 'login',
          userId: result.userId,
          methods: 'authenticator,sms',
          hasPhone: 'true',
          maskedPhone: '',
        })
        setSocialLoading(null)
        return
      }

      if (result.user && result.token) {
        const user = result.user
        login(
          {
            id: user.id,
            userType: user.userType as 'buyer' | 'supplier' | 'admin' | null,
            email: user.email || null,
            phone: user.phone || null,
            fullName: null,
            businessName: null,
            avatarUrl: null,
            isProfileComplete: false,
            profileCompletionPct: 0,
          },
          result.token
        )

        toast.success('Welcome back!', {
          description: `Signed in with ${provider === 'google' ? 'Google' : 'Facebook'}.`,
        })

        if (user.userType === 'supplier') {
          navigate('supplier-dashboard')
        } else if (user.userType === 'admin') {
          navigate('admin-dashboard')
        } else {
          navigate('home')
        }
      }
    } catch {
      setError('Social sign-in failed. Please try again.')
    } finally {
      setSocialLoading(null)
    }
  }

  /* ─── Shared card content ─── */
  const cardContent = (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-2xl shadow-lg border border-[#E0E0E0]/60 overflow-hidden"
    >
      <div className="p-6 sm:p-8 space-y-6">
        {/* ─── Logo Section ─── */}
        <motion.div variants={itemVariants} custom={0} className="flex flex-col items-center gap-3">
          <img
            src="/zylod-logo.svg"
            alt="Zylod"
            className="w-44 sm:w-56 h-auto"
          />
          <p className="text-sm text-[#6B7280] mt-1 text-center">
            Efficient B2B Sourcing Starts Here
          </p>
        </motion.div>

        {/* ─── Tab Selector: Buyer / Supplier ─── */}
        <motion.div variants={itemVariants} custom={1} className="flex justify-center">
          <div className="flex w-full max-w-[260px] border-b border-[#E0E0E0]">
            <button
              type="button"
              onClick={() => setActiveTab('buyer')}
              className={`flex-1 pb-2.5 text-sm font-semibold text-center transition-colors relative ${
                activeTab === 'buyer'
                  ? 'text-[#C8102E]'
                  : 'text-[#6B7280] hover:text-[#1A1A1A]'
              }`}
            >
              Buyer
              {activeTab === 'buyer' && (
                <motion.div
                  layoutId="login-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C8102E] rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('supplier')}
              className={`flex-1 pb-2.5 text-sm font-semibold text-center transition-colors relative ${
                activeTab === 'supplier'
                  ? 'text-[#C8102E]'
                  : 'text-[#6B7280] hover:text-[#1A1A1A]'
              }`}
            >
              Supplier
              {activeTab === 'supplier' && (
                <motion.div
                  layoutId="login-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C8102E] rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          </div>
        </motion.div>

        {/* ─── Login Form ─── */}
        <motion.form variants={itemVariants} custom={2} onSubmit={handleSubmit} className="space-y-4">
          {/* Email or Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-sm font-medium text-[#1A1A1A]">
              Email or Phone Number
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#6B7280]" />
              <Input
                id="login-email"
                type="text"
                placeholder="name@company.com"
                value={emailOrPhone}
                onChange={(e) => { setEmailOrPhone(e.target.value); setError(null) }}
                disabled={isLoading || rateLimitState.limited}
                className="pl-10 h-11 bg-[#F8F9FA] border-[#E0E0E0] rounded-lg text-[#1A1A1A] placeholder:text-[#9CA3AF] focus-visible:ring-[#C8102E]/30 focus-visible:border-[#C8102E]"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="login-password" className="text-sm font-medium text-[#1A1A1A]">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#6B7280]" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                disabled={isLoading || rateLimitState.limited}
                className="pl-10 pr-10 h-11 bg-[#F8F9FA] border-[#E0E0E0] rounded-lg text-[#1A1A1A] placeholder:text-[#9CA3AF] focus-visible:ring-[#C8102E]/30 focus-visible:border-[#C8102E]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {/* Rate limit lockout message */}
          <AnimatePresence>
            {rateLimitState.limited && (
              <LockoutOverlay remainingMs={rateLimitState.remainingMs} />
            )}
          </AnimatePresence>

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

          {/* Attempts remaining indicator */}
          {failedAttempts > 0 && !rateLimitState.limited && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-[#6B7280] flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-[#F97316]" />
              {rateLimitState.attemptsRemaining} attempt{rateLimitState.attemptsRemaining !== 1 ? 's' : ''} remaining before lockout
            </motion.p>
          )}

          {/* Math CAPTCHA — shown after 2 failed attempts */}
          <AnimatePresence>
            {showCaptcha && !rateLimitState.limited && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label className="text-sm font-medium text-[#1A1A1A] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#C8102E]" />
                  Verify you&apos;re human
                </Label>
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
          </AnimatePresence>

          {/* Forgot Password */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('forgot-password')}
              className="text-sm font-medium text-[#C8102E] hover:text-[#A00D24] transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            disabled={isLoading || rateLimitState.limited}
            className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A00D24] text-white font-semibold text-base rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Logging in...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Login
                <ArrowRight className="h-5 w-5" />
              </span>
            )}
          </Button>
        </motion.form>

        {/* ─── Divider ─── */}
        <motion.div variants={itemVariants} custom={3} className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E0E0E0]" />
          <span className="text-xs font-medium text-[#6B7280] tracking-wider uppercase">
            Or continue with
          </span>
          <div className="flex-1 h-px bg-[#E0E0E0]" />
        </motion.div>

        {/* ─── Social Login Buttons ─── */}
        <motion.div variants={itemVariants} custom={4} className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={socialLoading !== null}
            className="flex-1 h-11 bg-white border-[#E0E0E0] hover:bg-[#F8F9FA] rounded-lg text-[#1A1A1A] font-medium text-sm shadow-sm disabled:opacity-60"
            onClick={() => handleSocialLogin('google')}
          >
            {socialLoading === 'google' ? (
              <span className="w-5 h-5 border-2 border-[#E0E0E0] border-t-[#4285F4] rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span className="ml-2">Google</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={socialLoading !== null}
            className="flex-1 h-11 bg-white border-[#E0E0E0] hover:bg-[#F8F9FA] rounded-lg text-[#1A1A1A] font-medium text-sm shadow-sm disabled:opacity-60"
            onClick={() => handleSocialLogin('facebook')}
          >
            {socialLoading === 'facebook' ? (
              <span className="w-5 h-5 border-2 border-[#E0E0E0] border-t-[#1877F2] rounded-full animate-spin" />
            ) : (
              <FacebookIcon />
            )}
            <span className="ml-2">Facebook</span>
          </Button>
        </motion.div>

        {/* ─── Footer ─── */}
        <motion.div variants={itemVariants} custom={5} className="text-center pt-2">
          <p className="text-sm text-[#6B7280]">
            New to Zylod?{' '}
            <button
              type="button"
              onClick={() => navigate('register')}
              className="text-[#C8102E] font-semibold hover:text-[#A00D24] transition-colors"
            >
              Register Now
            </button>
          </p>
        </motion.div>

        {/* ─── Help Link ─── */}
        <motion.div variants={itemVariants} custom={6} className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => navigate('help-center')}
            className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#C8102E] transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Need help logging in?
          </button>
        </motion.div>
      </div>
    </motion.div>
  )

  /* ─── Mobile Layout ─── */
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px]">
          {cardContent}
        </div>
      </div>
    )
  }

  /* ─── Desktop Layout ─── */
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {cardContent}
      </div>
    </div>
  )
}

export default LoginPage
