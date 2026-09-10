'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Landmark, ShieldCheck, CheckCircle2,
  FileText, Download, Check, Loader2, AlertCircle,
  Hash, Receipt, Building2, Upload
} from 'lucide-react'

export function TaxInformationPage() {
  const { goBack, navigate } = useNavigationStore()
  const { user, token } = useAuthStore()

  const [taxId, setTaxId] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [businessEntityType, setBusinessEntityType] = useState('Private Enterprise')
  const [taxJurisdiction, setTaxJurisdiction] = useState('Bangladesh (NBR)')
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; date: string }>>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadTax() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/profile/tax', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setTaxId(json.data.taxId !== 'Not Set' ? json.data.taxId : '')
            setVatNumber(json.data.vatNumber !== 'N/A' ? json.data.vatNumber : '')
            if (json.data.businessEntityType) setBusinessEntityType(json.data.businessEntityType)
            if (Array.isArray(json.data.documents)) setDocuments(json.data.documents)
          }
        }
      } catch {
        // Graceful
      } finally {
        setLoading(false)
      }
    }
    loadTax()
  }, [token])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (token) {
        await fetch('/api/profile/tax', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            taxId,
            vatNumber,
            businessEntityType,
          }),
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      // Handled
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Tax Information...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Tax &amp; VAT Identification</span>
        <div className="w-8" />
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Tax VAT Identification</h1>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 md:max-w-2xl md:px-6 md:py-6">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 rounded-3xl p-5 text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Tax &amp; Compliance</h1>
              <p className="text-xs text-slate-300">
                National Board of Revenue (NBR) e-TIN, VAT BIN, and withholding tax certificates.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Tax Credentials */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Tax Registration Credentials
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  12-Digit e-TIN Number (NBR)
                </label>
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. 882910482910"
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  13-Digit VAT BIN (Mushak 2.3)
                </label>
                <Input
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="e.g. 002910384-0102"
                  className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tax Jurisdiction &amp; Authority
                </label>
                <Input
                  value={taxJurisdiction}
                  disabled
                  className="h-11 rounded-2xl bg-slate-100 border-slate-200 text-xs font-bold text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Tax Invoicing Notice */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Receipt className="h-4 w-4 text-primary" />
              Automated VAT Commercial Invoices
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Your verified BIN and e-TIN are automatically rendered on all standard wholesale B2B commercial invoices generated on Zylod for corporate audit compliance.
            </p>
          </div>

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
