'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Phone, Save, Building2 } from 'lucide-react'

export function AddAddressPage() {
  const { navigate, goBack } = useNavigationStore()

  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    phone: '',
    country: '',
    streetLine1: '',
    streetLine2: '',
    city: '',
    postalCode: '',
    setAsDefault: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const setField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    if (!form.country.trim()) e.country = 'Country/Region is required'
    if (!form.streetLine1.trim()) e.streetLine1 = 'Street address is required'
    if (!form.city.trim()) e.city = 'City is required'
    if (!form.postalCode.trim()) e.postalCode = 'Postal/Zip code is required'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.fullName,
          company_name: form.businessName || undefined,
          contact_name: form.fullName,
          contact_phone: form.phone,
          address_line1: form.streetLine1,
          address_line2: form.streetLine2 || undefined,
          city: form.city,
          postal_code: form.postalCode,
          country: form.country,
          is_default: form.setAsDefault,
        }),
      })
      if (res.ok) {
        goBack()
      } else {
        const data = await res.json()
        setErrors({ _server: data.message || 'Failed to save address' })
      }
    } catch {
      setErrors({ _server: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const COUNTRIES = [
    'Bangladesh', 'India', 'Pakistan', 'China', 'USA', 'UK', 'UAE',
    'Germany', 'Japan', 'South Korea', 'Turkey', 'Malaysia', 'Singapore',
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-primary">Add New Address</h1>
        </div>
        <div className="h-0.5 bg-primary absolute bottom-0 left-0 right-0" />
      </header>

      <main className="px-4 py-5 md:px-6 md:py-6 space-y-5 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        <h2 className="text-base md:text-xl font-black text-slate-900">Delivery Information</h2>

        {/* Server Error */}
        {errors._server && (
          <p className="text-xs text-red-600 font-semibold bg-red-50 rounded-2xl px-4 py-3 border border-red-100">
            {errors._server}
          </p>
        )}

        {/* Contact Details Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">
            Contact Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Full Name <span className="text-primary">*</span>
            </label>
            <Input
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              placeholder="e.g. John Doe"
              className={`h-11 rounded-2xl bg-white border-slate-200 text-xs font-medium ${errors.fullName ? 'border-red-400' : ''}`}
            />
            {errors.fullName && <p className="text-[10px] text-red-500 font-medium">{errors.fullName}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Business Name <span className="text-slate-400">(Optional)</span>
            </label>
            <Input
              value={form.businessName}
              onChange={(e) => setField('businessName', e.target.value)}
              placeholder="e.g. Acme Corp"
              className="h-11 rounded-2xl bg-white border-slate-200 text-xs font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Phone Number <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
                className={`h-11 pl-10 rounded-2xl bg-white border-slate-200 text-xs font-medium ${errors.phone ? 'border-red-400' : ''}`}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-medium pl-1">Used for delivery updates.</p>
            {errors.phone && <p className="text-[10px] text-red-500 font-medium">{errors.phone}</p>}
          </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">
            Address
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Country/Region <span className="text-primary">*</span>
            </label>
            <select
              value={form.country}
              onChange={(e) => setField('country', e.target.value)}
              className={`w-full h-11 rounded-2xl bg-white border text-xs font-medium px-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.country ? 'border-red-400' : 'border-slate-200'
              }`}
            >
              <option value="">Select a country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.country && <p className="text-[10px] text-red-500 font-medium">{errors.country}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Street Address <span className="text-primary">*</span>
            </label>
            <Input
              value={form.streetLine1}
              onChange={(e) => setField('streetLine1', e.target.value)}
              placeholder="Street address, P.O. box, company name, c/o"
              className={`h-11 rounded-2xl bg-white border-slate-200 text-xs font-medium ${errors.streetLine1 ? 'border-red-400' : ''}`}
            />
            <Input
              value={form.streetLine2}
              onChange={(e) => setField('streetLine2', e.target.value)}
              placeholder="Apartment, suite, unit, building, floor, etc. (Optional)"
              className="h-11 rounded-2xl bg-white border-slate-200 text-xs font-medium mt-2"
            />
            {errors.streetLine1 && <p className="text-[10px] text-red-500 font-medium">{errors.streetLine1}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              City <span className="text-primary">*</span>
            </label>
            <Input
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              className={`h-11 rounded-2xl bg-white border-slate-200 text-xs font-medium ${errors.city ? 'border-red-400' : ''}`}
            />
            {errors.city && <p className="text-[10px] text-red-500 font-medium">{errors.city}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Postal/Zip Code <span className="text-primary">*</span>
            </label>
            <Input
              value={form.postalCode}
              onChange={(e) => setField('postalCode', e.target.value)}
              className={`h-11 rounded-2xl bg-white border-slate-200 text-xs font-medium ${errors.postalCode ? 'border-red-400' : ''}`}
            />
            {errors.postalCode && <p className="text-[10px] text-red-500 font-medium">{errors.postalCode}</p>}
          </div>
          </div>
        </div>

        {/* Default address toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={form.setAsDefault}
            onChange={(e) => setField('setAsDefault', e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-xs font-semibold text-slate-700">Set as default shipping address</span>
        </label>

        {/* Desktop Actions */}
        <div className="hidden md:flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Address'}
          </Button>
          <Button
            variant="outline"
            onClick={goBack}
            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-12 rounded-2xl text-xs px-8"
          >
            Cancel
          </Button>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30 md:hidden">
        <div className="max-w-lg mx-auto space-y-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Address'}
          </Button>
          <Button
            variant="outline"
            onClick={goBack}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold h-11 rounded-2xl text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AddAddressPage
