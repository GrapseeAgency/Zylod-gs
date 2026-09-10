'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Landmark, Plus, Trash2, CheckCircle2,
  ShieldCheck, Check, Loader2, Building2, MoreVertical
} from 'lucide-react'

interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountHolderName: string
  branchName: string
  routingNumber: string
  isDefault: boolean
  verified: boolean
}

export function BankAccountsPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadAccounts = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/bank-accounts', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) setAccounts(json.data)
      }
    } catch {
      // Handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [token])

  const handleSetDefault = async (id: string) => {
    setActionLoading(id)
    try {
      await fetch(`/api/bank-accounts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isDefault: true }),
      })
      loadAccounts()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this bank account?')) return
    setActionLoading(id)
    try {
      await fetch(`/api/bank-accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      loadAccounts()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Commercial Bank Accounts</span>
        <button
          onClick={() => navigate('add-bank-account')}
          className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-primary hover:bg-rose-100"
          title="Add Bank"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto md:max-w-3xl px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 w-full">
        {/* Desktop page title */}
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Commercial Bank Accounts</h1>
          <Button
            onClick={() => navigate('add-bank-account')}
            size="sm"
            className="gap-1.5 text-xs font-bold h-9 rounded-xl bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Bank Account
          </Button>
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Corporate Bank Payouts</h1>
              <p className="text-xs text-slate-300">
                Verified commercial bank routing for high-volume wholesale settlements.
              </p>
            </div>
          </div>
        </div>

        {/* Bank List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Loading Bank Accounts...</span>
            </div>
          ) : accounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900">{acc.bankName}</h3>
                        {acc.isDefault && (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        A/C: •••• {acc.accountNumber.slice(-4)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(acc.id)}
                    disabled={actionLoading === acc.id}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 text-xs divide-y divide-slate-100">
                  <div className="pb-1.5 flex justify-between">
                    <span className="text-slate-400 font-medium">Beneficiary</span>
                    <span className="font-bold text-slate-800">{acc.accountHolderName}</span>
                  </div>
                  <div className="pt-1.5 flex justify-between">
                    <span className="text-slate-400 font-medium">Branch</span>
                    <span className="font-semibold text-slate-700">{acc.branchName}</span>
                  </div>
                </div>

                {!acc.isDefault && (
                  <Button
                    onClick={() => handleSetDefault(acc.id)}
                    disabled={actionLoading === acc.id}
                    variant="outline"
                    className="w-full h-9 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {actionLoading === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set as Primary Payout Account'}
                  </Button>
                )}
              </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-3">
              <Landmark className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-bold text-slate-700 block">No bank accounts linked</span>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Add a corporate bank account to enable direct wholesale withdrawals.
              </p>
            </div>
          )}
        </div>

        {/* Add CTA */}
        <Button
          onClick={() => navigate('add-bank-account')}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Link New Bank Account
        </Button>
      </main>
    </div>
  )
}

export default BankAccountsPage
