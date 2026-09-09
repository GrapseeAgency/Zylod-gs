'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, CreditCard, Plus, Trash2, CheckCircle2,
  ShieldCheck, Check, Loader2, Lock, Building2
} from 'lucide-react'

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
  const { token } = useAuthStore()

  const [cards, setCards] = useState<SavedCard[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadCards = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/cards', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) setCards(json.data)
      }
    } catch {
      // Handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCards()
  }, [token])

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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
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
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Tokenized Corporate Cards</h1>
              <p className="text-xs text-slate-300">
                PCI-DSS compliant encrypted card tokens for instant wholesale checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Loading Saved Cards...</span>
            </div>
          ) : cards.length > 0 ? (
            cards.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900">{c.brand} ({c.cardType})</h3>
                        {c.isDefault && (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-mono font-bold block mt-0.5">
                        •••• •••• •••• {c.last4}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={actionLoading === c.id}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 text-xs flex justify-between">
                  <span className="text-slate-400 font-medium">Cardholder: <strong className="text-slate-800">{c.holderName}</strong></span>
                  <span className="text-slate-400 font-medium">Exp: <strong className="font-mono text-slate-800">{c.expiry}</strong></span>
                </div>

                {!c.isDefault && (
                  <Button
                    onClick={() => handleSetDefault(c.id)}
                    disabled={actionLoading === c.id}
                    variant="outline"
                    className="w-full h-9 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {actionLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set as Default Payment Card'}
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
              <CreditCard className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 block">No cards saved</span>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
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
