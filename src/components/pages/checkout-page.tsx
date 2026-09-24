'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, MapPin, CreditCard, Check, CheckCircle2, Package,
  Lock, AlertCircle, Loader2, Plus
} from 'lucide-react'

/**
 * REAL checkout — no fake success, no hardcoded products/addresses/fees.
 * - Cart items come from the real cart store (synced with the backend).
 * - Shipping address comes from the real /api/addresses endpoint.
 * - Order creation goes through POST /api/orders, which re-prices every item
 *   server-side from the database (client totals are display-only).
 * - Backend errors are surfaced verbatim — never hidden, never faked.
 */

interface AddressData {
  id: string
  label: string
  companyName?: string | null
  contactName?: string | null
  contactPhone?: string | null
  addressLine1: string
  addressLine2?: string | null
  city: string
  district: string
  postalCode: string
  country: string
  isDefault: boolean
  is_default?: boolean
  address_line1?: string
}

export function CheckoutPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { items, clearCart } = useCartStore()

  const [submitting, setSubmitting] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<{ orderNumber: string; paymentStatus: string } | null>(null)
  const [error, setError] = useState<string>('')
  const [needsAuth, setNeedsAuth] = useState(false)

  const [addresses, setAddresses] = useState<AddressData[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressesError, setAddressesError] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')

  const loadAddresses = useCallback(async () => {
    setAddressesLoading(true)
    setAddressesError('')
    try {
      const res = await fetch('/api/addresses', { credentials: 'include' })
      if (res.status === 401) {
        setNeedsAuth(true)
        setAddressesError('You must be signed in as a buyer before checking out.')
        setAddresses([])
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setAddressesError(data?.error || `Could not load addresses (HTTP ${res.status})`)
        setAddresses([])
        return
      }
      const list: AddressData[] = Array.isArray(data.data) ? data.data : []
      setAddresses(list)
      const def = list.find((a) => a.isDefault || a.is_default) || list[0]
      if (def) setSelectedAddressId(def.id)
      if (list.length === 0) {
        setAddressesError('No shipping address on file. Add a real delivery address to continue.')
      }
    } catch {
      setAddressesError('Network error while loading your addresses. Check your connection and retry.')
    } finally {
      setAddressesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAddresses()
  }, [loadAddresses])

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + (i.totalPrice || i.unitPrice * i.quantity), 0), [items])

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null

  const handlePlaceOrder = async () => {
    setError('')
    if (items.length === 0) {
      setError('Your cart is empty — add products before placing an order.')
      return
    }
    if (!selectedAddress) {
      setError('Select a real shipping address before placing the order.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shippingAddressId: selectedAddress.id,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId || null,
            quantity: i.quantity,
            supplierId: i.supplierId,
          })),
        }),
      })
      const data = await res.json().catch(() => null)

      if (res.status === 401) {
        setNeedsAuth(true)
        setError(data?.error || 'Your session has expired. Sign in again to place this order.')
        return
      }
      if (!res.ok || !data?.success) {
        // Surface the REAL backend error (stock, MOQ, address, product availability…)
        setError(data?.error || `Order failed (HTTP ${res.status}). Please try again.`)
        return
      }

      // Real order created server-side — status starts as UNPAID.
      clearCart()
      setPlacedOrder({
        orderNumber: data.data.orderNumber,
        paymentStatus: data.data.paymentStatus,
      })
      setOrderPlaced(true)
    } catch {
      setError('Network error while placing the order. Check your connection and retry.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Success screen (real order number, honest unpaid status) ───
  if (orderPlaced && placedOrder) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 md:p-10 text-center text-slate-900">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10 md:h-12 w-12" />
        </div>
        <h1 className="text-xl md:text-2xl font-black text-slate-900">Order {placedOrder.orderNumber} Created</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Status: <span className="font-bold text-amber-600 uppercase">{placedOrder.paymentStatus}</span>.
          The order is NOT confirmed until payment is verified. The supplier sees it now.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            View My Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    )
  }

  // ─── Empty cart — honest state, no fake product ───
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
          <div className="flex items-center justify-between">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
            <div className="w-5" />
          </div>
        </header>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-black text-slate-900">Your cart is empty</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Nothing to check out. Browse the catalog and add products first.
          </p>
          <Button
            onClick={() => navigate('home')}
            className="mt-5 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl"
          >
            Browse Products
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <div className="w-5" />
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
        {/* Page Title */}
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Review Order ({items.length} item{items.length > 1 ? 's' : ''})
        </h1>

        {/* Error banner — real backend errors shown verbatim */}
        {(error || needsAuth) && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" role="alert">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-700">{error || 'Sign in required.'}</p>
              {needsAuth && (
                <Button
                  onClick={() => navigate('login')}
                  className="mt-2 h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Card 1: Shipping Address (real, from /api/addresses) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Shipping Address</h2>
            </div>
            <button
              onClick={() => navigate('shipping-address')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-0.5 pt-1 pl-6">
            {addressesLoading ? (
              <p className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading your addresses…
              </p>
            ) : selectedAddress ? (
              <>
                <p className="font-bold text-slate-900">
                  {selectedAddress.label}
                  {(selectedAddress.isDefault || selectedAddress.is_default) && (
                    <span className="ml-2 text-[10px] font-black text-primary uppercase">Default</span>
                  )}
                </p>
                {selectedAddress.contactName && <p>{selectedAddress.contactName}</p>}
                <p>{selectedAddress.addressLine1}{selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ''}</p>
                <p>{selectedAddress.city}, {selectedAddress.district} {selectedAddress.postalCode}, {selectedAddress.country}</p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-500">{addressesError || 'No shipping address on file.'}</p>
                <Button
                  onClick={() => navigate('add-address')}
                  className="h-9 px-4 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Address
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Items (real cart contents) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs md:text-sm font-bold text-slate-900">Items</h2>
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.productImage ? (
                    <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{item.productName}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Qty: {item.quantity} · {item.supplierName}
                    {item.variantName ? ` · ${item.variantName}: ${item.variantValue}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-900 shrink-0">
                {formatPrice(item.totalPrice || item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Card 3: Payment (honest state — no gateway faked) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold text-slate-900">Payment</h2>
          </div>
          <div className="flex items-start gap-2 pt-1 pl-6 text-xs text-slate-600">
            <Lock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
            <p>
              The order is created with status <span className="font-bold">UNPAID</span>. Payment must be
              completed and verified before the supplier confirms — the total is re-verified server-side
              from live catalog prices, so amounts shown here are final only after the server confirms.
            </p>
          </div>
        </div>

        </div>

        {/* Card 4: Order Summary (sticky sidebar on desktop) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <h2 className="text-xs md:text-sm font-bold text-slate-900">Order Summary</h2>

          <div className="space-y-1.5 text-xs text-slate-500 pt-1">
            <div className="flex justify-between">
              <span>Items ({items.length})</span>
              <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping & fees</span>
              <span className="font-semibold text-slate-800">Settled with supplier</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-800">Goods total</span>
            <div className="text-xl md:text-2xl font-black text-primary">
              {formatPrice(subtotal)}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Prices are recalculated from the live database when the order is placed. Stock and MOQ
            are enforced server-side.
          </p>
        </div>
        </aside>

        {/* Place Order CTA */}
        <div className="lg:col-span-2">
        <Button
          onClick={handlePlaceOrder}
          disabled={submitting || addressesLoading || !selectedAddress}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md mt-2 lg:mt-0"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Placing Order…
            </span>
          ) : (
            'Place Order'
          )}
        </Button>
        </div>
      </main>
    </div>
  )
}

export default CheckoutPage
