'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, AlertTriangle, Trash2, ShieldAlert,
  CheckCircle2, X, Loader2, Lock, FileText, Check
} from 'lucide-react'

export function DeleteAccountPage() {
  const { goBack, navigate } = useNavigationStore()
  const { user, token, logout } = useAuthStore()

  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [accountData, setAccountData] = useState<{ ordersCount?: number; productsCount?: number }>({})

  useEffect(() => {
    async function checkAccount() {
      if (!token) return
      try {
        const res = await fetch('/api/profile/account', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) setAccountData(json.data)
        }
      } catch {
        // Graceful
      }
    }
    checkAccount()
  }, [token])

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setErrorMsg('Please type DELETE exactly in uppercase to confirm.')
      return
    }

    setDeleting(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/profile/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation: 'DELETE', reason }),
      })

      if (res.ok) {
        if (logout) logout()
        navigate('welcome')
      } else {
        const json = await res.json()
        setErrorMsg(json.error || 'Failed to terminate account. Please contact support.')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-rose-600">Close Account</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 lg:max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        <div className="space-y-4 md:space-y-6">
        {/* Caution Banner */}
        <div className="bg-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2 border border-rose-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-rose-400" />
            </div>
            <div>
              <h1 className="text-base font-black text-white">Permanent Account Termination</h1>
              <p className="text-xs text-rose-200">
                This action is irreversible. All catalog listings and trade ratings will be permanently erased.
              </p>
            </div>
          </div>
        </div>

        {/* Account Data Summary */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Account Impact Summary
          </h2>
          <div className="divide-y divide-slate-50 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Account Email</span>
              <span className="font-bold text-slate-900">{user?.email || 'Active User'}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Order History &amp; POs</span>
              <span className="font-bold text-slate-900">{accountData.ordersCount ?? 0} records archived</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Wholesale Storefront</span>
              <span className="font-bold text-rose-600">Permanently de-indexed</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Trade Assurance Escrows</span>
              <span className="font-bold text-emerald-600">Must be 0 active claims</span>
            </div>
          </div>
        </div>

        </div>

        <div className="space-y-4 md:space-y-6">
        {/* Feedback Reason */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <label className="text-xs font-bold text-slate-700 block">
            Reason for leaving (Optional)
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Help us understand how we can improve Zylod Wholesale..."
            className="w-full rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Confirmation Input */}
        <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-2xs space-y-3">
          <label className="text-xs font-bold text-slate-900 block">
            Type <span className="text-rose-600 font-black font-mono">DELETE</span> to confirm termination:
          </label>
          <Input
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value)
              setErrorMsg('')
            }}
            placeholder="Type DELETE"
            className="h-11 rounded-2xl bg-rose-50/50 border-rose-300 text-xs font-black font-mono text-rose-600 uppercase"
          />
          {errorMsg && (
            <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {errorMsg}
            </p>
          )}
        </div>

        {/* Delete CTA */}
        <Button
          onClick={handleDelete}
          disabled={deleting || confirmText !== 'DELETE'}
          className="w-full font-bold h-12 rounded-2xl text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {deleting ? 'Terminating Account...' : 'Permanently Delete My Account'}
        </Button>
        </div>
        </div>
      </main>
    </div>
  )
}

export default DeleteAccountPage
