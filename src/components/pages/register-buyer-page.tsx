'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNavigationStore } from '@/store/navigation-store'
import { setPendingRegistration } from '@/lib/pending-registration'
import { openProviderConsent, exchangeSocialConsent } from '@/lib/social-auth'
import { Phone, ArrowRight, Building2, AlertCircle, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function RegisterBuyerPage() {
  const { navigate } = useNavigationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [usePhone, setUsePhone] = useState(true)

  /** Shared validation for both submit paths. */
  const validate = (): string | null => {
    if (!fullName.trim()) return 'Please enter your full name'
    if (usePhone && !phone.trim()) return 'Please enter your phone number'
    if (!usePhone && !email.trim()) return 'Please enter your email address'
    if (usePhone && phone.replace(/[^\d]/g, '').length < 8) return 'Please enter a valid phone number'
    if (!usePhone && !email.includes('@')) return 'Please enter a valid email address'
    if (!password.trim()) return 'Please enter a password'
    if (password.length < 8) return 'Password must be at least 8 characters'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      // Step 1: send OTP for verification of the chosen contact channel
      const otpRes = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneOrEmail: usePhone ? phone.trim() : email.trim().toLowerCase(),
          purpose: 'register',
        }),
      })

      const otpData = await otpRes.json()

      if (!otpRes.ok) {
        setError(otpData.error === 'User already exists' ? 'An account with this contact already exists — try logging in.' : otpData.error || 'Failed to send OTP')
        return
      }

      // Step 2: carry the registration payload through the OTP step via the
      // session-scoped store (never in the URL), then verify.
      setPendingRegistration({
        userType: 'buyer',
        fullName: fullName.trim(),
        businessName: businessName.trim() || undefined,
        email: usePhone ? undefined : email.trim().toLowerCase(),
        phone: usePhone ? phone.trim() : undefined,
        password,
      })

      toast.success('OTP sent successfully!')
      navigate('otp-verification', {
        phoneOrEmail: usePhone ? phone.trim() : email.trim().toLowerCase(),
        purpose: 'register',
        devCode: otpData.devCode || otpData.otpCode || '',
      })
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleRegister = async () => {
    setError(null)
    setGoogleLoading(true)

    try {
      // Provider consent → real backend exchange creates/links the buyer account.
      const consent = await openProviderConsent('google')
      if (!consent) {
        setGoogleLoading(false)
        return
      }

      const result = await exchangeSocialConsent('google', consent)

      if (!result.success) {
        if (result.suspended) {
          navigate('account-suspended', {
            email: consent.email,
            reason: result.suspended.reason,
            reference: result.suspended.reference,
            status: 'suspended',
          })
          return
        }
        setError(result.error || 'Google sign-up failed. Please try again.')
        return
      }

      if (result.requires2FA && result.userId) {
        navigate('two-factor-auth', { flow: 'login', userId: result.userId, methods: 'authenticator' })
        return
      }

      toast.success('Account ready!', {
        description: `Signed up as ${consent.email}`,
      })
      navigate('home')
    } catch {
      setError('Failed to initiate Google sign-up')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto space-y-6 md:py-8"
    >
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-lg bg-[#C8102E] text-white font-bold text-lg flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Register as Buyer</h1>
        <p className="text-sm text-[#6B7280]">Join Zylod to buy products at wholesale prices</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Create Buyer Account</CardTitle>
          <CardDescription>Enter your details to get started</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name (Optional)</Label>
              <Input
                id="businessName"
                placeholder="Your business/shop name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            {/* Phone/Email Toggle */}
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setUsePhone(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  usePhone ? 'bg-[#C8102E] text-white' : 'bg-[#F8F9FA] text-[#6B7280] border border-[#E0E0E0]'
                }`}
              >
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                Phone
              </button>
              <button
                type="button"
                onClick={() => setUsePhone(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  !usePhone ? 'bg-[#C8102E] text-white' : 'bg-[#F8F9FA] text-[#6B7280] border border-[#E0E0E0]'
                }`}
              >
                <Mail className="w-3.5 h-3.5 inline mr-1" />
                Email
              </button>
            </div>

            {usePhone ? (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+880 1700-000000"
                    className="pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-[#6B7280]">We&apos;ll send a 6-digit OTP to verify your phone number</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-[#6B7280]">We&apos;ll send a verification code to your email</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#C8102E] hover:bg-[#A50D25] text-white" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Send OTP & Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <Separator className="mt-4" />

          <div className="mt-4 space-y-3">
            <Button variant="outline" className="w-full" onClick={handleGoogleRegister} disabled={googleLoading}>
              {googleLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.28v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </Button>
          </div>

          <Separator className="mt-4" />

          <div className="mt-4 text-center">
            <p className="text-sm text-[#6B7280]">
              Already have an account?{' '}
              <Button variant="link" size="sm" className="text-[#C8102E]" onClick={() => navigate('login')}>
                Log In
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
