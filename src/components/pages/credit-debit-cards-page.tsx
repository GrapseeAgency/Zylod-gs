'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, CreditCard, Plus, Trash2, CheckCircle2,
  ShieldCheck, Check, Loader2, Lock, Building2, AlertCircle
} from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'

interface SavedCard {
  id: string
  cardType: string
  brand: string
  last4: string
  holderName: string
  expiry: string
  isDefault: boolean
}

export function CreditDebitCardsPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token, isAuthenticated } = useAuthStore()

  const [cards, setCards] = useState<SavedCard[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Deep links can mount before the boot session probe settles — keep loading briefly.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  const loadCards = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/cards', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (res.ok) {
        const json = await res.json()
        if (json.data) setCards(json.data)
        setLoadError('')
      } else {
        setLoadError(`Could not load your saved cards (HTTP ${res.status}).`)
      }
    } catch {
      setLoadError('Network error while loading your saved cards. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) loadCards()
  }, [token])

  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session has ended. Sign in again to view your saved cards." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to view your saved cards"
        message="Saved cards are the real tokenized cards on your account. Sign in to continue."
      />
    )
  }

  const handleSetDefault = async (id: string) => {
    setActionLoading(id)
    try {
      await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isDefault: true }),
      })
      loadCards()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this card?')) return
    setActionLoading(id)
    try {
      await fetch(`/api/cards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      loadCards()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-neutral-100 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Saved Payment Cards</span>
        <button
          onClick={() => navigate('add-card')}
          className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-primary hover:bg-rose-100"
          title="Add Card"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg lg:max-w-5xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-neutral-900 dark:to-rose-950 rounded-3xl p-5 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Tokenized Corporate Cards</h1>
              <p className="text-xs text-slate-600 dark:text-neutral-300">
                PCI-DSS compliant encrypted card tokens for instant wholesale checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Cards List */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-3xl px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-red-600">{loadError}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
          {loading ? (
            <PageLoader label="Loading Saved Cards…" />
          ) : cards.length > 0 ? (
            cards.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-neutral-100">{c.brand} ({c.cardType})</h3>
                        {c.isDefault && (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-neutral-400 dark:text-neutral-500 font-mono font-bold block mt-0.5">
                        •••• •••• •••• {c.last4}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={actionLoading === c.id}
                    className="text-slate-400 dark:text-neutral-500 dark:text-neutral-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-background rounded-2xl p-3 text-xs flex justify-between">
                  <span className="text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-medium">Cardholder: <strong className="text-slate-800 dark:text-neutral-200">{c.holderName}</strong></span>
                  <span className="text-slate-400 dark:text-neutral-500 dark:text-neutral-400 font-medium">Exp: <strong className="font-mono text-slate-800 dark:text-neutral-200">{c.expiry}</strong></span>
                </div>

                {!c.isDefault && (
                  <Button
                    onClick={() => handleSetDefault(c.id)}
                    disabled={actionLoading === c.id}
                    variant="outline"
                    className="w-full h-9 rounded-xl border-slate-200 dark:border-neutral-800 text-xs font-bold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:bg-background dark:hover:bg-card"
                  >
                    {actionLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set as Default Payment Card'}
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-slate-200 dark:border-neutral-800 text-center space-y-3">
              <CreditCard className="h-10 w-10 mx-auto text-slate-400 dark:text-neutral-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 block">No cards saved</span>
              <p className="text-xs text-slate-400 dark:text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
                Save a corporate debit or credit card for seamless multi-item wholesale checkout.
              </p>
            </div>
          )}
        </div>

        {/* Add CTA */}
        <Button
          onClick={() => navigate('add-card')}
          className="w-full md:w-auto md:px-8 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Corporate Card
        </Button>
      </main>
    </div>
  )
}

export default CreditDebitCardsPage
