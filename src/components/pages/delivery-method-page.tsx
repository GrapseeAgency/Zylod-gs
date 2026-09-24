'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { ArrowLeft, Truck, Plane, Store, CheckCircle2 } from 'lucide-react'

interface DeliveryOption {
  id: string
  name: string
  description: string
  price: number
  isFree?: boolean
  badge?: string
  badgeVariant?: 'default' | 'best' | 'fastest'
  icon: 'truck' | 'plane' | 'store'
  pickupAddress?: string
}

export function DeliveryMethodPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [methods, setMethods] = useState<DeliveryOption[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let mounted = true
    const fetchMethods = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch('/api/delivery-methods')
        if (res.ok) {
          const data = await res.json()
          const list: DeliveryOption[] = (data.data || data || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            description: m.description || m.estimated_delivery || '',
            price: m.price || 0,
            isFree: m.price === 0,
            badge: m.badge,
            badgeVariant: m.badge_variant || 'default',
            icon: m.icon || 'truck',
            pickupAddress: m.pickup_address,
          }))
          if (mounted) {
            setMethods(list)
            if (list.length > 0) setSelected(list[0].id)
            else setLoadError('No delivery methods have been configured yet.')
            setLoading(false)
            return
          }
        } else {
          const errData = await res.json().catch(() => null)
          if (mounted) setLoadError(errData?.error || `Could not load delivery methods (HTTP ${res.status}).`)
        }
      } catch (e) {
        console.error('Delivery methods fetch error:', e)
        if (mounted) setLoadError('Network error while loading delivery methods.')
      }
      if (mounted) {
        // HONEST STATE: no invented couriers/prices when the API has no data
        setMethods([])
        setSelected('')
        setLoading(false)
      }
    }
    fetchMethods()
    return () => { mounted = false }
  }, [])

  const selectedMethod = methods.find((m) => m.id === selected)

  const Icon = ({ type }: { type: DeliveryOption['icon'] }) => {
    if (type === 'plane') return <Plane className="h-5 w-5 text-primary" />
    if (type === 'store') return <Store className="h-5 w-5 text-primary" />
    return <Truck className="h-5 w-5 text-primary" />
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <div className="w-5" />
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 md:py-8 space-y-4 md:space-y-6 max-w-lg mx-auto lg:max-w-3xl">
        {/* Page Title */}
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Select Delivery Method</h1>
          <p className="text-xs text-slate-500 mt-1">Choose how you want your wholesale order delivered.</p>
        </div>

        {/* Delivery Option Cards */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-slate-200 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {loadError && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-center" role="alert">
            <p className="text-xs font-bold text-amber-800">{loadError}</p>
            <p className="text-[11px] text-amber-700 mt-1">
              Delivery options are set up by the site admin. Nothing is invented here — check back once
              real courier methods have been added.
            </p>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
            {methods.map((method) => {
              const isSelected = selected === method.id

              return (
                <button
                  key={method.id}
                  onClick={() => setSelected(method.id)}
                  className={`w-full text-left bg-white rounded-3xl p-5 border transition-all shadow-2xs ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon circle */}
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon type={method.icon} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900">{method.name}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">{method.description}</p>
                        </div>

                        {/* Price */}
                        <div className="shrink-0 text-right">
                          {method.isFree ? (
                            <span className="text-sm font-black text-primary">Free</span>
                          ) : (
                            <span className="text-sm font-black text-slate-900">
                              {formatPrice(method.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Badge */}
                      {method.badge && (
                        <div className="mt-2">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-md inline-block ${
                              method.badgeVariant === 'fastest'
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {method.badge}
                          </span>
                        </div>
                      )}

                      {/* Pickup address if available */}
                      {method.pickupAddress && (
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                          {method.pickupAddress}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Sticky Continue Button */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg mx-auto lg:max-w-3xl">
          <Button
            onClick={() => navigate('payment-method')}
            disabled={!selected}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md"
          >
            Continue to Payment
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DeliveryMethodPage
