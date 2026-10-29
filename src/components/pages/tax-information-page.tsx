'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { AccountGate } from '@/components/shared/account-gate'
import {
  ArrowLeft, Landmark, ShieldCheck, CheckCircle2,
  FileText, Download, Check, Loader2, AlertCircle,
  Hash, Receipt, Building2, Upload
} from 'lucide-react'

export function TaxInformationPage() {
  const { goBack, navigate } = useNavigationStore()
  const { user, token, isAuthenticated } = useAuthStore()

  const [taxId, setTaxId] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [businessEntityType, setBusinessEntityType] = useState('')
  const [taxJurisdiction, setTaxJurisdiction] = useState('Bangladesh (NBR)')
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; date: string }>>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notSupported, setNotSupported] = useState(false)
  // Honesty fix: the tax profile is the signed-in account's REAL credentials —
  // guests get an account gate instead of an editable-looking empty form.
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Deep links can mount before the boot session probe settles.
  useEffect(() => {
    if (isAuthenticated) return
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [isAuthenticated])

  useEffect(() => {
    async function loadTax() {
      if (!isAuthenticated) return
      try {
        const res = await fetch('/api/profile/tax', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401 || res.status === 403) {
          setSessionExpired(true)
          return
        }
        if (!res.ok) {
          setLoadError(`Could not load your saved tax information (HTTP ${res.status}).`)
          return
        }
        const json = await res.json()
        if (json.data) {
          setTaxId(json.data.taxId !== 'Not Set' ? json.data.taxId : '')
          setVatNumber(json.data.vatNumber !== 'N/A' ? json.data.vatNumber : '')
          if (json.data.businessEntityType) setBusinessEntityType(json.data.businessEntityType)
          if (Array.isArray(json.data.documents)) setDocuments(json.data.documents)
        }
      } catch {
        setLoadError('Network error while loading your tax information. Check your connection and retry.')
      } finally {
        setLoading(false)
      }
    }
    loadTax()
  }, [isAuthenticated, token])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setNotSupported(false)
    try {
      // Real contract: PATCH /api/profile/tax persists taxId/vatNumber for
      // suppliers. Buyers honestly get 501 (no tax storage exists for them).
      const body: Record<string, string> = {}
      if (taxId.trim()) body.taxId = taxId.trim()
      if (vatNumber.trim()) body.vatNumber = vatNumber.trim()
      const res = await fetch('/api/profile/tax', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true)
        return
      }
      if (res.status === 501) {
        setNotSupported(true)
        setSaveError(json?.error || 'Not implemented yet — requires backend support')
        return
      }
      if (!res.ok || !json?.success) {
        setSaveError(json?.error || `Saving your tax information failed (HTTP ${res.status}).`)
        return
      }
      if (typeof json.data?.taxId === 'string') setTaxId(json.data.taxId)
      if (typeof json.data?.vatNumber === 'string') setVatNumber(json.data.vatNumber)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSaveError('Network error while saving your tax information. Check your connection and retry.')
    } finally {
      setSaving(false)
    }
  }

  // Gates — placed after every hook so all hooks always run.
  if (sessionExpired) {
    return <AccountGate title="Session expired" message="Your session is no longer valid. Sign in again to manage your tax information." />
  }
  if (!loading && !isAuthenticated) {
    return (
      <AccountGate
        title="Sign in to manage your tax information"
        message="Tax & VAT credentials belong to your account. Sign in to view and save your real e-TIN and BIN details."
      />
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <PageLoader label="Loading Tax Information…" className="min-h-0" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-neutral-100 pb-24 md:pb-10">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-neutral-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Tax &amp; VAT Identification</span>
        <div className="w-8" />
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-neutral-100">Tax VAT Identification</h1>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-neutral-900 dark:to-rose-950 rounded-3xl p-5 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Tax &amp; Compliance</h1>
              <p className="text-xs text-slate-600 dark:text-neutral-300">
                National Board of Revenue (NBR) e-TIN, VAT BIN, and withholding tax certificates.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Tax Credentials */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 dark:text-neutral-400">
              Tax Registration Credentials
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                  12-Digit e-TIN Number (NBR)
                </label>
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. 882910482910"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                  13-Digit VAT BIN (Mushak 2.3)
                </label>
                <Input
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="e.g. 002910384-0102"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-background border-slate-200 dark:border-neutral-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                  Tax Jurisdiction &amp; Authority
                </label>
                <Input
                  value={taxJurisdiction}
                  disabled
                  className="h-11 rounded-2xl bg-slate-100 dark:bg-card border-slate-200 dark:border-neutral-800 text-xs font-bold text-slate-600 dark:text-neutral-400 dark:text-neutral-500"
                />
              </div>
            </div>
          </div>

          {/* Tax Invoicing Notice */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-neutral-800 shadow-2xs space-y-2 text-xs text-slate-600 dark:text-neutral-400 dark:text-neutral-500">
            <div className="flex items-center gap-2 text-slate-900 dark:text-neutral-100 font-bold">
              <Receipt className="h-4 w-4 text-primary" />
              Automated VAT Commercial Invoices
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 dark:text-neutral-500 leading-relaxed">
              Your verified BIN and e-TIN are automatically rendered on all standard wholesale B2B commercial invoices generated on Zylod for corporate audit compliance.
            </p>
          </div>

          {/* Honest load failure — the form below may not reflect saved data */}
          {loadError && (
            <div className="rounded-3xl px-4 py-3 border bg-amber-50 border-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <p className="text-xs font-bold text-amber-700">{loadError}</p>
            </div>
          )}

          {/* Real save error / honest limitation — verbatim from the server */}
          {saveError && (
            <div className={`rounded-3xl px-4 py-3 border flex items-start gap-2 ${notSupported ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${notSupported ? 'text-amber-500' : 'text-red-500'}`} />
              <p className={`text-xs font-bold ${notSupported ? 'text-amber-700' : 'text-red-600'}`}>
                {saveError}
                {notSupported && ' — tax profile storage is only available for supplier accounts on this platform today.'}
              </p>
            </div>
          )}

          {/* Save Button */}
          <Button
            type="submit"
            disabled={saving}
            className={`w-full font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 ${
              saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary/90'
            } text-white`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <><Check className="h-4 w-4" /> Tax Credentials Saved!</>
            ) : (
              'Save Tax & VAT Information'
            )}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default TaxInformationPage
import { PageLoader } from '@/components/ui/page-loader'
