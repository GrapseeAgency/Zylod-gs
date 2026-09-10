'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Landmark, Plus, Check, Loader2,
  AlertCircle, CheckCircle2, ShieldCheck, Building2
} from 'lucide-react'

export function AddBankAccountPage() {
  const { goBack, navigate } = useNavigationStore()
  const { token } = useAuthStore()

  const [bankName, setBankName] = useState('City Bank PLC')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [branchName, setBranchName] = useState('Gulshan Corporate Branch')
  const [routingNumber, setRoutingNumber] = useState('225271829')
  const [isDefault, setIsDefault] = useState(true)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountNumber || !accountHolderName) {
      setErrorMsg('Account number and account title are required')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bankName,
          accountNumber,
          accountHolderName,
          branchName,
          routingNumber,
          isDefault,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setSuccessMsg('Commercial bank account added successfully!')
        setTimeout(() => navigate('bank-accounts'), 1500)
      } else {
        setErrorMsg(json.error || 'Failed to link bank account')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Add Bank Account</span>
        <div className="w-8" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-3xl">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Link Commercial Bank</h1>
              <p className="text-xs text-slate-300">
                Authorized for EFTN and RTGS automated bulk wholesale settlements.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Commercial Bank</label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold px-3.5 text-slate-900 focus:outline-none focus:border-primary"
              >
                <option value="City Bank PLC">City Bank PLC</option>
                <option value="BRAC Bank PLC">BRAC Bank PLC</option>
                <option value="Dutch-Bangla Bank (DBBL)">Dutch-Bangla Bank (DBBL)</option>
                <option value="Islami Bank Bangladesh PLC">Islami Bank Bangladesh PLC</option>
                <option value="Eastern Bank PLC (EBL)">Eastern Bank PLC (EBL)</option>
                <option value="Standard Chartered Bangladesh">Standard Chartered Bangladesh</option>
                <option value="HSBC Bangladesh">HSBC Bangladesh</option>
                <option value="Prime Bank PLC">Prime Bank PLC</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Account Number
              </label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="13-16 digit account number"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Account Holder Name / Entity Title
              </label>
              <Input
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Exact legal name matching bank statement"
                className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
              />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Branch Name</label>
                <Input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Branch"
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Routing Number</label>
                <Input
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  placeholder="9-digit routing"
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Set as Primary Account</span>
                <span className="text-[11px] text-slate-400 block">Default destination for sales proceeds</span>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} className="data-[state=checked]:bg-primary" />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMsg}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? 'Validating Bank Details...' : 'Save & Link Bank Account'}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default AddBankAccountPage
