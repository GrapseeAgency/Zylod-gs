'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'
import {
  ArrowLeft,
  HelpCircle,
  ShieldCheck,
  Shield,
  Truck,
  Lock,
  ChevronDown,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

/* ─── Country codes ─── */
const COUNTRY_CODES = [
  { code: '+880', label: 'BD', pattern: /^1\d{9}$/, placeholder: '1XXX-XXXXXX', hint: '11 digits starting with 1' },
  { code: '+91', label: 'IN', pattern: /^[6-9]\d{9}$/, placeholder: '9XXX-XXXXXX', hint: '10 digits starting with 6-9' },
  { code: '+1', label: 'US', pattern: /^[2-9]\d{9}$/, placeholder: '2XX-XXX-XXXX', hint: '10 digits' },
  { code: '+44', label: 'UK', pattern: /^[1-9]\d{9,10}$/, placeholder: '7XXX-XXXXXX', hint: '10-11 digits' },
  { code: '+86', label: 'CN', pattern: /^1[3-9]\d{9}$/, placeholder: '1XX-XXXX-XXXX', hint: '11 digits starting with 1' },
  { code: '+65', label: 'SG', pattern: /^[689]\d{7}$/, placeholder: '8XXX-XXXX', hint: '8 digits starting with 6/8/9' },
]

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

/* ─── Feature Card ─── */
function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  description: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex gap-3 p-4 rounded-xl bg-white border border-[#E0E0E0]"
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#F3F4F6] flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-[#1A1A1A]">{title}</h4>
        <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  )
}

/* ─── Main Page Component ─── */
export default function PhoneVerificationPage() {
  const isMobile = useIsMobile()
  const { navigate, goBack, pageParams } = useNavigationStore()
  const [countryCode, setCountryCode] = useState('+880')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCountry = useMemo(
    () => COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0],
    [countryCode]
  )

  // Phone validation
  const isPhoneValid = useMemo(() => {
    if (!phoneNumber) return false
    return selectedCountry.pattern.test(phoneNumber.replace(/[-\s]/g, ''))
  }, [phoneNumber, selectedCountry])

  const showValidation = phoneNumber.length > 0

  const handleSendCode = async () => {
    const cleanPhone = phoneNumber.replace(/[-\s]/g, '')
    if (!cleanPhone) {
      setError('Please enter your phone number')
      return
    }

    if (!selectedCountry.pattern.test(cleanPhone)) {
      setError(`Invalid phone number format for ${selectedCountry.label}. ${selectedCountry.hint}`)
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          countryCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send verification code')
        return
      }

      const fullPhone = `${countryCode}${cleanPhone}`
      toast.success('Verification code sent!', {
        description: `Code sent to ${fullPhone}`,
      })

      navigate('otp-verification', {
        phone: fullPhone,
        phoneOrEmail: fullPhone,
        purpose: 'phone_verify',
      })
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhoneChange = (value: string) => {
    // Only allow digits, hyphens, spaces
    const cleaned = value.replace(/[^\d-\s]/g, '')
    setPhoneNumber(cleaned)
    if (error) setError(null)
  }

  /* ─── Phone Input Card ─── */
  const phoneInputCard = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E0E0E0]">
      <Label className="text-sm font-medium text-[#1A1A1A] mb-2.5 block">
        Phone Number
      </Label>
      <div className="flex gap-2">
        {/* Country Code Selector */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 h-11 px-3 rounded-lg bg-[#F3F4F6] border border-[#E0E0E0] text-sm font-medium text-[#1A1A1A] min-w-[80px] justify-between"
            type="button"
            aria-label="Select country code"
          >
            <span>{countryCode}</span>
            <ChevronDown className="w-4 h-4 text-[#6B7280]" />
          </button>
          {isDropdownOpen && (
            <div className="absolute top-12 left-0 z-10 bg-white rounded-lg shadow-lg border border-[#E0E0E0] py-1 min-w-[140px]">
              {COUNTRY_CODES.map((country) => (
                <button
                  key={country.code}
                  onClick={() => {
                    setCountryCode(country.code)
                    setIsDropdownOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm text-[#1A1A1A] hover:bg-[#F3F4F6] transition-colors ${
                    countryCode === country.code ? 'bg-[#FFE4E6] font-semibold' : ''
                  }`}
                  type="button"
                >
                  {country.code} ({country.label})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phone Number Input */}
        <div className="flex-1 relative">
          <Input
            type="tel"
            placeholder={selectedCountry.placeholder}
            value={phoneNumber}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className={`h-11 bg-[#F3F4F6] border-[#E0E0E0] rounded-lg text-sm placeholder:text-[#9CA3AF] pr-10 ${
              showValidation && isPhoneValid ? 'border-green-400 focus-visible:border-green-400' : ''
            } ${
              showValidation && !isPhoneValid && phoneNumber.length >= 3 ? 'border-red-400 focus-visible:border-red-400' : ''
            }`}
          />
          {showValidation && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isPhoneValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : phoneNumber.length >= 3 ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Validation hint */}
      {showValidation && !isPhoneValid && phoneNumber.length >= 3 && (
        <p className="text-xs text-red-500 mt-1.5">
          {selectedCountry.hint}
        </p>
      )}
      {showValidation && isPhoneValid && (
        <p className="text-xs text-green-600 mt-1.5">
          Valid phone number
        </p>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200"
        >
          <p className="text-sm text-red-600">{error}</p>
        </motion.div>
      )}
    </div>
  )

  /* ─── Primary Button ─── */
  const sendButton = (
    <Button
      onClick={handleSendCode}
      disabled={isLoading || !isPhoneValid}
      className="w-full h-[50px] bg-[#C8102E] hover:bg-[#A50D24] text-white rounded-xl text-base font-semibold shadow-md disabled:opacity-50"
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          Send Verification Code
          <Play className="w-4 h-4 ml-2 fill-current" />
        </>
      )}
    </Button>
  )

  /* ─── Feature Cards ─── */
  const featureCards = (
    <div className="mt-6 space-y-3">
      <FeatureCard
        icon={<Truck className="w-5 h-5 text-[#C8102E]" />}
        title="Secure Shipping"
        description="Couriers use this number to coordinate large-scale wholesale deliveries directly to your warehouse."
        delay={0.1}
      />
      <FeatureCard
        icon={<ShieldCheck className="w-5 h-5 text-[#C8102E]" />}
        title="Fraud Prevention"
        description="A verified number protects your account from unauthorized bulk orders and ensures business identity."
        delay={0.2}
      />
    </div>
  )

  /* ─── Security Footer ─── */
  const securityFooter = (
    <div className="flex flex-col items-center gap-3 mt-6">
      <div className="flex items-center justify-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-[#9CA3AF]" />
        <p className="text-xs text-[#9CA3AF]">
          Your data is encrypted and never shared with third parties.
        </p>
      </div>
      {/* Trust badge icons row */}
      <div className="flex items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] border border-[#E0E0E0] flex items-center justify-center">
          <Shield className="w-5 h-5 text-[#6B7280]" />
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] border border-[#E0E0E0] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[#6B7280]" />
        </div>
        <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] border border-[#E0E0E0] flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-[#6B7280]" />
        </div>
      </div>
    </div>
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
          {/* Hero Section */}
          <motion.div variants={fadeSlideUp} className="flex flex-col items-center mt-6 mb-6">
            <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center mb-5">
              <ShieldCheck className="w-14 h-14 text-[#C8102E]" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] text-center">
              Verify your number
            </h1>
            <p className="text-sm text-[#6B7280] text-center mt-2 max-w-xs leading-relaxed">
              To keep your wholesale account secure and ensure accurate delivery logistics.
            </p>
          </motion.div>

          {/* Phone Input Card */}
          <motion.div variants={fadeSlideUp} className="mb-5">
            {phoneInputCard}
          </motion.div>

          {/* Primary Button */}
          <motion.div variants={fadeSlideUp}>
            {sendButton}
          </motion.div>

          {featureCards}
          {securityFooter}
        </motion.div>
      </div>
    )
  }

  /* ─── Desktop Layout ─── */
  if (isMobile === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <HeaderBar onBack={goBack} />

        <div className="flex-1 flex items-start justify-center pt-8 pb-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Hero Section */}
            <div className="flex flex-col items-center mt-4 mb-6">
              <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center mb-5">
                <ShieldCheck className="w-14 h-14 text-[#C8102E]" strokeWidth={1.5} />
              </div>
              <h1 className="text-2xl font-bold text-[#1A1A1A] text-center">
                Verify your number
              </h1>
              <p className="text-sm text-[#6B7280] text-center mt-2 max-w-xs leading-relaxed">
                To keep your wholesale account secure and ensure accurate delivery logistics.
              </p>
            </div>

            {/* Phone Input Card */}
            <div className="mb-5">
              {phoneInputCard}
            </div>

            {sendButton}
            {featureCards}
            {securityFooter}
          </motion.div>
        </div>
      </div>
    )
  }

  /* ─── SSR Loading State ─── */
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

export { PhoneVerificationPage }
