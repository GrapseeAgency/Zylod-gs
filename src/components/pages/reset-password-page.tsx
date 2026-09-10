'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { calculatePasswordStrength } from '@/lib/auth-security'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'

export default function ResetPasswordPage() {
  const isMobile = useIsMobile()
  const { navigate, goBack, pageParams } = useNavigationStore()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Token from navigation params (from forgot-password flow)
  const token = pageParams.token || ''

  // Enhanced password strength from auth-security
  const strengthInfo = useMemo(() => calculatePasswordStrength(newPassword), [newPassword])

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const passwordsDontMatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (strengthInfo.score < 2) {
      setError('Please choose a stronger password. Follow the suggestions below.')
      return
    }

    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: newPassword,
          confirmPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Please try again.')
        return
      }

      toast.success('Password updated successfully!', {
        description: 'You can now sign in with your new password.',
      })

      navigate('login', { resetSuccess: 'true' })
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Password Strength Section ───
  const passwordStrengthSection = newPassword.length > 0 && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-3"
    >
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">Password Strength</span>
          <span className="text-xs font-semibold" style={{ color: strengthInfo.color }}>
            {strengthInfo.label}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${strengthInfo.percent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: strengthInfo.color }}
          />
        </div>
      </div>

      {/* Entropy & Crack Time Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className="text-[10px] font-medium border-[#E0E0E0] bg-[#F8F9FA]"
        >
          <Info className="w-3 h-3 mr-1" />
          {strengthInfo.entropy} bits entropy
        </Badge>
        <Badge
          variant="outline"
          className="text-[10px] font-medium border-[#E0E0E0]"
          style={{
            backgroundColor: strengthInfo.score >= 3 ? '#F0FDF4' : strengthInfo.score >= 2 ? '#FEFCE8' : '#FEF2F2',
            color: strengthInfo.color,
          }}
        >
          <Shield className="w-3 h-3 mr-1" />
          Crack time: {strengthInfo.crackTime}
        </Badge>
      </div>

      {/* Suggestions */}
      {strengthInfo.suggestions.length > 0 && (
        <div className="space-y-1">
          {strengthInfo.suggestions.map((suggestion, i) => (
            <p key={i} className="text-[11px] text-[#6B7280] flex items-start gap-1.5">
              <span className="text-[#9CA3AF] mt-0.5">•</span>
              {suggestion}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  )

  // ─── Shared Form Content ───
  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E0E0E0] space-y-5">
        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-sm font-medium text-[#1A1A1A]">
            New Password
          </Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                if (error) setError(null)
              }}
              className="h-12 pr-12 rounded-xl border-[#E0E0E0] text-[#1A1A1A] placeholder:text-[#9CA3AF]"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
            >
              {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {passwordStrengthSection}

          {!newPassword && (
            <p className="text-xs text-[#6B7280]">
              Use at least 8 characters, with letters and numbers.
            </p>
          )}
        </div>

        {/* Confirm New Password */}
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-sm font-medium text-[#1A1A1A]">
            Confirm New Password
          </Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (error) setError(null)
              }}
              className={`h-12 pr-12 rounded-xl border-[#E0E0E0] text-[#1A1A1A] placeholder:text-[#9CA3AF] ${
                passwordsDontMatch ? 'border-red-400 focus-visible:border-red-400' : ''
              } ${passwordsMatch ? 'border-green-400 focus-visible:border-green-400' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {passwordsDontMatch && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Passwords do not match
            </p>
          )}
          {passwordsMatch && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Passwords match
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-red-50 border border-red-200"
          >
            <p className="text-sm text-red-600">{error}</p>
          </motion.div>
        )}
      </div>

      {/* Update Button */}
      <Button
        type="submit"
        disabled={isLoading || !newPassword || !confirmPassword}
        className="w-full h-[50px] bg-[#C8102E] hover:bg-[#A50D25] text-white text-base font-semibold rounded-xl shadow-lg shadow-red-200/50 transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Updating...
          </>
        ) : (
          'Update Password'
        )}
      </Button>
    </form>
  )

  // ─── Security Footer ───
  const securityFooter = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="flex items-center gap-2"
    >
      <Shield className="h-4 w-4 text-[#6B7280]" />
      <span className="text-xs text-[#6B7280]">Secured by Zylod Vault</span>
    </motion.div>
  )

  // ─── Footer Links ───
  const footerLinks = (
    <div className="flex items-center gap-4 text-xs text-[#6B7280]">
      <button
        type="button"
        onClick={() => navigate('privacy')}
        className="hover:text-[#C8102E] transition-colors underline underline-offset-2"
      >
        Privacy Policy
      </button>
      <span className="text-[#E0E0E0]">|</span>
      <button
        type="button"
        onClick={() => navigate('help-center')}
        className="hover:text-[#C8102E] transition-colors underline underline-offset-2"
      >
        Help Center
      </button>
    </div>
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
            <ArrowLeft className="h-5 w-5 text-[#C8102E]" />
          </button>
          <h1 className="text-lg font-bold text-[#C8102E]">Zylod</h1>
          <div className="w-9" />
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
                  <Lock className="h-10 w-10 text-[#C8102E]" strokeWidth={1.8} />
                  <RefreshCw className="h-5 w-5 text-[#C8102E] absolute -bottom-1 -right-2" strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-[28px] font-bold text-[#1A1A1A] text-center mb-2">
              Reset Password
            </h2>
            <p className="text-[15px] text-[#6B7280] text-center mb-8 max-w-xs leading-relaxed">
              Ensure your account remains secure with a strong, unique password.
            </p>

            {formContent}

            {/* Security Footer */}
            <div className="mt-8">
              {securityFooter}
            </div>

            {/* Footer Links */}
            <div className="mt-6">
              {footerLinks}
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
              <ArrowLeft className="h-5 w-5 text-[#C8102E]" />
            </button>
            <h1 className="text-lg font-bold text-[#C8102E]">Zylod</h1>
            <div className="w-9" />
          </div>

          {/* Hero Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-5">
              <div className="w-28 h-28 rounded-full bg-[#FFE4E6] flex items-center justify-center">
                <div className="relative">
                  <Lock className="h-10 w-10 text-[#C8102E]" strokeWidth={1.8} />
                  <RefreshCw className="h-5 w-5 text-[#C8102E] absolute -bottom-1 -right-2" strokeWidth={2} />
                </div>
              </div>
            </div>

            <h2 className="text-[30px] font-bold text-[#1A1A1A] text-center mb-2">
              Reset Password
            </h2>
            <p className="text-[15px] text-[#6B7280] text-center max-w-xs leading-relaxed">
              Ensure your account remains secure with a strong, unique password.
            </p>
          </div>

          {formContent}

          {/* Security Footer */}
          <div className="mt-6 flex justify-center">
            {securityFooter}
          </div>

          {/* Footer Links */}
          <div className="mt-4 flex justify-center">
            {footerLinks}
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

export { ResetPasswordPage }
