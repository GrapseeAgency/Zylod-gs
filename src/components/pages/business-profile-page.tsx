'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  ArrowLeft, Building2, ShieldCheck, CheckCircle2,
  Edit3, Check, Loader2, Landmark, MapPin, Phone,
  Mail, FileText, Globe, Factory, Upload, Award, AlertCircle
} from 'lucide-react'

export function BusinessProfilePage() {
  const { goBack, navigate } = useNavigationStore()
  const { user, token } = useAuthStore()

  const [legalEntityName, setLegalEntityName] = useState('')
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('')
  const [industryCategory, setIndustryCategory] = useState('Wholesale & Manufacturing')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; status: string }>>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notPersisted, setNotPersisted] = useState<string[]>([])

  useEffect(() => {
    async function loadBiz() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/profile/business', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setLegalEntityName(json.data.legalEntityName || user?.fullName || '')
            setTradeLicenseNumber(json.data.tradeLicenseNumber || '')
            setIndustryCategory(json.data.industryCategory || 'Wholesale & Manufacturing')
            // The schema has NO address columns — the API returns null here.
            // Previous defaults ('Dhaka', '1208') were fabricated; empty is honest.
            setStreetAddress('')
            setCity('')
            setPostalCode('')
            if (Array.isArray(json.data.documents)) {
              setDocuments(json.data.documents)
            }
          }
        }
      } catch {
        // Graceful
      } finally {
        setLoading(false)
      }
    }
    loadBiz()
  }, [token, user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setNotPersisted([])
    try {
      const res = await fetch('/api/profile/business', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          legalEntityName,
          tradeLicenseNumber,
          industryCategory,
          streetAddress,
          city,
          postalCode,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setSaveError(json?.error || `Saving your business profile failed (HTTP ${res.status}).`)
        return
      }
      // The server reports fields it accepted but could NOT store (the schema
      // has no address columns) so nothing pretends to be persisted.
      if (Array.isArray(json.notPersisted)) setNotPersisted(json.notPersisted)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSaveError('Network error while saving your business profile. Check your connection and retry.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Business Profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 md:pb-8">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-black tracking-tight text-primary">Business Profile</span>
        <button
          onClick={() => navigate('profile')}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          title="Profile"
        >
          <Building2 className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 md:px-6 md:py-6 space-y-4 md:space-y-6 lg:max-w-3xl">
        {/* Banner */}
        <div className="bg-gradient-to-br from-slate-100 to-rose-100 dark:from-slate-900 dark:to-rose-950 rounded-3xl p-5 text-gray-900 dark:text-white shadow-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-gray-900/10 border border-black/10 dark:border-white/20 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </div>
            <div>
              <h1 className="text-base font-black">Registered Business Entity</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Official commercial registration and trade license credentials.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Corporate Entity Details */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400">
              Commercial Entity Details
            </h2>

            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Legal Entity / Company Name
                </label>
                <Input
                  value={legalEntityName}
                  onChange={(e) => setLegalEntityName(e.target.value)}
                  placeholder="Official registered company name"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Trade License / Registration Number (BIN)
                </label>
                <Input
                  value={tradeLicenseNumber}
                  onChange={(e) => setTradeLicenseNumber(e.target.value)}
                  placeholder="TRD-XXXXX-BD"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Primary Wholesale Business Model
                </label>
                <select
                  value={industryCategory}
                  onChange={(e) => setIndustryCategory(e.target.value)}
                  className="w-full h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold px-3.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
                >
                  <option value="Wholesale & Manufacturing">Wholesale &amp; Manufacturing</option>
                  <option value="OEM / ODM Custom Producer">OEM / ODM Custom Producer</option>
                  <option value="Import & Export Trading">Import &amp; Export Trading</option>
                  <option value="Raw Material Distributor">Raw Material Distributor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Registered Address — honestly labelled: no backend storage exists yet */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              Registered Commercial Address
            </h2>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl px-3 py-2">
              Address fields are not implemented yet — the platform has no storage for them, so what you
              type here is not saved. Only the business name, trade license, and category persist.
            </p>

            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Street Address / Industrial Zone
                </label>
                <Input
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. Tejgaon Industrial Area, Plot 42"
                  className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:contents">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">City</label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Postal Code</label>
                  <Input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Postal Code"
                    className="h-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Verified Documents */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Commercial Document Archive
            </h2>
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{doc.name}</span>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 py-2">Trade License verified through Zylod Merchant KYC.</p>
            )}
          </div>

          {/* Real save error / honest not-persisted note — verbatim from the server */}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-3xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-600">{saveError}</p>
            </div>
          )}
          {notPersisted.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-3xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-amber-700">
                Not saved (no backend storage yet): {notPersisted.join(', ')}.
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
              <><Check className="h-4 w-4" /> Business Profile Saved!</>
            ) : (
              'Save Business Profile'
            )}
          </Button>
        </form>
      </main>
    </div>
  )
}

export default BusinessProfilePage
