'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { ArrowLeft, Phone, Pencil, Plus, CheckCircle2 } from 'lucide-react'

interface ShippingAddress {
  id: string
  label: string
  isDefault: boolean
  companyName: string
  contactName: string
  streetLine1: string
  area: string
  city: string
  country: string
  phone: string
}

export function ShippingAddressPage() {
  const { navigate, goBack } = useNavigationStore()

  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    let mounted = true
    const fetchAddresses = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/addresses')
        if (res.ok) {
          const data = await res.json()
          const list: ShippingAddress[] = (data.data || data || []).map((a: any) => ({
            id: a.id,
            label: a.label || a.name || 'Address',
            isDefault: a.is_default || false,
            companyName: a.company_name || a.companyName || '',
            contactName: a.contact_name || a.contactName || '',
            streetLine1: a.address_line1 || a.streetLine1 || '',
            area: a.district || a.area || '',
            city: a.city || '',
            country: a.country || 'Bangladesh',
            phone: a.phone || a.contact_phone || '',
          }))
          if (mounted && list.length > 0) {
            setAddresses(list)
            setSelected(list.find((a) => a.isDefault)?.id || list[0].id)
            setLoading(false)
            return
          }
        }
      } catch (e) {
        console.error('Addresses fetch error:', e)
      }
      if (mounted) {
        // Show empty state with add button — no fallback mock data
        setAddresses([])
        setLoading(false)
      }
    }
    fetchAddresses()
    return () => { mounted = false }
  }, [])

  const selectedAddress = addresses.find((a) => a.id === selected)

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Shipping Address</h1>
        </div>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900">Shipping Address</h1>

      <main className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        {/* 3-step mini progress bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
              1
            </div>
            <span className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wide">Address</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-2" />
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">
              2
            </div>
            <span className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wide">Delivery</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-2" />
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wide">Payment</span>
          </div>
        </div>

        {/* Select Address header + New address link */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">Select Address</h2>
          <button
            onClick={() => navigate('add-address')}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            New Address
          </button>
        </div>

        {/* Address Cards */}
        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-slate-200 h-28 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && addresses.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center space-y-3">
            <p className="text-sm font-semibold text-slate-500">No saved addresses yet.</p>
            <Button
              onClick={() => navigate('add-address')}
              className="bg-primary hover:bg-primary/90 text-white text-xs font-bold h-10 px-6 rounded-2xl"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add New Address
            </Button>
          </div>
        )}

        {!loading && addresses.length > 0 && (
          <div className="space-y-3">
            {addresses.map((addr) => {
              const isSelected = selected === addr.id
              return (
                <button
                  key={addr.id}
                  onClick={() => setSelected(addr.id)}
                  className={`w-full text-left bg-white rounded-3xl p-5 border transition-all shadow-2xs ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Radio circle */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected ? 'border-primary bg-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 mt-1.5 space-y-0.5 leading-relaxed">
                          <p className="font-bold text-slate-800">{addr.companyName}</p>
                          {addr.contactName && <p>Attn: {addr.contactName}</p>}
                          <p>{addr.streetLine1}</p>
                          {addr.area && <p>{addr.area}</p>}
                          <p>{addr.city}, {addr.country}</p>
                          {addr.phone && (
                            <p className="flex items-center gap-1 text-slate-500 text-[11px] pt-0.5">
                              <Phone className="h-3 w-3" />
                              {addr.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate('edit-address', { addressId: addr.id })
                      }}
                      className="text-slate-400 hover:text-slate-700 p-1 shrink-0"
                      title="Edit address"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Bottom sticky Continue */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg mx-auto space-y-2">
          {selectedAddress && (
            <p className="text-[11px] text-slate-500">
              Shipping to: <strong className="text-slate-800">{selectedAddress.companyName || selectedAddress.label}</strong>
            </p>
          )}
          <Button
            onClick={() => navigate('delivery-method')}
            disabled={!selected}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            Continue to Delivery
            <span className="text-base leading-none">→</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ShippingAddressPage
