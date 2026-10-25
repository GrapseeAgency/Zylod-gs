'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, Loader2 } from 'lucide-react'
import type { SocialProvider } from '@/lib/social-auth'

/**
 * Email sign-in dialog for quick account access.
 *
 * Listens for the `zylod-open-social-consent` event dispatched by the
 * social-auth service layer, collects the account email in Zylod's own
 * dialog, and posts the result back via window message. Mounted once in
 * AppEntry so every auth page can trigger it.
 *
 * HONESTY NOTE: this is NOT a Google or Facebook sign-in and no third-party
 * provider is contacted. The provider key ('google' | 'facebook') only
 * selects which Zylod server route (/api/auth/google | /api/auth/facebook)
 * the email is exchanged on — the UI must never claim a provider identity,
 * which is why the copy below is provider-neutral for both keys.
 */

interface ChooserState {
  open: boolean
  provider: SocialProvider | null
  email: string
  name: string
  submitting: boolean
}

// Provider-neutral: both server-route keys render the same honest copy.
const PROVIDER_META: Record<SocialProvider, { title: string; hint: string }> = {
  google: {
    title: 'Sign in with your email',
    hint: 'Enter your email to create or access your Zylod account. This signs you in on Zylod\u2019s own server \u2014 it is not a Google or Facebook sign-in.',
  },
  facebook: {
    title: 'Sign in with your email',
    hint: 'Enter your email to create or access your Zylod account. This signs you in on Zylod\u2019s own server \u2014 it is not a Google or Facebook sign-in.',
  },
}

export function SocialConsentModal() {
  const [state, setState] = useState<ChooserState>({
    open: false,
    provider: null,
    email: '',
    name: '',
    submitting: false,
  })

  useEffect(() => {
    const opener = (event: Event) => {
      const detail = (event as CustomEvent).detail as { provider: SocialProvider }
      setState({ open: true, provider: detail.provider, email: '', name: '', submitting: false })
    }
    window.addEventListener('zylod-open-social-consent', opener)
    return () => window.removeEventListener('zylod-open-social-consent', opener)
  }, [])

  const close = (cancelled: boolean) => {
    if (state.submitting) return
    window.postMessage(
      { type: `zylod-social-consent-${state.provider}`, cancelled },
      window.location.origin
    )
    setState((s) => ({ ...s, open: false }))
  }

  const confirm = () => {
    if (!state.email.includes('@')) return
    setState((s) => ({ ...s, submitting: true }))
    // Brief pause so the submitting state is visible before the dialog closes.
    setTimeout(() => {
      window.postMessage(
        {
          type: `zylod-social-consent-${state.provider}`,
          cancelled: false,
          email: state.email.trim(),
          name: state.name.trim(),
        },
        window.location.origin
      )
      setState((s) => ({ ...s, open: false, submitting: false }))
    }, 600)
  }

  const meta = state.provider ? PROVIDER_META[state.provider] : null

  return (
    <AnimatePresence>
      {state.open && meta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => close(true)}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-[400px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-[#1A1A1A] dark:text-white">
                  {meta.title}
                </span>
              </div>
              <button
                onClick={() => close(true)}
                className="p-1.5 rounded-full hover:bg-[#F3F4F6] dark:bg-gray-800 transition-colors"
                aria-label="Cancel sign-in"
                disabled={state.submitting}
              >
                <X className="w-4 h-4 text-[#6B7280] dark:text-gray-400" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-[#374151] leading-relaxed">{meta.hint}</p>

              <div className="space-y-2">
                <label htmlFor="social-email" className="text-xs font-semibold text-[#6B7280] dark:text-gray-400 uppercase tracking-wide">
                  Email address
                </label>
                <input
                  id="social-email"
                  type="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={state.email}
                  onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && state.email.includes('@')) confirm() }}
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <label htmlFor="social-name" className="text-xs font-semibold text-[#6B7280] dark:text-gray-400 uppercase tracking-wide block pt-1">
                  Full name
                </label>
                <input
                  id="social-name"
                  type="text"
                  placeholder="Your full name"
                  value={state.name}
                  onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                onClick={confirm}
                disabled={!state.email.includes('@') || state.submitting}
                className="w-full h-11 rounded-lg bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
              >
                {state.submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Continue'
                )}
              </button>

              <div className="flex items-start gap-2 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#6B7280] dark:text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  Zylod uses your email only to create or access your account on Zylod\u2019s own server.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
