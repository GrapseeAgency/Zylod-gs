'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Bell,
  ShieldCheck,
  Download,
  Copy,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
  }),
}

export function BackupCodesPage() {
  const { goBack, navigate, pageParams } = useNavigationStore()
  const { user, token: storeToken } = useAuthStore()
  const isMobile = useIsMobile()

  // Codes are generated and hashed server-side; plaintext is shown exactly once.
  const [codes, setCodes] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // The login flow passes the fresh session token via nav params so this
  // authenticated call works immediately after 2FA enrollment.
  const bearerToken = storeToken || ''

  useEffect(() => {
    let cancelled = false

    const generateCodes = async () => {
      if (!bearerToken) {
        setLoadError('Session expired. Please sign in again to view your backup codes.')
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch('/api/auth/backup-codes', {
          method: 'POST',
          headers: { Authorization: `Bearer ${bearerToken}` },
        })
        const data = await res.json()

        if (!cancelled && !res.ok) {
          setLoadError(data.error || 'Could not generate backup codes.')
          setIsLoading(false)
          return
        }
        if (!cancelled) {
          setCodes(data.codes)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoadError('Network error. Please try again.')
          setIsLoading(false)
        }
      }
    }

    generateCodes()
    return () => { cancelled = true }
  }, [bearerToken])

  const handleDownload = useCallback(() => {
    const content = [
      'Zylod - Backup Recovery Codes',
      '====================================',
      '',
      'IMPORTANT: Store these codes in a safe, offline location.',
      'Each code can only be used ONCE.',
      `Account: ${user?.email || user?.phone || ''}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      ...codes.map((code, i) => `${String(i + 1).padStart(2, ' ')}. ${code}`),
      '',
      '====================================',
      'If you lose your 2FA device, use one of these codes to sign in.',
      'After using a code, it cannot be reused.',
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zylod-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Codes downloaded successfully!')
  }, [codes, user])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      toast.success('Codes copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy codes')
    }
  }, [codes])

  const handleSaved = useCallback(() => {
    navigate(user?.userType === 'supplier' ? 'supplier-dashboard' : user?.userType === 'admin' ? 'admin-dashboard' : 'home')
  }, [navigate, user])

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
      <span className="text-lg font-bold text-[#1A1A1A]">Backup Codes</span>
      <button
        onClick={() => navigate('notifications')}
        className="p-1.5 rounded-lg active:scale-95 transition-transform"
        aria-label="Notifications"
      >
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

  /* ─── Info Card ─── */
  const infoCard = (
    <motion.div
      custom={1}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-4"
    >
      <Card className="rounded-xl shadow-md border-0 bg-white py-0 gap-0">
        <CardContent className="p-5 space-y-2">
          <h2 className="text-[20px] font-bold text-[#1A1A1A]">
            Secure Your Account
          </h2>
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            Backup codes allow you to access your account if you lose your 2FA device.
            Each code works once and is stored only as a hash on our servers.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )

  /* ─── Codes Grid / States ─── */
  const codesGrid = (
    <motion.div
      custom={2}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-4"
    >
      <Card className="rounded-xl shadow-md border-0 bg-white py-0 gap-0">
        <CardContent className="p-5">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin" />
              <p className="text-sm text-[#6B7280]">Generating secure codes...</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertTriangle className="w-7 h-7 text-[#C8102E]" />
              <p className="text-sm text-[#C8102E] text-center">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('login')}
                className="mt-1"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {codes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center rounded-lg bg-[#F3F4F6] py-2.5 px-3"
                >
                  <span className="font-mono text-[13px] font-semibold text-[#1A1A1A] tracking-wide">
                    {code}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )

  /* ─── Action Buttons ─── */
  const hasCodes = !isLoading && !loadError && codes.length > 0
  const actionButtons = (
    <motion.div
      custom={3}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-4 grid grid-cols-2 gap-3"
    >
      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={!hasCodes}
        className="h-[52px] rounded-xl border-[#E0E0E0] text-[#1A1A1A] hover:bg-[#F3F4F6] gap-2 text-[13px] font-semibold flex-col py-2 disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        <span className="text-[11px] leading-tight text-center">Download<br />Codes</span>
      </Button>
      <Button
        variant="outline"
        onClick={handleCopy}
        disabled={!hasCodes}
        className="h-[52px] rounded-xl border-[#E0E0E0] text-[#1A1A1A] hover:bg-[#F3F4F6] gap-2 text-[13px] font-semibold flex-col py-2 disabled:opacity-50"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-[11px] leading-tight text-center text-green-600">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span className="text-[11px] leading-tight text-center">Copy to<br />Clipboard</span>
          </>
        )}
      </Button>
    </motion.div>
  )

  /* ─── Primary Button ─── */
  const savedButton = (
    <motion.div
      custom={4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-5"
    >
      <Button
        onClick={handleSaved}
        disabled={!hasCodes}
        className="w-full h-[52px] bg-[#C8102E] hover:bg-[#A50D25] text-white rounded-xl text-base font-semibold gap-2 disabled:opacity-50"
      >
        I&apos;ve Saved These
      </Button>
    </motion.div>
  )

  /* ─── Footer Warning ─── */
  const footerWarning = (
    <motion.div
      custom={5}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="px-4 pt-6 pb-8"
    >
      <div className="flex items-start gap-3 bg-[#FFF5F5] rounded-xl p-4 border border-[#FEE2E2]">
        <AlertTriangle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-bold text-[#C8102E] uppercase tracking-wider">
            High Security Zone
          </p>
          <p className="text-[12px] text-[#6B7280] italic mt-1 leading-relaxed">
            Keep these in a safe place. Generating new codes invalidates any unused ones from previous sets.
          </p>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {headerBar}
      <main className={`flex-1 flex flex-col ${isMobile ? '' : 'justify-center px-4 py-10'}`}>
        {isMobile ? (
          <>
            {heroSection}
            {infoCard}
            {codesGrid}
            {actionButtons}
            {savedButton}
            {footerWarning}
          </>
        ) : (
          <div className="w-full max-w-md mx-auto flex flex-col">
            {heroSection}
            {infoCard}
            {codesGrid}
            {actionButtons}
            {savedButton}
            {footerWarning}
          </div>
        )}
      </main>
    </div>
  )
}

export default BackupCodesPage
