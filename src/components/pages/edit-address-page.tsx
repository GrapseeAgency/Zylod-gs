'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Save, Trash2, Building2, Store, MapPin } from 'lucide-react'

type AddressLabel = 'Warehouse' | 'Shop' | 'Office' | 'Other'

export function EditAddressPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { goBack, navigate, pageParams: storeParams } = useNavigationStore()
  const pageParams = _pageParams || storeParams || {}
  const addressId = pageParams.addressId || ''

  const [form, setForm] = useState({
    contactName: '',
    phone: '',
    areaRegion: '',
    streetAddress: '',
    landmark: '',
    isDefault: true,
    label: 'Warehouse' as AddressLabel,
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let mounted = true
    const fetchAddress = async () => {
      if (!addressId) { setLoading(false); return }
      try {
        const res = await fetch(`/api/addresses/${addressId}`)
        if (res.ok) {
          const data = await res.json()
          const a = data.data || data
          if (mounted && a) {
            setForm({
              contactName: a.contact_name || a.contactName || '',
              phone: a.contact_phone || a.phone || '',
              areaRegion: a.district || a.area || '',
              streetAddress: [a.address_line1, a.address_line2].filter(Boolean).join('\n'),
              landmark: a.landmark || '',
              isDefault: a.is_default ?? true,
              label: (a.label as AddressLabel) || 'Warehouse',
            })
          }
        }
      } catch (e) {
        console.error('Edit address fetch error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchAddress()
    return () => { mounted = false }
  }, [addressId])

  const setField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  const handleUpdate = async () => {
    const e: Record<string, string> = {}
    if (!form.contactName.trim()) e.contactName = 'Contact name is required'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    if (!form.streetAddress.trim()) e.streetAddress = 'Street address is required'
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSaving(true)
    try {
      const lines = form.streetAddress.split('\n').filter(Boolean)
      const res = await fetch(`/api/addresses/${addressId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: form.contactName,
          contact_phone: form.phone,
          district: form.areaRegion,
          address_line1: lines[0] || '',
          address_line2: lines[1] || undefined,
          landmark: form.landmark || undefined,
          is_default: form.isDefault,
          label: form.label,
        }),
      })
      if (res.ok) {
        goBack()
      } else {
        const data = await res.json()
        setErrors({ _server: data.message || 'Failed to update address' })
      }
    } catch {
      setErrors({ _server: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!addressId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/addresses/${addressId}`, { method: 'DELETE' })
      if (res.ok) {
        navigate('shipping-address')
      } else {
        setErrors({ _server: 'Failed to delete address.' })
      }
    } catch {
      setErrors({ _server: 'Network error. Please try again.' })
    } finally {
      setDeleting(false)
    }
  }

  const AREAS = [
    'Motijheel, Dhaka', 'Gulshan, Dhaka', 'Banani, Dhaka', 'Tejgaon, Dhaka',
    'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Mymensingh', 'Rangpur',
  ]

  const LABELS: AddressLabel[] = ['Warehouse', 'Shop', 'Office', 'Other']

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] md:pb-8 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Edit Address</h1>
        </div>
      </header>

      {/* Map Thumbnail (decorative / real map if Google Maps API present) */}
      <div className="relative h-36 md:h-48 bg-slate-200 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-200 to-slate-300">
          {/* Grid lines to simulate map look */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-30">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="border border-slate-400" />
            ))}
          </div>
          {/* Streets simulation */}
          <div className="absolute left-1/4 top-0 bottom-0 w-2 bg-white/60" />
          <div className="absolute left-2/3 top-0 bottom-0 w-1 bg-white/40" />
          <div className="absolute top-1/3 left-0 right-0 h-2 bg-white/60" />
          <div className="absolute top-2/3 left-0 right-0 h-1 bg-white/40" />
        </div>

        {/* Map pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
          <div className="w-8 h-8 bg-primary text-white rounded-full rounded-bl-none rotate-[-45deg] flex items-center justify-center shadow-lg">
            <MapPin className="h-4 w-4 rotate-45" />
          </div>
        </div>

        {/* Adjust Map button */}
        <div className="absolute bottom-2 right-2">
          <span className="bg-white text-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg shadow border border-slate-200 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary" />
            Adjust Map
          </span>
        </div>
      </div>

      <main className="px-4 py-5 md:px-6 md:py-6 space-y-5 md:space-y-6 max-w-lg mx-auto lg:max-w-4xl">
        <h1 className="hidden md:block text-xl md:text-2xl font-bold text-slate-900">Edit Address</h1>
        {errors._server && (
          <p className="text-xs text-red-600 font-semibold bg-red-50 rounded-2xl px-4 py-3 border border-red-100">
            {errors._server}
          </p>
        )}

        {/* Contact Details */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 md:col-span-2">
            Contact Details
          </h3>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Contact Name</label>
            <Input
              value={form.contactName}
              onChange={(e) => setField('contactName', e.target.value)}
              className={`h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium ${errors.contactName ? 'border-red-400' : ''}`}
            />
            {errors.contactName && <p className="text-[10px] text-red-500 font-medium">{errors.contactName}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Phone Number</label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              className={`h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium ${errors.phone ? 'border-red-400' : ''}`}
            />
            {errors.phone && <p className="text-[10px] text-red-500 font-medium">{errors.phone}</p>}
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 md:col-span-2">
            Delivery Address
          </h3>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Area / Region</label>
            <select
              value={form.areaRegion}
              onChange={(e) => setField('areaRegion', e.target.value)}
              className="w-full h-11 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium px-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select area or region</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Street Address & Warehouse No.</label>
            <Textarea
              value={form.streetAddress}
              onChange={(e) => setField('streetAddress', e.target.value)}
              rows={3}
              className={`rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium resize-none ${errors.streetAddress ? 'border-red-400' : ''}`}
              placeholder="e.g. Warehouse 4B, 12/A Dilkusha Commercial Area"
            />
            {errors.streetAddress && <p className="text-[10px] text-red-500 font-medium">{errors.streetAddress}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Nearest Landmark <span className="text-slate-400">(Optional)</span></label>
            <Input
              value={form.landmark}
              onChange={(e) => setField('landmark', e.target.value)}
              className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium"
              placeholder="e.g. Behind Janata Bank Main Branch"
            />
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">
            Settings
          </h3>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">Set as Default Delivery Address</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Future wholesale orders will default here.</p>
            </div>
            <button
              onClick={() => setField('isDefault', !form.isDefault)}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.isDefault ? 'bg-primary' : 'bg-slate-300'}`}
              role="switch"
              aria-checked={form.isDefault}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isDefault ? 'left-5' : 'left-0.5'}`}
              />
            </button>
          </div>

          {/* Address Label Chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Address Label</label>
            <div className="flex gap-2 flex-wrap">
              {LABELS.map((lbl) => {
                const Icon = lbl === 'Warehouse' ? Building2 : lbl === 'Shop' ? Store : lbl === 'Office' ? Building2 : MapPin
                return (
                  <button
                    key={lbl}
                    onClick={() => setField('label', lbl)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-colors ${
                      form.label === lbl
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {lbl}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30 md:static md:border-0 md:bg-transparent md:p-0 md:pb-2 md:shadow-none">
        <div className="max-w-lg mx-auto space-y-2 md:max-w-4xl md:flex md:gap-3 md:space-y-0">
          <Button
            onClick={handleUpdate}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Updating...' : 'Update Address'}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full bg-transparent hover:bg-red-50 text-red-500 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2 border border-red-100"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EditAddressPage
