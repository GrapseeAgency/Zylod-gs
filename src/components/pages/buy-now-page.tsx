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
  paymentStatus: string
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
      const paramQty = parseInt(pageParams.quantity || '', 10)
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
  const productImage = product
    ? product.images?.[0]?.imageUrl || product.images?.[0]?.url || product.thumbnailUrl || null
    : null

  const handleQtyChange = (delta: number) => {
    setQuantity((prev) => {
      const base = prev ?? moq
      let next = base + delta
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
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401) {
          setNeedsAuth(true)
          setSubmitError('Your session has expired. Please sign in to place this order.')
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
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            <Package className="h-9 w-9 text-gray-400" />
          </div>
          <h1 className="text-base font-black text-slate-900">No product selected</h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-slate-900">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Order Placed</h1>
        <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
          Order <strong className="text-slate-800">{placedOrder.orderNumber}</strong> was created with{' '}
          {product?.supplier?.companyName || 'the supplier'}.
        </p>
        <div className="mt-4 w-full max-w-xs bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Order total</span>
            <span className="font-black text-slate-900">{formatPrice(placedOrder.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment status</span>
            <span className="font-bold text-slate-900 capitalize">{placedOrder.paymentStatus || 'unpaid'}</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 max-w-xs leading-relaxed">
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
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl"
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
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Checkout</h1>
          </div>
        </header>
        <main className="px-4 py-16 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4">
            {needsAuth ? <LogIn className="h-9 w-9 text-gray-400" /> : <AlertCircle className="h-9 w-9 text-gray-400" />}
          </div>
          <h1 className="text-base font-black text-slate-900">
            {notFound ? 'Product not found' : needsAuth ? 'Sign in required' : 'Couldn\u2019t load this product'}
          </h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
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
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-11 rounded-2xl flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={goBack}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs h-10 rounded-2xl"
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
      <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
        <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-16 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          </div>
        </main>
      </div>
    )
  }

  const outOfStock = stock === 0

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(var(--bottom-nav-h)+150px)] lg:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900">Checkout</h1>
          </div>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          {/* Order Summary Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-slate-900">Order Summary</h2>

            <div className="flex gap-3.5 items-center pt-1">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200">
                {productImage ? (
                  <img src={productImage} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 w-full h-full">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                  {product.name}
                </h3>
                {product.supplier?.companyName && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Sold by {product.supplier.companyName}</p>
                )}
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xs font-bold text-primary">
                    {formatPrice(unitPrice)} / {product.unit || 'pcs'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {outOfStock ? 'Out of stock' : stock > 0 ? `${stock.toLocaleString()} in stock` : null}
                  </span>
                </div>
              </div>
            </div>

            {/* Quantity stepper — MOQ enforced from real product data */}
            <div className="flex items-center justify-between bg-slate-50/70 border border-slate-100 rounded-2xl p-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Quantity</span>
                <span className="text-[10px] text-slate-400">MOQ: {moq}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQtyChange(-1)}
                  disabled={outOfStock || (quantity ?? moq) <= moq}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-12 text-center text-sm font-black text-slate-900">
                  {(quantity ?? moq).toLocaleString()}
                </span>
                <button
                  onClick={() => handleQtyChange(1)}
                  disabled={outOfStock || (stock > 0 && (quantity ?? moq) >= stock)}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Shipping Details Card — real saved addresses only */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Delivery Address</h2>
            </div>

            {!addressesLoaded ? (
              <div className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ) : addresses.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                <p className="text-xs text-slate-500">No saved delivery address found.</p>
                <Button
                  variant="outline"
                  onClick={() => navigate('add-address')}
                  className="h-9 px-4 rounded-xl text-xs font-bold bg-white text-slate-700 border-slate-200"
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
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-4 mt-0.5 shrink-0 ${
                        selectedAddressId === a.id ? 'border-primary bg-white' : 'border-slate-200 bg-white'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">
                        {a.label}
                        {a.isDefault && (
                          <span className="ml-1.5 text-[9px] font-black uppercase text-primary">Default</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
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

          {/* Payment Method Card — only what actually exists */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900">Payment Method</h2>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Cash on Delivery</p>
                <p className="text-[10px] text-slate-400">Pay the supplier when the goods arrive</p>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Online payment methods will appear here once a payment gateway is connected.
            </p>
          </div>
        </div>

        {/* Desktop Order Summary */}
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2.5">
            <h2 className="text-xs font-bold text-slate-900">Order Summary</h2>
            <div className="space-y-1 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>
                  {(quantity ?? moq).toLocaleString()} {product.unit || 'pcs'} × {formatPrice(unitPrice)}
                </span>
                <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800">Order Total</span>
              <div className="text-xl font-black text-primary">
                {formatPrice(subtotal)}
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

            <p className="text-[10px] text-center text-slate-400">
              Final total is confirmed by the server when the order is created.
            </p>
          </div>
        </aside>
      </main>

      {/* Sticky Bottom Order Bar */}
      <div className="fixed bottom-[var(--bottom-nav-h)] left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-xl z-30 lg:hidden">
        <div className="max-w-lg mx-auto space-y-2.5">
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>
                {(quantity ?? moq).toLocaleString()} {product.unit || 'pcs'} × {formatPrice(unitPrice)}
              </span>
              <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="pt-1 border-t border-slate-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800">Order Total</span>
              <span className="text-lg font-black text-primary">{formatPrice(subtotal)}</span>
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
