'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'
import {
  Mail, Phone, ShieldCheck, ShieldAlert, Loader2, BadgeCheck,
} from 'lucide-react'

/**
 * AccountVerificationCard (t196) — the in-app remediation path for the
 * COD verification gate. The server refuses Cash on Delivery for accounts
 * whose email AND phone are both unverified (403 COD_VERIFICATION_REQUIRED);
 * this card is where the buyer actually verifies one of them:
 *
 *   Verify → POST /api/auth/otp/send {phoneOrEmail, purpose:
 *   'verify_email'|'verify_phone'} (session-scoped: the contact point must
 *   belong to the signed-in account) → 6-digit code entry → POST
 *   /api/auth/otp/verify (flips users.isEmailVerified / isPhoneVerified)
 *   → refreshProfile() so the checkout COD lock releases immediately.
 *
 * Dev note: the OTP send response carries devCode in non-production, which
 * is surfaced as a hint so the flow is testable without an SMS/email provider.
 */
export function AccountVerificationCard() {
  const { user, refreshProfile } = useAuthStore()
  const email = user?.email || null
  const phone = user?.phone || null
  const emailVerified = user?.isEmailVerified === true
  const phoneVerified = user?.isPhoneVerified === true

  const [busyTarget, setBusyTarget] = useState<'' | 'email' | 'phone'>('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState<'' | 'email' | 'phone'>('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  if (!user) return null

  const allVerified = emailVerified || phoneVerified

  const sendCode = async (target: 'email' | 'phone') => {
    const phoneOrEmail = target === 'email' ? email : phone
    if (!phoneOrEmail) {
      toast.error(target === 'email' ? 'No email on file — add one in Edit Profile first.' : 'No phone on file — add one in Edit Profile first.')
      return
    }
    setBusyTarget(target)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phoneOrEmail,
          purpose: target === 'email' ? 'verify_email' : 'verify_phone',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        toast.error(data?.error || `Could not send the verification code (HTTP ${res.status}).`)
        return
      }
      setPending(target)
      setCode('')
      setDevCode(typeof data.devCode === 'string' ? data.devCode : null)
      toast.success(`Verification code sent to ${phoneOrEmail}`)
    } catch {
      toast.error('Network error while sending the verification code.')
    } finally {
      setBusyTarget('')
    }
  }

  const confirmCode = async () => {
    const phoneOrEmail = pending === 'email' ? email : phone
    if (!pending || !phoneOrEmail) return
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error('Enter the 6-digit code.')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneOrEmail, code: code.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success || !data?.verified) {
        toast.error(data?.error || 'Invalid or expired code.')
        return
      }
      toast.success(pending === 'email' ? 'Email verified — Cash on Delivery unlocked.' : 'Phone verified — Cash on Delivery unlocked.')
      setPending('')
      setCode('')
      setDevCode(null)
      await refreshProfile()
    } catch {
      toast.error('Network error while verifying the code.')
    } finally {
      setVerifying(false)
    }
  }

  const Row = ({
    kind, icon: Icon, label, value, verified,
  }: {
    kind: 'email' | 'phone'
    icon: typeof Mail
    label: string
    value: string | null
    verified: boolean
  }) => (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-card border border-slate-200 dark:border-neutral-800 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold text-slate-900 dark:text-neutral-100">{label}</span>
        <span className="block text-[11px] text-slate-500 dark:text-neutral-400 truncate">{value || 'Not set'}</span>
      </span>
      {verified ? (
        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full px-2 py-1">
          <BadgeCheck className="h-3 w-3" /> Verified
        </span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busyTarget !== '' || verifying}
          onClick={() => sendCode(kind)}
          className="h-8 px-3 text-[11px] font-bold rounded-xl border-primary/40 text-primary hover:bg-primary/5"
        >
          {busyTarget === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
        </Button>
      )}
    </div>
  )

  return (
    <section
      aria-label="Account verification"
      className={`mx-4 mt-4 rounded-2xl border p-4 ${
        allVerified
          ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5'
          : 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {allVerified ? (
          <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xs font-black text-slate-900 dark:text-neutral-100">
            {allVerified ? 'Account verified' : 'Verify your account'}
          </h2>
          <p className="text-[11px] text-slate-600 dark:text-neutral-400 leading-relaxed mt-0.5">
            {allVerified
              ? 'Cash on Delivery is unlocked for this account.'
              : 'Cash on Delivery stays locked until your email or phone is verified. Wallet, bank transfer and mobile banking are unaffected.'}
          </p>

          <div className="divide-y divide-slate-200/70 dark:divide-neutral-800 mt-1">
            <Row kind="email" icon={Mail} label="Email" value={email} verified={emailVerified} />
            <Row kind="phone" icon={Phone} label="Phone" value={phone} verified={phoneVerified} />
          </div>

          {pending && (
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-card p-3 space-y-2">
              <label htmlFor="verification-code" className="block text-[11px] font-bold text-slate-700 dark:text-neutral-200">
                Enter the 6-digit code sent to {pending === 'email' ? email : phone}
              </label>
              <div className="flex gap-2">
                <input
                  id="verification-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="······"
                  className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-neutral-800 bg-background px-3 text-sm font-black tracking-[0.3em] text-center outline-none focus:border-primary"
                />
                <Button
                  onClick={confirmCode}
                  disabled={verifying || code.length !== 6}
                  className="h-10 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-white"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                </Button>
              </div>
              {devCode && (
                <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                  Development hint — your code is <span className="font-black tracking-widest">{devCode}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default AccountVerificationCard
