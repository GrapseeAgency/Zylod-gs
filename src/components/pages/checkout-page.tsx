'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useCartStore, type CartItemData } from '@/store/cart-store'
import {
  ArrowLeft, MapPin, CreditCard, Check, CheckCircle2, Package,
  Lock, AlertCircle, Loader2, Plus, Wallet, Truck
} from 'lucide-react'

/**
 * REAL checkout — no fake success, no hardcoded products/addresses/fees.
 * - Cart items come from the real cart store (synced with the backend).
 * - Shipping address comes from the real /api/addresses endpoint.
 * - Order creation goes through POST /api/orders, which re-prices every item
 *   server-side from the database (client totals are display-only).
 * - Task 95: shipping is QUOTED live per supplier shipment through the real
 *   /api/shipping/quote rail (district + shipment weight + goods subtotal);
 *   the buyer picks a method per supplier or honestly ships un-quoted
 *   (settles with the supplier). The server re-quotes at order time — the
 *   client never sends a price.
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

interface QuoteState {
  loading: boolean
  options: ShippingOption[]
  error: string
}

/** One supplier shipment — the unit the quote rail is asked about. */
interface SupplierGroup {
  supplierId: string
  supplierName: string
  items: CartItemData[]
  subtotal: number
  /** null = any line lacks a filed weight — honestly unquotable. */
  weightKg: number | null
}

export function CheckoutPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const { items, clearCart } = useCartStore()

  const [submitting, setSubmitting] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<{ orderNumber: string; paymentStatus: string } | null>(null)
  const [placedCoupon, setPlacedCoupon] = useState<{ code: string; discount: number } | null>(null)
  // Task 100: the platform campaign the server applied (automatic, before the coupon).
  const [placedPromotion, setPlacedPromotion] = useState<{ name: string; discount: number } | null>(null)
  const [placedReceipt, setPlacedReceipt] = useState<{ totalAmount: number; shippingFee: number } | null>(null)
  const [error, setError] = useState<string>('')
  const [needsAuth, setNeedsAuth] = useState(false)

  const [addresses, setAddresses] = useState<AddressData[]>([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressesError, setAddressesError] = useState('')
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')

  // Task 70: WALLET-PAY — the buyer's REAL balance, fetched from the wallet
  // API. A funded wallet can pay the order at checkout (order lands PAID in
  // the same transaction that debits the balance); an unfunded one shows the
  // honest state instead of a dead toggle.
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [payWithWallet, setPayWithWallet] = useState(false)

  // Task 74: coupon application — the API honors couponCode and now refuses
  // invalid ones with the real reason; this input is the half that was
  // missing on the buyer side.
  // Task 131: Apply now validates against the LIVE endpoint
  // (/api/coupons/validate — formula mirrors the order write, fixed +
  // percentage), previews the REAL ৳ and re-validates when the cart changes.
  const [couponInput, setCouponInput] = useState('')
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; discountType: string } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponChecking, setCouponChecking] = useState(false)

  // Task 95: live shipping quotes per supplier shipment + the buyer's picks.
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({})
  const [shippingChoices, setShippingChoices] = useState<Record<string, string>>({})
  const [quoteTick, setQuoteTick] = useState(0)

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null

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

  // Task 70: courtesy fetch — a failing wallet read NEVER blocks checkout
  // (the toggle simply stays hidden and the manual payment leg applies).
  useEffect(() => {
    let cancelled = false
    const loadWallet = async () => {
      try {
        const res = await fetch('/api/wallet/balance', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = await res.json().catch(() => null)
        if (!cancelled && data?.success && typeof data.data?.availableBalance === 'number') {
          setWalletBalance(data.data.availableBalance)
        }
      } catch {
        /* courtesy rail — silent, honest fallback is the manual leg */
      }
    }
    void loadWallet()
    return () => { cancelled = true }
  }, [])

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + (i.totalPrice || i.unitPrice * i.quantity), 0), [items])

  // Task 95: group the cart into supplier shipments and weigh each one
  // (Σ quantity × weightKg; any unweighed line makes the group honestly
  // unquotable — never priced as 0 kg).
  const supplierGroups = useMemo<SupplierGroup[]>(() => {
    const map = new Map<string, SupplierGroup>()
    for (const item of items) {
      const g = map.get(item.supplierId) ?? {
        supplierId: item.supplierId,
        supplierName: item.supplierName || 'Supplier',
        items: [],
        subtotal: 0,
        weightKg: null,
      }
      g.items.push(item)
      g.subtotal += item.totalPrice || item.unitPrice * item.quantity
      map.set(item.supplierId, g)
    }
    const groups = Array.from(map.values())
    for (const g of groups) {
      let w = 0
      let unweighed = false
      for (const it of g.items) {
        if (it.weightKg == null) {
          unweighed = true
          break
        }
        w += it.quantity * it.weightKg
      }
      g.weightKg = unweighed ? null : w
    }
    return groups
  }, [items])

  // Task 95: quote each shipment through the REAL public rail whenever the
  // delivery district or the shipment contents change. Choices that the
  // fresh quote no longer offers are pruned (never silently kept).
  useEffect(() => {
    if (!selectedAddress || supplierGroups.length === 0) return
    let cancelled = false
    const district = selectedAddress.district
    setQuotes(
      Object.fromEntries(
        supplierGroups.map((g) => [g.supplierId, { loading: true, options: [], error: '' }])
      )
    )
    const run = async () => {
      const results: Record<string, QuoteState> = {}
      await Promise.all(
        supplierGroups.map(async (g) => {
          if (g.weightKg === null) {
            results[g.supplierId] = { loading: false, options: [], error: '' }
            return
          }
          try {
            const res = await fetch(
              `/api/shipping/quote?district=${encodeURIComponent(district)}&weightKg=${encodeURIComponent(String(g.weightKg))}&subtotal=${encodeURIComponent(String(g.subtotal))}`,
              { credentials: 'include' }
            )
            const data = await res.json().catch(() => null)
            if (cancelled) return
            if (!res.ok || !data?.success) {
              results[g.supplierId] = {
                loading: false,
                options: [],
                error: data?.error || `Could not quote shipping (HTTP ${res.status})`,
              }
              return
            }
            results[g.supplierId] = { loading: false, options: data.data ?? [], error: '' }
          } catch {
            if (!cancelled) {
              results[g.supplierId] = { loading: false, options: [], error: 'Network error while quoting shipping.' }
            }
          }
        })
      )
      if (cancelled) return
      setQuotes(results)
      // Prune choices the fresh book no longer offers.
      setShippingChoices((prev) => {
        const next: Record<string, string> = {}
        for (const [sid, mid] of Object.entries(prev)) {
          if (results[sid]?.options.some((o) => o.methodId === mid)) next[sid] = mid
        }
        return next
      })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedAddress, supplierGroups, quoteTick])

  // Task 95: the display-only shipping fee (the server re-quotes at order time).
  const shippingFee = useMemo(
    () =>
      supplierGroups.reduce((sum, g) => {
        const methodId = shippingChoices[g.supplierId]
        if (!methodId) return sum
        const opt = quotes[g.supplierId]?.options.find((o) => o.methodId === methodId)
        return sum + (opt ? opt.price : 0)
      }, 0),
    [supplierGroups, quotes, shippingChoices]
  )
  const hasShippingChoice = supplierGroups.some((g) => !!shippingChoices[g.supplierId])
  const orderTotal = subtotal + shippingFee
  // Task 131: the ONE payable number every money label on this page quotes —
  // goods + shipping − the validated coupon discount (server re-confirms at
  // the write; Task 74 remains the source of truth).
  const payableTotal = Math.max(0, orderTotal - (couponApplied?.discount ?? 0))

  const walletCanCover = walletBalance !== null && walletBalance >= payableTotal

  // Tracks the goods subtotal the current coupon was validated against.
  const couponSubtotalRef = useRef(subtotal)

  const applyCoupon = async (codeArg?: string) => {
    const code = (codeArg ?? couponInput).trim().toUpperCase()
    if (!code) {
      setCouponError('Enter a coupon code first.')
      return
    }
    // Task 131: LIVE validation — the route mirrors the order write's rules
    // (existence, window, minimum, usage limit) AND its exact discount
    // formula. The preview is honest; the server still re-confirms at the
    // write (Task 74) — the receipt stays the source of truth.
    setCouponChecking(true)
    setCouponError('')
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, orderAmount: subtotal }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.valid) {
        setCouponApplied(null)
        setCouponError(data?.error || `Coupon could not be validated (HTTP ${res.status}).`)
        return
      }
      setCouponApplied({
        code: data.data.code,
        discount: typeof data.data.discountAmount === 'number' ? data.data.discountAmount : 0,
        discountType: data.data.discountType || 'percentage',
      })
      couponSubtotalRef.current = subtotal
    } catch {
      setCouponError('Network error while validating the coupon. Check your connection and retry.')
    } finally {
      setCouponChecking(false)
    }
  }

  // Task 131: the cart is alive — qty changes, shipping choices, promotions —
  // so a validated coupon is re-checked whenever the goods subtotal moves.
  // A stale preview would be a fake number; a now-invalid coupon clears
  // itself with the endpoint's real reason.
  useEffect(() => {
    if (!couponApplied) return
    if (couponSubtotalRef.current === subtotal) return
    couponSubtotalRef.current = subtotal
    void applyCoupon(couponApplied.code)
  }, [subtotal, couponApplied?.code])

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
          payWithWallet: payWithWallet && walletCanCover ? true : undefined,
          couponCode: couponApplied?.code,
          // Task 95: (supplierId, methodId) pairs only — never a price. The
          // server re-quotes every shipment against the live rate book.
          ...(hasShippingChoice
            ? {
                shippingChoices: Object.entries(shippingChoices).map(([supplierId, methodId]) => ({
                  supplierId,
                  methodId,
                })),
              }
            : {}),
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
      if (res.status === 402) {
        // The server re-checked the REAL balance at write time — trust it.
        setPayWithWallet(false)
        setError(data?.error || 'Insufficient wallet balance.')
        return
      }
      if (res.status === 409 && /coupon/i.test(data?.error ?? '')) {
        // The coupon could not be honored — the error names the real reason.
        setCouponApplied(null)
        setCouponError(data?.error || 'Coupon could not be applied.')
        return
      }
      if (res.status === 409 && /promotion/i.test(data?.error ?? '')) {
        // Task 100: the campaign hit its usage limit between pricing and the
        // write — the order was refused, never repriced behind the buyer's
        // back. Re-placing prices without the promotion.
        setError(data?.error || 'A promotion just reached its limit — place the order again to price it without it.')
        return
      }
      if ((res.status === 409 || res.status === 400) && /shipping|method/i.test(data?.error ?? '')) {
        // Task 95: the quoted book changed under the buyer (rate edited,
        // method deactivated…). Re-quote live and surface the real reason.
        setQuoteTick((t) => t + 1)
        setError(data?.error || 'Shipping options changed — pick a method again.')
        return
      }
      if (!res.ok || !data?.success) {
        // Surface the REAL backend error (stock, MOQ, address, product availability…)
        setError(data?.error || `Order failed (HTTP ${res.status}). Please try again.`)
        return
      }

      // Real order created server-side — wallet-paid orders land PAID.
      clearCart()
      setPlacedOrder({
        orderNumber: data.data.orderNumber,
        paymentStatus: data.data.paymentStatus,
      })
      setPlacedCoupon(data.data.couponApplied ?? null)
      setPlacedPromotion(data.data.promotionApplied ?? null)
      setPlacedReceipt({
        totalAmount: typeof data.data.totalAmount === 'number' ? data.data.totalAmount : 0,
        shippingFee: typeof data.data.shippingFee === 'number' ? data.data.shippingFee : 0,
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
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6 md:p-10 text-center text-slate-900 dark:text-slate-100">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10 md:h-12 w-12" />
        </div>
        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">Order {placedOrder.orderNumber} Created</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
          {placedPromotion && (
            <span className="block text-emerald-600 font-bold mb-1">
              Promotion “{placedPromotion.name}” saved you {formatPrice(placedPromotion.discount)}.
            </span>
          )}
          {placedCoupon && (
            <span className="block text-emerald-600 font-bold mb-1">
              Coupon {placedCoupon.code} saved you {formatPrice(placedCoupon.discount)}.
            </span>
          )}
          {placedReceipt && placedReceipt.shippingFee > 0 && (
            <span className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
              Goods {formatPrice(placedReceipt.totalAmount - placedReceipt.shippingFee)} + Shipping {formatPrice(placedReceipt.shippingFee)} = {formatPrice(placedReceipt.totalAmount)}
            </span>
          )}
          {placedOrder.paymentStatus === 'paid' ? (
            <>
              Status: <span className="font-bold text-emerald-600 uppercase">PAID</span> — settled from your wallet
              balance. The supplier can confirm and start packing right away.
            </>
          ) : (
            <>
              Status: <span className="font-bold text-amber-600 uppercase">{placedOrder.paymentStatus}</span>.
              The order is NOT confirmed until payment is verified. The supplier sees it now.
            </>
          )}
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
            className="w-full bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-bold text-xs h-11 rounded-2xl"
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
          <div className="flex items-center justify-between">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
            <div className="w-5" />
          </div>
        </header>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">Your cart is empty</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 md:pb-10 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <div className="w-5" />
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 max-w-lg mx-auto lg:max-w-5xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
        {/* Page Title */}
        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
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
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Shipping Address</h2>
            </div>
            <button
              onClick={() => navigate('shipping-address')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 pt-1 pl-6">
            {addressesLoading ? (
              <p className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading your addresses…
              </p>
            ) : selectedAddress ? (
              <>
                <p className="font-bold text-slate-900 dark:text-slate-100">
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
                <p className="text-slate-500 dark:text-slate-400">{addressesError || 'No shipping address on file.'}</p>
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
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h2 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100">Items</h2>
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.productImage ? (
                    <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{item.productName}</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Qty: {item.quantity} · {item.supplierName}
                    {item.variantName ? ` · ${item.variantName}: ${item.variantValue}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 shrink-0">
                {formatPrice(item.totalPrice || item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Card 2.5: Shipping — quoted live per supplier shipment (Task 95) */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Shipping</h2>
            </div>
            {selectedAddress && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">to {selectedAddress.district}</span>
            )}
          </div>

          {supplierGroups.map((g) => {
            const q = quotes[g.supplierId]
            const picked = shippingChoices[g.supplierId]
            return (
              <div key={g.supplierId} className="border-t border-slate-100 dark:border-slate-800 first:border-t-0 first:pt-0 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{g.supplierName}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                    {g.weightKg === null ? 'no weight on file' : `${g.weightKg} kg · ships separately`}
                  </p>
                </div>

                {g.weightKg === null ? (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    A product in this shipment has no weight on file — shipping settles directly with the supplier.
                  </p>
                ) : !q || q.loading ? (
                  <p className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Quoting couriers for {selectedAddress?.district ?? 'your district'}…
                  </p>
                ) : q.error ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-red-600" role="alert">{q.error}</p>
                    <button
                      type="button"
                      onClick={() => setQuoteTick((t) => t + 1)}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Retry quote
                    </button>
                  </div>
                ) : q.options.length === 0 ? (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    No courier covers {g.weightKg} kg to {selectedAddress?.district ?? 'this district'} — place the order and settle shipping with the supplier.
                  </p>
                ) : (
                  <div className="space-y-1.5" role="radiogroup" aria-label={`Shipping method for ${g.supplierName}`}>
                    {q.options.map((opt) => {
                      const active = picked === opt.methodId
                      return (
                        <label
                          key={opt.methodId}
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 cursor-pointer transition-colors ${
                            active ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`ship-${g.supplierId}`}
                            className="sr-only"
                            checked={active}
                            onChange={() => setShippingChoices((prev) => ({ ...prev, [g.supplierId]: opt.methodId }))}
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
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                              {opt.estimatedDays ? `Est. ${opt.estimatedDays}` : 'Est. delivery not stated'}
                              {opt.freeShipping && opt.basePrice > 0 && (
                                <s className="ml-1">{formatPrice(opt.basePrice)}</s>
                              )}
                            </span>
                          </span>
                          <span className={`text-xs font-black shrink-0 ${opt.freeShipping ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'}`}>
                            {opt.freeShipping ? 'Free' : formatPrice(opt.price)}
                          </span>
                        </label>
                      )
                    })}
                    {picked && (
                      <button
                        type="button"
                        onClick={() =>
                          setShippingChoices((prev) => {
                            const next = { ...prev }
                            delete next[g.supplierId]
                            return next
                          })
                        }
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 underline"
                      >
                        No shipping method — settle with the supplier
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            Quotes are re-computed server-side from the live rate book when the order is placed — what you see is
            what the couriers charge today, not a stored estimate.
          </p>
        </div>

        {/* Card 3: Payment (honest state — wallet or the verified manual leg) */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">Payment</h2>
          </div>

          {/* Task 70: pay from the REAL wallet balance */}
          {walletBalance !== null && (
            <button
              type="button"
              role="checkbox"
              aria-checked={payWithWallet && walletCanCover}
              disabled={!walletCanCover}
              onClick={() => walletCanCover && setPayWithWallet((v) => !v)}
              className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                payWithWallet && walletCanCover
                  ? 'border-primary bg-primary/5'
                  : walletCanCover
                    ? 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-70 cursor-not-allowed'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                  payWithWallet && walletCanCover ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white dark:bg-gray-900'
                }`}
                aria-hidden
              >
                {payWithWallet && walletCanCover && <Check className="h-3.5 w-3.5" />}
              </span>
              <Wallet className={`h-4 w-4 shrink-0 ${payWithWallet && walletCanCover ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`} />
              <span className="text-xs">
                {walletCanCover ? (
                  <>
                    {/* Task 131: the wallet label quotes the SAME payable the summary
                        shows (orderTotal − validated coupon discount) — never a
                        different number on one screen. */}
                    <span className="font-bold text-slate-900 dark:text-slate-100">Pay {formatPrice(payableTotal)} from wallet balance</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                      Balance {formatPrice(walletBalance)} — the order is marked PAID instantly, no verification wait.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-slate-500 dark:text-slate-400">Wallet balance {formatPrice(walletBalance)}</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Not enough for this order ({formatPrice(payableTotal)}) — top up from the wallet page, or pay manually below.
                    </span>
                  </>
                )}
              </span>
            </button>
          )}

          <div className="flex items-start gap-2 pt-1 pl-6 text-xs text-slate-600 dark:text-slate-400">
            <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
            <p>
              {payWithWallet && walletCanCover ? (
                <>
                  The total is re-verified server-side from live catalog prices and debited from your wallet in the
                  same transaction that reserves the stock.
                </>
              ) : (
                <>
                  The order is created with status <span className="font-bold">UNPAID</span>. Payment must be
                  completed and verified before the supplier confirms — the total is re-verified server-side
                  from live catalog prices, so amounts shown here are final only after the server confirms.
                </>
              )}
            </p>
          </div>
        </div>

        </div>

        {/* Card 4: Order Summary (sticky sidebar on desktop) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <h2 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100">Order Summary</h2>

          <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex justify-between">
              <span>Items ({items.length})</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(subtotal)}</span>
            </div>
            {/* Task 95: the honest shipping line — real quoted fee, or the
                truthful "settles with the supplier" when nothing is picked. */}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className={`font-semibold ${hasShippingChoice && shippingFee === 0 ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                {hasShippingChoice ? (shippingFee === 0 ? 'Free' : formatPrice(shippingFee)) : 'Settled with supplier'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{hasShippingChoice ? 'Total (goods + shipping)' : 'Goods total'}</span>
              <div className="text-xl md:text-2xl font-black text-primary">
                {formatPrice(payableTotal)}
              </div>
            </div>
            {couponApplied && couponApplied.discount > 0 && (
              <div className="flex justify-between text-[10px] font-bold text-emerald-600">
                <span>Coupon {couponApplied.code}</span>
                <span>− {formatPrice(couponApplied.discount)}</span>
              </div>
            )}
          </div>

          {/* Task 74: coupon attach — validated and discounted server-side. */}
          <div className="pt-2 space-y-1.5">
            {/* Task 100: platform promotions are automatic — stated, never precomputed. */}
            <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 leading-relaxed">
              Platform promotions on your items apply automatically — before any coupon code. The receipt shows the exact ৳ each discount saved you.
            </p>
            {couponApplied ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-emerald-700 truncate">
                  Coupon {couponApplied.code}
                  <span className="block text-[10px] font-medium text-emerald-600 normal-case">
                    {couponApplied.discount > 0
                      ? `Validated — ${formatPrice(couponApplied.discount)} off this cart. The server re-confirms the exact ৳ on the receipt.`
                      : 'Validated — the server confirms the exact ৳ on the receipt.'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => { setCouponApplied(null); setCouponInput(''); setCouponError('') }}
                  className="text-emerald-600 hover:text-emerald-800 text-xs font-black px-1"
                  aria-label="Remove coupon"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value); setCouponError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void applyCoupon() } }}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  maxLength={24}
                  className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-xs uppercase tracking-wide placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void applyCoupon()}
                  disabled={couponChecking}
                  className="h-9 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {couponChecking ? 'Checking…' : 'Apply'}
                </Button>
              </div>
            )}
            {couponError && (
              <p className="text-[10px] font-bold text-red-600 leading-relaxed" role="alert">{couponError}</p>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
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
