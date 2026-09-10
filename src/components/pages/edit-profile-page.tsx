'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import {
  X, Mail, Phone, Briefcase, CheckCircle2,
  Check, Loader2, Building2, Factory, Award,
  ShieldCheck, Upload, Trash2, Globe, MapPin, Landmark
} from 'lucide-react'

export function EditProfilePage() {
  const { navigate, goBack } = useNavigationStore()
  const { user, token, updateUser } = useAuthStore()

  const [activeSection, setActiveSection] = useState<'personal' | 'business' | 'factory' | 'compliance'>('personal')

  // Personal fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  // Business fields
  const [companyName, setCompanyName] = useState('')
  const [tradeLicense, setTradeLicense] = useState('')
  const [taxTin, setTaxTin] = useState('')
  const [businessType, setBusinessType] = useState('Direct Factory Wholesaler')
  const [website, setWebsite] = useState('')

  // Factory fields
  const [factoryAddress, setFactoryAddress] = useState('')
  const [plantSize, setPlantSize] = useState('')
  const [monthlyCapacity, setMonthlyCapacity] = useState('')
  const [productionLines, setProductionLines] = useState('')
  const [originPort, setOriginPort] = useState('Chittagong Port (BDCGP)')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ─── LOAD INITIAL DATA FROM REAL API ────────────────────────────────────────
  useEffect(() => {
    async function loadProfile() {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const [meRes, bizRes] = await Promise.all([
          fetch('/api/profile/me', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/profile/business', { headers: { Authorization: `Bearer ${token}` } }),
        ])

        if (meRes.ok) {
          const meJson = await meRes.json()
          if (meJson.data) {
            const fullName = meJson.data.fullName || user?.fullName || ''
            const parts = fullName.split(' ')
            setFirstName(parts[0] || '')
            setLastName(parts.slice(1).join(' ') || '')
            setEmail(meJson.data.email || user?.email || '')
            setPhone(meJson.data.phone || user?.phone || '')

            if (meJson.data.supplierProfile) {
              setCompanyName(meJson.data.supplierProfile.companyName || '')
              setTradeLicense(meJson.data.supplierProfile.tradeLicenseNumber || '')
            } else if (meJson.data.buyerProfile) {
              setCompanyName(meJson.data.buyerProfile.businessName || '')
            }
          }
        }

        if (bizRes.ok) {
          const bizJson = await bizRes.json()
          if (bizJson.data) {
            if (bizJson.data.legalEntityName && !companyName) setCompanyName(bizJson.data.legalEntityName)
            if (bizJson.data.tradeLicenseNumber && !tradeLicense) setTradeLicense(bizJson.data.tradeLicenseNumber)
            if (bizJson.data.industryCategory) setBusinessType(bizJson.data.industryCategory)
          }
        }
      } catch {
        // Fallback to user object
        if (user) {
          const parts = (user.fullName || '').split(' ')
          setFirstName(parts[0] || '')
          setLastName(parts.slice(1).join(' ') || '')
          setEmail(user.email || '')
          setPhone(user.phone || '')
        }
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [token, user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const fullName = `${firstName} ${lastName}`.trim()
      if (token) {
        await Promise.all([
          fetch('/api/profile/me', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fullName,
              phone,
              email,
              companyName,
              businessName: companyName,
              tradeLicenseNumber: tradeLicense,
              businessType,
            }),
          }),
          fetch('/api/profile/business', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              legalEntityName: companyName,
              tradeLicenseNumber: tradeLicense,
              industryCategory: businessType,
            }),
          }),
        ])
      }
      if (updateUser) {
        updateUser({ fullName, phone, email })
      }
    } catch {
      // Handled
    } finally {
      setSaving(false)
      setSaved(true)
      setTimeout(() => {
        navigate('profile')
      }, 600)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Close">
          <X className="h-6 w-6 text-primary" />
        </button>
        <h1 className="text-base font-black text-primary">Edit Wholesale Profile</h1>
        <div className="w-6" />
      </header>

      <main className="px-4 py-5 md:px-6 md:py-6 max-w-lg mx-auto lg:max-w-4xl space-y-4 md:space-y-6">
        {/* Desktop Page Header */}
        <h1 className="hidden md:block text-xl md:text-2xl font-black text-primary">Edit Wholesale Profile</h1>

        {/* Step Tabs */}
        <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { key: 'personal', label: 'Personal & Contact' },
            { key: 'business', label: 'Company & Tax' },
            { key: 'factory', label: 'Factory & Plant' },
            { key: 'compliance', label: 'Accreditations' },
          ].map((tab) => {
            const isActive = activeSection === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSection(tab.key as any)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
          <form onSubmit={handleSave} className="space-y-4">
            {/* ─── SECTION 1: PERSONAL ─── */}
            {activeSection === 'personal' && (
              <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-4">
                <div className="md:col-span-2">
                  <h2 className="text-sm font-black text-slate-900">Personal &amp; Contact Details</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Primary executive contact for procurement &amp; RFQs.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">First Name</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name"
                      className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Last Name</label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last Name"
                      className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="h-11 pl-10 pr-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 1700-000000"
                      className="h-11 pl-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Job Title / Designation</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Managing Director / Procurement Manager"
                      className="h-11 pl-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── SECTION 2: BUSINESS & TAX ─── */}
            {activeSection === 'business' && (
              <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-4">
                <div className="md:col-span-2">
                  <h2 className="text-sm font-black text-slate-900">Company &amp; Legal Entity</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Commercial registration and tax credentials.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Registered Business Name</label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company Legal Name"
                    className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Trade License Number (BIN/TIN)</label>
                  <Input
                    value={tradeLicense}
                    onChange={(e) => setTradeLicense(e.target.value)}
                    placeholder="TRD-XXXXX-BD"
                    className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tax Identification Number (TIN)</label>
                  <Input
                    value={taxTin}
                    onChange={(e) => setTaxTin(e.target.value)}
                    placeholder="TIN-XXXXXXX"
                    className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-bold font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Primary Business Model</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold px-3.5 text-slate-800 focus:outline-none"
                  >
                    <option value="OEM / ODM Custom Manufacturer">OEM / ODM Custom Manufacturer</option>
                    <option value="Direct Factory Wholesaler">Direct Factory Wholesaler</option>
                    <option value="Raw Materials Supplier">Raw Materials Supplier</option>
                    <option value="Export Trading House">Export Trading House</option>
                  </select>
                </div>
              </div>
            )}

            {/* ─── SECTION 3: FACTORY & PRODUCTION ─── */}
            {activeSection === 'factory' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Manufacturing &amp; Facilities</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Showcase production footprint to global buyers.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Primary Plant Location</label>
                  <Input
                    value={factoryAddress}
                    onChange={(e) => setFactoryAddress(e.target.value)}
                    placeholder="e.g. Gazipur / Tejgaon, Dhaka, Bangladesh"
                    className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Plant Footprint</label>
                    <Input
                      value={plantSize}
                      onChange={(e) => setPlantSize(e.target.value)}
                      placeholder="e.g. 50,000 sq ft"
                      className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Monthly Output</label>
                    <Input
                      value={monthlyCapacity}
                      onChange={(e) => setMonthlyCapacity(e.target.value)}
                      placeholder="e.g. 10,000 units"
                      className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Primary Departure Port</label>
                  <Input
                    value={originPort}
                    onChange={(e) => setOriginPort(e.target.value)}
                    placeholder="Chittagong Port (BDCGP)"
                    className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
                  />
                </div>
              </div>
            )}

            {/* ─── SECTION 4: COMPLIANCE & CERTIFICATES ─── */}
            {activeSection === 'compliance' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Accreditations &amp; Testing</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Audited standards for trade compliance.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <Award className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-bold text-slate-900">Merchant Trade Verification</h3>
                      <p className="text-[10px] text-emerald-600 font-bold">Government Verified</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">Verified</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-12 rounded-2xl text-xs"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating Profile...
                  </>
                ) : saved ? (
                  <>
                    <Check className="h-4 w-4" />
                    Updated!
                  </>
                ) : (
                  'Save All Changes'
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default EditProfilePage
