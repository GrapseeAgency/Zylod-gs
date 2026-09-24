'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore } from '@/store/cart-store'
import {
  ArrowLeft, MapPin, Truck, CreditCard, Lock,
  Package, AlertCircle, Loader2
} from 'lucide-react'

/**
 * REAL order review — no demo items, no invented addresses, no fake success.
 * - Items come from the real cart store (synced with the backend).
 * - Shipping address comes from GET /api/addresses.
 * - Delivery options come from GET /api/delivery-methods (admin-configured).
 * - "Place Order" calls POST /api/orders, which re-prices everything
 *   server-side. Backend errors are surfaced verbatim — never hidden.
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
}

interface DeliveryMethod {
  id: string
  name: string
  description?: string | null
  estimated_delivery?: string | null
  price: number
}

export function OrderSummaryPage() {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { items, clearCart } = useCartStore()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)

  const [addresses, setAddresses] = useState<AddressData[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState('')

  const [methods, setMethods] = useState<DeliveryMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(true)
  const [methodsError, setMethodsError] = useState('')
  const [selectedMethodId, setSelectedMethodId] = useState('')

  const loadAddresses = useCallback(async () => {
    setAddressesLoading(true)
    setError('')
    try {
      const res = await fetch('/api/addresses', { credentials: 'include' })
      if (res.status === 401) {
        setNeedsAuth(true)
        setAddresses([])
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setError(data?.error || `Could not load addresses (HTTP ${res.status})`)
        setAddresses([])
        return
      }
      const list: AddressData[] = Array.isArray(data.data) ? data.data : []
      setAddresses(list)
      const def = list.find((a) => a.isDefault) || list[0]
      if (def) setSelectedAddressId(def.id)
    } catch {
      setError('Network error while loading your addresses. Check your connection and retry.')
    } finally {
      setAddressesLoading(false)
    }
  }, [])

  const loadMethods = useCallback(async () => {
    setMethodsLoading(true)
    setMethodsError('')
    try {
      const res = await fetch('/api/delivery-methods')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setMethodsError(data?.error || `Could not load delivery methods (HTTP ${res.status})`)
        setMethods([])
        return
      }
      const list: DeliveryMethod[] = Array.isArray(data.data) ? data.data : []
      setMethods(list)
      if (list[0]) setSelectedMethodId(list[0].id)
    } catch {
      setMethodsError('Network error while loading delivery methods.')
    } finally {
      setMethodsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAddresses()
    loadMethods()
  }, [loadAddresses, loadMethods])

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null
  const selectedMethod = methods.find((m) => m.id === selectedMethodId) || null

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.totalPrice || i.unitPrice * i.quantity), 0),
    [items]
  )
  const shippingDisplay = selectedMethod?.price || 0
  const total = subtotal + shippingDisplay

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
        // Real backend error (stock, MOQ, availability…) — shown verbatim.
        setError(data?.error || `Order failed (HTTP ${res.status}). Please try again.`)
        return
      }

      // Real order created server-side — status starts UNPAID.
      clearCart()
      navigate('order-confirmation', {
        orderId: data.data.orderId,
        orderNumber: data.data.orderNumber,
      })
    } catch {
      setError('Network error while placing the order. Check your connection and retry.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Empty cart — honest state, no fake product ───
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Review Order</h1>
          </div>
        </header>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-black text-slate-900">Nothing to review</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Your cart is empty. Add products to the cart first and your order
            summary will appear here.
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

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+140px)] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Review Order</h1>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-3.5 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        {/* Shipping, Delivery, Payment, Items */}
        <div className="space-y-3.5 lg:col-span-2">
          {/* Real error banner */}
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

          {/* Shipping To Card — real saved address */}
          <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">Shipping To</h2>
              <button
                onClick={() => navigate('shipping-address')}
                className="text-xs font-bold text-primary hover:underline"
              >
                Edit
              </button>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <MapPin className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
              {addressesLoading ? (
                <div className="flex-1 space-y-2" aria-busy="true">
                  <div className="h-3.5 w-1/3 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
                </div>
              ) : selectedAddress ? (
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-bold text-slate-900">
                    {selectedAddress.companyName || selectedAddress.contactName || selectedAddress.label}
                  </p>
                  <p>
                    {selectedAddress.addressLine1}
                    {selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ''}
                  </p>
                  <p>
                    {selectedAddress.city}, {selectedAddress.district} {selectedAddress.postalCode}, {selectedAddress.country}
                  </p>
                  {selectedAddress.contactPhone && (
                    <p className="text-[11px] text-slate-400 pt-0.5">Contact: {selectedAddress.contactPhone}</p>
                  )}
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900">No shipping address on file</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Add a real delivery address before placing the order.
                  </p>
                  <Button
                    onClick={() => navigate('shipping-address')}
                    className="mt-2 h-9 px-4 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl"
                  >
                    Add Address
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Method Card — real admin-configured methods only */}
          <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">Delivery Method</h2>
              <button
                onClick={() => navigate('delivery-method')}
                className="text-xs font-bold text-primary hover:underline"
              >
                Edit
              </button>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <Truck className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
              {methodsLoading ? (
                <div className="flex-1 space-y-2" aria-busy="true">
                  <div className="h-3.5 w-1/3 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
              ) : selectedMethod ? (
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-bold text-slate-900">{selectedMethod.name}</p>
                  {selectedMethod.estimated_delivery && (
                    <p className="text-slate-500">Estimated Delivery: {selectedMethod.estimated_delivery}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {selectedMethod.price > 0 ? formatPrice(selectedMethod.price) : 'No extra freight charge configured'}
                  </p>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900">
                    {methodsError ? methodsError : 'No delivery methods configured yet'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {methodsError
                      ? 'You can still place the order — freight is arranged with the supplier.'
                      : 'Freight will be arranged with the supplier after the order is placed.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Card — honest: orders start UNPAID */}
          <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">Payment Method</h2>
              <button
                onClick={() => navigate('payment-method')}
                className="text-xs font-bold text-primary hover:underline"
              >
                Edit
              </button>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <CreditCard className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-0.5">
                <p className="font-bold text-slate-900">Pay after the order is placed</p>
                <p className="text-slate-500 text-[11px]">
                  Orders start as UNPAID. Payment instructions are provided on the
                  order once placed, and the supplier confirms only after payment is verified.
                </p>
              </div>
            </div>
          </div>

          {/* Items Card — real cart items */}
          <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-slate-900">Items ({items.length})</h2>

            <div className="divide-y divide-slate-100 space-y-3 pt-1">
              {items.map((item, idx) => (
                <div key={item.id} className={`flex gap-3 items-center ${idx > 0 ? 'pt-3' : ''}`}>
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                      {item.productName}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Supplier: {item.supplierName || '--'}
                    </p>
                    <div className="flex justify-between items-baseline mt-1.5">
                      <span className="text-xs font-bold text-slate-600">
                        Qty: {item.quantity} {item.unit}
                      </span>
                      <span className="text-xs font-black text-primary">
                        {formatPrice(item.totalPrice || item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Totals Card — real cart numbers; server re-prices on placement */}
        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-2xs space-y-2.5 text-xs text-slate-600 lg:self-start">
          <div className="flex justify-between">
            <span>Subtotal ({itemCount} units)</span>
            <span className="font-semibold text-slate-900">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping{selectedMethod ? ` (${selectedMethod.name})` : ''}</span>
            <span className="font-semibold text-slate-900">
              {selectedMethod ? formatPrice(shippingDisplay) : 'Arranged with supplier'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-900">Total</span>
            <span className="text-xl md:text-2xl font-black text-primary">{formatPrice(total)}</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            The final total is re-priced from the database on the server when the
            order is placed — cart totals are display-only.
          </p>
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30">
        <div className="max-w-lg md:max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Estimated total</span>
            <span className="text-base font-black text-primary">{formatPrice(total)}</span>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={submitting || addressesLoading || !selectedAddress}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {submitting ? 'Placing Order...' : 'Place Order'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default OrderSummaryPage
