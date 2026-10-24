'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Truck, CreditCard, CheckCircle2,
  MapPin, Package, AlertCircle, RefreshCw, LogIn, Minus, Plus
} from 'lucide-react'

interface ProductData {
  id: string
  name: string
  slug?: string
  basePrice?: number
  unit?: string
  moq?: number
  stockQuantity?: number
  weightKg?: number | null
  thumbnailUrl?: string | null
  images?: Array<{ imageUrl?: string; url?: string }>
  supplier?: { id: string; companyName: string } | null
}

interface AddressData {
  id: string
  label: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  district?: string | null
  postalCode?: string | null
  isDefault: boolean
}

interface PlacedOrder {
  orderId: string
  orderNumber: string
  totalAmount: number
  shippingFee?: number
  paymentStatus: string
}

/** One option from the real quote rail (GET /api/shipping/quote). */
interface ShippingOption {
  methodId: string
  methodName: string
  estimatedDays: string | null
  basePrice: number
  price: number
  freeShipping: boolean
  freeAbove: number | null
}

export function BuyNowPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const pageParams = _pageParams || storeParams || {}
  const productId = pageParams.productId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<ProductData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)

  const [quantity, setQuantity] = useState<number | null>(null)
  const [addresses, setAddresses] = useState<AddressData[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [addressesLoaded, setAddressesLoaded] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null)

  // Task 95: live shipping quote for THIS shipment + the buyer's pick.
  const [quote, setQuote] = useState<{ loading: boolean; options: ShippingOption[]; error: string } | null>(null)
  const [shippingMethodId, setShippingMethodId] = useState<string>('')
  const [quoteTick, setQuoteTick] = useState(0)

  const fetchData = useCallback(async () => {
    if (!productId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setNotFound(false)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/products/${productId}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 404) {
          setNotFound(true)
        } else if (res.status === 401) {
          setNeedsAuth(true)
        } else {
          setError(data?.error || `Failed to load product (${res.status})`)
        }
        setProduct(null)
        return
      }
      const p: ProductData = data?.data
      setProduct(p || null)
      const moq = p?.moq || 1
      const paramQty = Math.round(parseFloat(pageParams.quantity || '') * 100) / 100
      const initial = isNaN(paramQty) || paramQty < moq ? moq : paramQty
      setQuantity(p?.stockQuantity && p.stockQuantity > 0 ? Math.min(initial, p.stockQuantity) : initial)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error while loading product')
      setProduct(null)
    } finally {
      setLoading(false)
    }
  }, [productId, pageParams.quantity])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* Load the buyer's real saved addresses */
  useEffect(() => {
    let mounted = true
    const loadAddresses = async () => {
      try {
        const res = await fetch('/api/addresses')
        const data = await res.json().catch(() => null)
        if (!mounted) return
        if (res.ok) {
          const list: AddressData[] = Array.isArray(data?.data) ? data.data : []
          setAddresses(list)
          setSelectedAddressId(list.find((a) => a.isDefault)?.id || list[0]?.id || '')
        }
        // 401 while logged out is fine here — order placement will surface it too
      } catch {
        // address fetch failure is non-fatal; user sees "no saved address" state
      } finally {
        if (mounted) setAddressesLoaded(true)
      }
    }
    loadAddresses()
    return () => { mounted = false }
  }, [])

  const unitPrice = product?.basePrice || 0
  const subtotal = useMemo(() => unitPrice * (quantity || 0), [unitPrice, quantity])
  const moq = product?.moq || 1
  const stock = product?.stockQuantity ?? 0
  // Task 95: this shipment's weight — null when the supplier never filed one.
  const shipmentWeightKg =
    product?.weightKg != null && quantity != null ? Math.round(quantity * product.weightKg * 100) / 100 : null
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null
  const quotedOption = useMemo(
    () => quote?.options.find((o) => o.methodId === shippingMethodId) ?? null,
    [quote, shippingMethodId]
  )
  const orderTotal = subtotal + (quotedOption?.price ?? 0)
  const productImage = product
    ? product.images?.[0]?.imageUrl || product.images?.[0]?.url || product.thumbnailUrl || null
    : null

  // Task 95: quote the shipment through the REAL public rail whenever the
  // district, the product or the quantity changes. A pick the fresh quote
  // no longer offers is pruned, never silently kept.
  useEffect(() => {
    if (!selectedAddress || shipmentWeightKg === null) {
      setQuote(null)
      return
    }
    let cancelled = false
    setQuote({ loading: true, options: [], error: '' })
    const run = async () => {
      try {
        const res = await fetch(
          `/api/shipping/quote?district=${encodeURIComponent(selectedAddress.district || '')}&weightKg=${encodeURIComponent(String(shipmentWeightKg))}&subtotal=${encodeURIComponent(String(subtotal))}`,
          { credentials: 'include' }
        )
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.success) {
          setQuote({ loading: false, options: [], error: data?.error || `Could not quote shipping (HTTP ${res.status})` })
          return
        }
        const options: ShippingOption[] = data.data ?? []
        setQuote({ loading: false, options, error: '' })
        setShippingMethodId((prev) => (options.some((o) => o.methodId === prev) ? prev : ''))
      } catch {
        if (!cancelled) setQuote({ loading: false, options: [], error: 'Network error while quoting shipping.' })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedAddress, shipmentWeightKg, subtotal, quoteTick])

  const handleQtyChange = (delta: number) => {
    setQuantity((prev) => {
      const base = prev ?? moq
      // kg lines move in 0.5 kg steps; discrete units in whole-unit steps.
      const step = product?.unit === 'kg' ? 0.5 : 1
      let next = Math.round((base + delta * step) * 100) / 100
      if (next < moq) next = moq
      if (stock > 0 && next > stock) next = stock
      return next
    })
  }

  const handlePlaceOrder = async () => {
    if (!product || !product.supplier?.id) {
      setSubmitError('This product has no supplier assigned and cannot be ordered right now.')
      return
    }
    if (!selectedAddressId) {
      setSubmitError('Please select a delivery address first.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/orders/create-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          unitPrice: unitPrice, // from the server's product record — never a client-invented price
          supplierId: product.supplier.id,
          shippingAddressId: selectedAddressId,
          paymentMethod: 'cod',
          // Task 95: the method id only — never a price. The server re-quotes
          // the shipment against the live rate book.
          ...(shippingMethodId ? { shippingMethodId } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401) {
          setNeedsAuth(true)
          setSubmitError('Your session has expired. Please sign in to place this order.')
        } else if ((res.status === 409 || res.status === 400) && /shipping|method/i.test(data?.error ?? '')) {
          setQuoteTick((t) => t + 1)
          setSubmitError(data?.error || 'Shipping options changed — pick a method again.')
        } else {
          setSubmitError(data?.error || `Order could not be placed (${res.status})`)
        }
        return
      }
      setPlacedOrder(data?.data || null)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Network error while placing the order')
    } finally {
      setSubmitting(false)
    }
  }

  /* ─── No product id — honest state ─── */
  if (!productId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
            <Package className="h-9 w-9 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-slate-100">No product selected</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            Open a product and choose “Buy Now” to place a direct order.
          </p>
          <Button
            onClick={() => navigate('explore')}
            className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-md"
          >
            Explore Products
          </Button>
        </main>
      </div>
    )
  }

  /* ─── Success — real order data from the API ─── */
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-slate-100">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Order Placed</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs leading-relaxed">
          Order <strong className="text-slate-800 dark:text-slate-200">{placedOrder.orderNumber}</strong> was created with{' '}
          {product?.supplier?.companyName || 'the supplier'}.
        </p>
        <div className="mt-4 w-full max-w-xs bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Order total</span>
            <span className="font-black text-slate-900 dark:text-slate-100">{formatPrice(placedOrder.totalAmount)}</span>
          </div>
          {typeof placedOrder.shippingFee === 'number' && placedOrder.shippingFee > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Incl. shipping</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{formatPrice(placedOrder.shippingFee)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Payment status</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">{placedOrder.paymentStatus || 'unpaid'}</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-3 max-w-xs leading-relaxed">
          Cash on delivery — payment is settled with the supplier on receipt. Track progress from your orders.
        </p>
        <div className="mt-6 space-y-2 w-full max-w-xs">
          <Button
            onClick={() => navigate('orders')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-12 rounded-2xl shadow-md"
          >
            Track Order
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('home')}
            className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold text-xs h-11 rounded-2xl"
          >
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  /* ─── Product not found / auth / error — honest states ─── */
  if (notFound || needsAuth || error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Checkout</h1>
          </div>
        </header>
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
            {needsAuth ? <LogIn className="h-9 w-9 text-gray-400 dark:text-gray-500 dark:text-gray-400" /> : <AlertCircle className="h-9 w-9 text-gray-400 dark:text-gray-500 dark:text-gray-400" />}
          </div>
          <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
            {notFound ? 'Product not found' : needsAuth ? 'Sign in required' : 'Couldn\u2019t load this product'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
            {notFound
              ? 'This product doesn\u2019t exist or is no longer available on the marketplace.'
              : needsAuth
                ? 'You need a buyer account to place an order.'
                : error}
          </p>
          <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto">
            {needsAuth ? (
              <Button
                onClick={() => navigate('login')}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 rounded-2xl shadow-md"
              >
                Sign In
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={fetchData}
                className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold text-xs h-11 rounded-2xl flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={goBack}
              className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold text-xs h-10 rounded-2xl"
            >
              Go Back
            </Button>
          </div>
        </main>
      </div>
    )
  }

  /* ─── Loading skeletons ─── */
  if (loading || !product) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-10 text-slate-900 dark:text-slate-100">
        <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-16 w-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 rounded-2xl animate-pulse" />
          </div>
        </main>
      </div>
    )
  }

  const outOfStock = stock === 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-[calc(var(--bottom-nav-h)+150px)] lg:pb-10 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Checkout</h1>
          </div>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          {/* Order Summary Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Order Summary</h2>

            <div className="flex gap-3.5 items-center pt-1">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 w-full h-full">
                    <Package className="h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 leading-snug">
                  {product.name}
                </h3>
                {product.supplier?.companyName && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">Sold by {product.supplier.companyName}</p>
                )}
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xs font-bold text-primary">
                    {formatPrice(unitPrice)} / {product.unit || 'pcs'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">
                    {outOfStock ? 'Out of stock' : stock > 0 ? `${stock.toLocaleString()} in stock` : null}
                  </span>
                </div>
              </div>
            </div>

            {/* Quantity stepper — MOQ enforced from real product data */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800 rounded-2xl p-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase block">Quantity</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">MOQ: {moq}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQtyChange(-1)}
                  disabled={outOfStock || (quantity ?? moq) <= moq}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 dark:text-slate-500 disabled:opacity-40"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-12 text-center text-sm font-black text-slate-900 dark:text-slate-100">
                  {(quantity ?? moq).toLocaleString()}
                </span>
                <button
                  onClick={() => handleQtyChange(1)}
                  disabled={outOfStock || (stock > 0 && (quantity ?? moq) >= stock)}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 dark:text-slate-500 disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Shipping Details Card — real saved addresses only */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Delivery Address</h2>
            </div>

            {!addressesLoaded ? (
              <div className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 animate-pulse" />
            ) : addresses.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">No saved delivery address found.</p>
                <Button
                  variant="outline"
                  onClick={() => navigate('add-address')}
                  className="h-9 px-4 rounded-xl text-xs font-bold bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                >
                  Add an Address
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAddressId(a.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                      selectedAddressId === a.id
                        ? 'border-primary ring-1 ring-primary/20 bg-rose-50/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-4 mt-0.5 shrink-0 ${
                        selectedAddressId === a.id ? 'border-primary bg-white dark:bg-gray-900' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {a.label}
                        {a.isDefault && (
                          <span className="ml-1.5 text-[9px] font-black uppercase text-primary">Default</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed">
                        {a.addressLine1}
                        {a.addressLine2 ? `, ${a.addressLine2}` : ''}, {a.city}
                        {a.postalCode ? ` ${a.postalCode}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Task 95: Shipping method — quoted live for THIS shipment */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Courier</h2>
              </div>
              {selectedAddress?.district && (
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wide">to {selectedAddress.district}</span>
              )}
            </div>

            {shipmentWeightKg === null ? (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
                No weight on file for this product — shipping settles directly with the supplier.
              </p>
            ) : !quote || quote.loading ? (
              <p className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                <RefreshCw className="h-3 w-3 animate-spin" /> Quoting couriers for {shipmentWeightKg} kg…
              </p>
            ) : quote.error ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-red-600" role="alert">{quote.error}</p>
                <button
                  type="button"
                  onClick={() => setQuoteTick((t) => t + 1)}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Retry quote
                </button>
              </div>
            ) : quote.options.length === 0 ? (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
                No courier covers {shipmentWeightKg} kg to {selectedAddress?.district ?? 'this district'} — place the order and settle shipping with the supplier.
              </p>
            ) : (
              <div className="space-y-1.5" role="radiogroup" aria-label="Shipping method">
                {quote.options.map((opt) => {
                  const active = shippingMethodId === opt.methodId
                  return (
                    <label
                      key={opt.methodId}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 cursor-pointer transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="buy-now-ship"
                        className="sr-only"
                        checked={active}
                        onChange={() => setShippingMethodId(opt.methodId)}
                      />
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 items-center justify-center rounded-full border shrink-0 ${
                          active ? 'border-primary' : 'border-slate-300'
                        }`}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{opt.methodName}</span>
                          {opt.freeShipping && (
                            <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">Free</span>
                          )}
                        </span>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                          {opt.estimatedDays ? `Est. ${opt.estimatedDays}` : 'Est. delivery not stated'} · {shipmentWeightKg} kg
                          {opt.freeShipping && opt.basePrice > 0 && <s className="ml-1">{formatPrice(opt.basePrice)}</s>}
                        </span>
                      </span>
                      <span className={`text-xs font-black shrink-0 ${opt.freeShipping ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'}`}>
                        {opt.freeShipping ? 'Free' : formatPrice(opt.price)}
                      </span>
                    </label>
                  )
                })}
                {shippingMethodId && (
                  <button
                    type="button"
                    onClick={() => setShippingMethodId('')}
                    className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 underline"
                  >
                    No shipping method — settle with the supplier
                  </button>
                )}
              </div>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
              Re-quoted server-side from the live rate book when the order is placed.
            </p>
          </div>

          {/* Payment Method Card — only what actually exists */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Payment Method</h2>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Cash on Delivery</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">Pay the supplier when the goods arrive</p>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
              Online payment methods will appear here once a payment gateway is connected.
            </p>
          </div>
        </div>

        {/* Desktop Order Summary */}
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Order Summary</h2>
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
              <div className="flex justify-between">
                <span>
                  {(quantity ?? moq).toLocaleString()} {product.unit || 'pcs'} × {formatPrice(unitPrice)}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(subtotal)}</span>
              </div>
              {quotedOption && (
                <div className="flex justify-between">
                  <span>Shipping · {quotedOption.methodName}</span>
                  <span className={`font-semibold ${quotedOption.freeShipping ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                    {quotedOption.freeShipping ? 'Free' : formatPrice(quotedOption.price)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{quotedOption ? 'Total (goods + shipping)' : 'Order Total'}</span>
              <div className="text-xl font-black text-primary">
                {formatPrice(orderTotal)}
              </div>
            </div>

            <Button
              onClick={handlePlaceOrder}
              disabled={submitting || outOfStock || !selectedAddressId}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md disabled:opacity-50"
            >
              {submitting ? 'Placing Order…' : outOfStock ? 'Out of Stock' : 'Place Order'}
            </Button>

            {submitError && (
              <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-2.5 leading-relaxed">
                {submitError}
              </p>
            )}

            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 dark:text-slate-400">
              Final total is confirmed by the server when the order is created.
            </p>
          </div>
        </aside>
      </main>

      {/* Sticky Bottom Order Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white dark:bg-gray-900 border-t border-slate-100 dark:border-slate-800 p-4 shadow-xl z-30 lg:hidden">
        <div className="max-w-lg mx-auto space-y-2.5">
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
            <div className="flex justify-between">
              <span>
                {(quantity ?? moq).toLocaleString()} {product.unit || 'pcs'} × {formatPrice(unitPrice)}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(subtotal)}</span>
            </div>
            {quotedOption && (
              <div className="flex justify-between">
                <span>Shipping · {quotedOption.methodName}</span>
                <span className={`font-semibold ${quotedOption.freeShipping ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                  {quotedOption.freeShipping ? 'Free' : formatPrice(quotedOption.price)}
                </span>
              </div>
            )}
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{quotedOption ? 'Total (goods + shipping)' : 'Order Total'}</span>
              <span className="text-lg font-black text-primary">{formatPrice(orderTotal)}</span>
            </div>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={submitting || outOfStock || !selectedAddressId}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl text-xs shadow-md disabled:opacity-50"
          >
            {submitting ? 'Placing Order…' : outOfStock ? 'Out of Stock' : 'Place Order'}
          </Button>

          {submitError && (
            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-2.5 leading-relaxed">
              {submitError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default BuyNowPage
