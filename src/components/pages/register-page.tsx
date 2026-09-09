'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMathCaptcha } from '@/lib/auth-security'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  HelpCircle,
  ShoppingBag,
  Package,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'

/* ─── Role Option ─── */
type Role = 'buyer' | 'supplier' | null

interface RoleCardProps {
  icon: React.ReactNode
  title: string
  description: string
  selected: boolean
  onClick: () => void
}

function RoleCard({ icon, title, description, selected, onClick }: RoleCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all cursor-pointer text-center ${
        selected
          ? 'border-[#C8102E] bg-[#C8102E]/5 shadow-sm'
          : 'border-[#E0E0E0] bg-white hover:border-[#C8102E]/30 hover:bg-[#C8102E]/[0.02]'
      }`}
    >
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
          selected ? 'bg-[#C8102E]/10' : 'bg-[#F3F4F6]'
        }`}
      >
        <div className={selected ? 'text-[#C8102E]' : 'text-[#6B7280]'}>
          {icon}
        </div>
      </div>
      <div>
        <h3
          className={`text-[15px] font-semibold transition-colors ${
            selected ? 'text-[#C8102E]' : 'text-[#1A1A1A]'
          }`}
        >
          {title}
        </h3>
        <p className="text-[13px] text-[#6B7280] mt-1 leading-snug">
          {description}
        </p>
      </div>
    </motion.button>
  )
}

/* ─── Main Register Page ─── */
export function RegisterPage() {
  const { navigate, goBack } = useNavigationStore()
  const isMobile = useIsMobile()
  const [selectedRole, setSelectedRole] = useState<Role>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Captcha hook — single instance used for both display and validation
  const { captcha, userAnswer, setUserAnswer, isValid, validate, refresh } = useMathCaptcha()

  // Check if CAPTCHA answer has been entered (validation happens on button click)
  const hasCaptchaAnswer = userAnswer.trim() !== ''

  // Can continue only if role selected, terms accepted, and CAPTCHA answer provided
  // Actual CAPTCHA validation happens when Continue is clicked
  const canContinue = selectedRole !== null && termsAccepted && hasCaptchaAnswer

  const [captchaError, setCaptchaError] = useState(false)

  const handleContinue = () => {
    if (!canContinue) return

    // Validate CAPTCHA before proceeding
    if (!validate()) {
      setCaptchaError(true)
      setTimeout(() => setCaptchaError(false), 2000)
      return
    }

    navigate(selectedRole === 'buyer' ? 'register-buyer' : 'register-supplier')
  }

  /* ─── Shared content block ─── */
  const contentBlock = (
    <>
      {/* Card Title & Subtitle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-2 mb-8"
      >
        <h2 className={`font-bold text-[#1A1A1A] ${isMobile ? 'text-[22px]' : 'text-[24px]'}`}>
          Join the Marketplace
        </h2>
        <p className="text-[15px] text-[#6B7280] leading-relaxed">
          Start sourcing or selling today. Let&apos;s set up your account.
        </p>
      </motion.div>

      {/* Selection Prompt */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-[15px] font-semibold text-[#1A1A1A] mb-4"
      >
        I want to register as:
      </motion.p>

      {/* Role Cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-3 mb-6"
      >
        <RoleCard
          icon={<ShoppingBag className="w-6 h-6" />}
          title="Buyer"
          description="Buy in bulk for my business"
          selected={selectedRole === 'buyer'}
          onClick={() => setSelectedRole('buyer')}
        />
        <RoleCard
          icon={<Package className="w-6 h-6" />}
          title="Supplier"
          description="Sell my inventory globally"
          selected={selectedRole === 'supplier'}
          onClick={() => setSelectedRole('supplier')}
        />
      </motion.div>

      {/* Math CAPTCHA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-6 space-y-2"
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

      {/* Terms & Conditions Checkbox */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            className="mt-0.5 data-[state=checked]:bg-[#C8102E] data-[state=checked]:border-[#C8102E]"
          />
          <label htmlFor="terms" className="text-sm text-[#6B7280] leading-snug cursor-pointer">
            I agree to the{' '}
            <button
              type="button"
              onClick={() => navigate('terms')}
              className="text-[#C8102E] font-semibold hover:underline"
            >
              Terms of Service
            </button>
            {' '}and{' '}
            <button
              type="button"
              onClick={() => navigate('privacy')}
              className="text-[#C8102E] font-semibold hover:underline"
            >
              Privacy Policy
            </button>
          </label>
        </div>
      </motion.div>

      {/* Continue Button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        whileTap={canContinue ? { scale: 0.97 } : undefined}
        onClick={handleContinue}
        disabled={!canContinue}
        className={`w-full h-[52px] rounded-xl font-semibold text-[16px] flex items-center justify-center transition-all ${
          canContinue
            ? 'bg-[#C8102E] text-white shadow-md active:shadow-sm'
            : 'bg-[#E8A0A8] text-white/80 cursor-not-allowed'
        }`}
      >
        Continue
      </motion.button>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-[14px] text-[#6B7280] mt-5"
      >
        Already have an account?{' '}
        <button
          onClick={() => navigate('login')}
          className="text-[#C8102E] font-semibold hover:underline"
        >
          Log In
        </button>
      </motion.p>
    </>
  )

  /* ─── Mobile Layout ─── */
  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="min-h-screen bg-[#F8F9FA] flex flex-col"
      >
        {/* Header Bar */}
        <header className="flex items-center justify-between px-4 h-14 border-b border-[#E0E0E0]/60 bg-white">
          <button
            onClick={goBack}
            className="p-2 rounded-lg active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[#1A1A1A]" />
          </button>
          <h1 className="text-lg font-bold text-[#C8102E] tracking-tight">
            Zylod
          </h1>
          <button
            onClick={() => navigate('help-center')}
            className="p-2 rounded-lg active:scale-95 transition-transform"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5 text-[#6B7280]" />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col px-6 pt-8 pb-6">
          {contentBlock}
        </div>
      </motion.div>
    )
  }

  /* ─── Desktop Layout ─── */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-8"
    >
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#C8102E" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E0E0E0] overflow-hidden"
      >
        {/* Header Bar */}
        <header className="flex items-center justify-between px-5 h-14 border-b border-[#E0E0E0]/60">
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[#1A1A1A]" />
          </button>
          <h1 className="text-lg font-bold text-[#C8102E] tracking-tight">
            Zylod
          </h1>
          <button
            onClick={() => navigate('help-center')}
            className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5 text-[#6B7280]" />
          </button>
        </header>

        {/* Content */}
        <div className="px-8 pt-8 pb-8">
          {contentBlock}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default RegisterPage
