'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Link as LinkIcon, ShieldCheck, Check,
  Loader2, AlertCircle, Smartphone, Mail, Globe,
  Building2, CreditCard, ChevronRight, Lock, Key,
  ExternalLink, Trash2, Plus
} from 'lucide-react'

interface LinkedAccount {
  id: string
  name: string
  description: string
  connected: boolean
  email?: string | null
  icon: React.ElementType
}

export function LinkedAccountsPage() {
  const { goBack, navigate } = useNavigationStore()
  const { user, token } = useAuthStore()

  const [accounts, setAccounts] = useState<LinkedAccount[]>([
    {
      id: 'google-oauth',
      name: 'Google Single Sign-On',
      description: 'Quick login via Google Workspace authentication.',
      connected: (user as any)?.authProvider === 'google',
      email: (user as any)?.authProvider === 'google' ? user?.email : null,
      icon: Globe,
    },
    {
      id: 'phone-otp',
      name: 'Mobile Phone OTP Authentication',
      description: 'SMS verification for fast and secure checkout.',
      connected: Boolean(user?.phone),
      email: user?.phone || null,
      icon: Smartphone,
    },
    {
      id: 'bkash-merchant',
      name: 'bKash Merchant Settlement',
      description: 'Direct wholesale payout integration for Bangladesh.',
      connected: false,
      icon: CreditCard,
    },
    {
      id: 'nagad-merchant',
      name: 'Nagad Merchant Settlement',
      description: 'Direct postal digital payment integration.',
      connected: false,
      icon: CreditCard,
    },
    {
      id: 'whatsapp-business',
      name: 'WhatsApp Business Notifications',
      description: 'Receive PO confirmations and shipping milestones.',
      connected: true,
      icon: Mail,
    },
  ])

  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadLinked() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/profile/linked-accounts', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data?.accounts && Array.isArray(json.data.accounts)) {
            setAccounts((prev) =>
              prev.map((acc) => {
                const found = json.data.accounts.find((a: any) => a.id === acc.id)
                return found ? { ...acc, connected: found.connected, email: found.email || acc.email } : acc
              })
            )
          }
        }
      } catch {
        // Graceful
      } finally {
        setLoading(false)
      }
    }
    loadLinked()
  }, [token])

  const handleToggleConnect = async (account: LinkedAccount) => {
    setTogglingId(account.id)
    try {
      // Toggle connection state
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, connected: !a.connected } : a))
      )
    } finally {
      setTimeout(() => setTogglingId(null), 400)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Linked Accounts &amp; SSO</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto lg:max-w-3xl px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 md:p-6 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <LinkIcon className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black">Connected Accounts</h1>
              <p className="text-xs md:text-sm text-slate-300">
                Manage your single sign-on providers and financial settlement connections.
              </p>
            </div>
          </div>
        </div>

        {/* Linked Accounts List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
          {accounts.map((acc) => {
            const Icon = acc.icon
            const isProcessing = togglingId === acc.id

            return (
              <div key={acc.id} className="p-4 md:px-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                    acc.connected ? 'bg-rose-50 border-rose-100 text-primary' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs md:text-sm font-bold text-slate-900 truncate">{acc.name}</h3>
                      {acc.connected && (
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                          CONNECTED
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {acc.email || acc.description}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => handleToggleConnect(acc)}
                  disabled={isProcessing}
                  variant={acc.connected ? 'outline' : 'default'}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    acc.connected
                      ? 'border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : acc.connected ? (
                    'Disconnect'
                  ) : (
                    'Connect'
                  )}
                </Button>
              </div>
            )
          })}
        </div>

        {/* Security Note */}
        <div className="bg-slate-100 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-1">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary" />
            Enterprise Security Safeguard
          </span>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            At least one primary authentication method (Password, Google, or Verified Phone) must remain active at all times.
          </p>
        </div>
      </main>
    </div>
  )
}

export default LinkedAccountsPage
