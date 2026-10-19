'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'
import {
  ArrowLeft, HelpCircle, Check, Package, Truck, Home,
  Download, AlertTriangle, MapPin, CreditCard, FileText, RefreshCw, XCircle,
  Wallet, Hourglass
} from 'lucide-react'

// ── Real API types (GET /api/orders/[id]) ──────────────────────────────
interface ApiProduct { id: string; name: string; thumbnailUrl: string | null; unit: string | null; slug: string }
interface ApiVariant { id: string; variantName: string; variantValue: string }
interface ApiItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: ApiProduct
  variant: ApiVariant | null
}
interface ApiTracking { id: string; status: string; location: string | null; note: string | null; lat: number | null; lng: number | null; trackedAt: string }
interface ApiSubOrder {
  id: string
  supplierId: string
  supplier: { companyName: string; slug: string; ratingAvg: number; ratingCount: number } | null
  subtotal: number
  shippingCost: number
  status: string
  trackingNumber: string | null
  estimatedDelivery: string | null
  createdAt: string
  updatedAt: string
  items: ApiItem[]
  tracking: ApiTracking[]
}
interface ApiPayment { id: string; method: string; amount: number; status: string; transactionId: string | null; paidAt: string | null }
interface ApiOrderDetail {
  id: string
  orderNumber: string
  buyerId: string
  totalAmount: number
  paymentStatus: string
  placedAt: string
  updatedAt: string
  shippingAddress: {
    id: string; label: string | null; addressLine1: string; addressLine2: string | null
    city: string; district: string | null; postalCode: string | null
  } | null
  payments: ApiPayment[]
  subOrders: ApiSubOrder[]
}

// ── Manual payment submission (Task 56-b) ────────────────────────────
// Method dropdown entries map to the REAL payments.method enum
// (prisma/schema.prisma: cod | bank_transfer | card | mobile_banking | wallet).
// bKash/Nagad/Rocket are mobile_banking + a brand — the brand rides in the
// submit payload exactly as POST /api/orders/[id]/payment-submit stores it.
const PAYMENT_METHOD_OPTIONS: { value: string; brand?: string; label: string }[] = [
  { value: 'mobile_banking', brand: 'bKash', label: 'bKash (mobile banking)' },
  { value: 'mobile_banking', brand: 'Nagad', label: 'Nagad (mobile banking)' },
  { value: 'mobile_banking', brand: 'Rocket', label: 'Rocket (mobile banking)' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'card', label: 'Card' },
]

const TRXID_PATTERN = /^[A-Za-z0-9\-_]{6,64}$/
const SENDER_PATTERN = /^\+?[0-9]{6,20}$/

/** Derive the display status purely from real sub-order statuses (mirror of backend logic). */
function deriveStatus(subOrders: ApiSubOrder[]): 'processing' | 'shipped' | 'delivered' | 'cancelled' {
  const statuses = subOrders.map((s) => (s.status || 'pending').toLowerCase())
  if (statuses.length === 0) return 'processing'
  if (statuses.every((s) => s === 'delivered')) return 'delivered'
  if (statuses.some((s) => s === 'cancelled')) return 'cancelled'
  if (statuses.some((s) => s === 'shipped')) return 'shipped'
  return 'processing'
}

function PlaceholderImage() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <Package className="h-5 w-5 text-gray-400" />
    </div>
  )
}

export function OrderDetailPage({ pageParams: _pageParams }: { pageParams?: Record<string, string> }) {
  const { navigate, goBack, pageParams: storeParams } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const user = useAuthStore((s) => s.user)
  const pageParams = _pageParams || storeParams || {}
  const orderId = pageParams.orderId || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [order, setOrder] = useState<ApiOrderDetail | null>(null)

  // ── Submit-payment dialog state (Task 56-b) ──────────────────────────
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payMethodIdx, setPayMethodIdx] = useState(0)
  const [payTrxId, setPayTrxId] = useState('')
  const [paySender, setPaySender] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [payError, setPayError] = useState('')

  // ── Cancel-order state (Task 57-a/58) ────────────────────────────────
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  // Task 58: when set, the confirm dialog targets ONE shipment only.
  const [scopedShipment, setScopedShipment] = useState<{ id: string; label: string } | null>(null)

  const loadOrder = useCallback(async () => {
    if (!orderId) { setLoading(false); return }
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    setNotFound(false)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { credentials: 'include' })
      if (res.status === 401) { setNeedsAuth(true); setOrder(null); return }
      if (res.status === 404) { setNotFound(true); setOrder(null); return }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load order (HTTP ${res.status})`)
        setOrder(null)
        return
      }
      setOrder(json.data as ApiOrderDetail)
    } catch {
      setError('Network error while loading this order. Check your connection and retry.')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { loadOrder() }, [loadOrder])

  const openPayDialog = () => {
    setPayMethodIdx(0)
    setPayTrxId('')
    setPaySender('')
    setPayNote('')
    setPayError('')
    setPayDialogOpen(true)
  }

  const submitPayment = async () => {
    if (!order) return
    const trimmedTrx = payTrxId.trim()
    if (!TRXID_PATTERN.test(trimmedTrx)) {
      setPayError('Transaction ID must be 6-64 characters (letters, numbers, dash or underscore).')
      return
    }
    const trimmedSender = paySender.trim()
    if (trimmedSender && !SENDER_PATTERN.test(trimmedSender)) {
      setPayError('Sender number must be 6-20 digits, optionally starting with +.')
      return
    }
    const method = PAYMENT_METHOD_OPTIONS[payMethodIdx]
    setPaySubmitting(true)
    setPayError('')
    try {
      const body: Record<string, unknown> = {
        method: method.value,
        transactionId: trimmedTrx,
      }
      if (method.brand) body.brand = method.brand
      if (trimmedSender) body.senderNumber = trimmedSender
      if (payNote.trim()) body.note = payNote.trim()
      // On a PARTIAL order the buyer pays the remaining due, not the full total.
      if (order.paymentStatus === 'partial') body.amount = remainingDue
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/payment-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setPayError(json?.error || `Submission failed (HTTP ${res.status})`)
        return
      }
      toast.success('Payment submitted for verification', {
        description: `Reference ${trimmedTrx} — the seller will verify it shortly.`,
      })
      setPayDialogOpen(false)
      loadOrder()
    } catch {
      setPayError('Network error while submitting your payment. Check your connection and retry.')
    } finally {
      setPaySubmitting(false)
    }
  }

  // ── Task 57-a: buyer self-service cancellation (whole order) ────────
  const cancelOrder = () => {
    setScopedShipment(null)
    setCancelDialogOpen(true)
  }

  // ── Task 58: cancel ONE shipment on a multi-supplier order ─────────
  const cancelShipment = (subOrderId: string, label: string) => {
    setScopedShipment({ id: subOrderId, label })
    setCancelDialogOpen(true)
  }

  const confirmCancel = async () => {
    if (!order) return
    setCancelling(true)
    try {
      const body = scopedShipment ? { subOrderIds: [scopedShipment.id] } : undefined
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error || `Cancellation failed (HTTP ${res.status})`)
        setCancelDialogOpen(false)
        setScopedShipment(null)
        return
      }
      const d = json?.data ?? {}
      const remaining = typeof d.remainingActive === 'number' ? d.remainingActive : null
      toast.success(scopedShipment ? 'Shipment cancelled' : 'Order cancelled', {
        description:
          `${d.subOrdersCancelled ?? 0} shipment(s) cancelled · stock restored` +
          (typeof d.totalAmount === 'number' && typeof d.totalBefore === 'number' && d.totalAmount !== d.totalBefore
            ? ` · order total now ${formatPrice(d.totalAmount)}`
            : '') +
          (d.paymentsVoided ? ` · ${d.paymentsVoided} pending payment reference voided` : '') +
          (remaining !== null && remaining > 0 ? ` · ${remaining} shipment(s) remain active` : ''),
      })
      setCancelDialogOpen(false)
      setScopedShipment(null)
      loadOrder()
    } catch {
      toast.error('Network error while cancelling. Check your connection and retry.')
    } finally {
      setCancelling(false)
    }
  }

  // ── Honest empty / guard states ───────────────────────────────────────
  if (!loading && !orderId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">No order selected</h1>
          <p className="text-xs text-slate-500">Pick an order from your order history to see its details.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-base font-black">Sign in required</h1>
          <p className="text-xs text-slate-500">You need to be signed in to view this order.</p>
          <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
        </div>
      </div>
    )
  }

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <XCircle className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="text-base font-black">Order not found</h1>
          <p className="text-xs text-slate-500">This order does not exist or is not visible to your account.</p>
          <Button onClick={() => navigate('my-orders')} className="h-10 px-5 rounded-xl text-xs font-bold">View My Orders</Button>
        </div>
      </div>
    )
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-xs space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-base font-black">Could not load order</h1>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={loadOrder} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  // ── Loading skeleton (never fake rows) ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 md:hidden">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </header>
        <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6 md:max-w-2xl lg:max-w-6xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-5 lg:col-span-2">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 lg:col-span-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            {[0, 1].map((i) => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3 lg:col-start-3 lg:row-start-1 lg:row-span-2">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            {[0, 1, 2].map((i) => <div key={i} className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
          </div>
        </main>
      </div>
    )
  }

  // order is non-null here (all other paths returned above)
  if (!order) return null

  // ── Real derived values ───────────────────────────────────────────────
  const isBuyerOwner = !!user && user.id === order.buyerId
  // Honest remaining due: total minus what verification has actually accepted.
  const verifiedPaid = order.payments
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + (typeof p.amount === 'number' ? p.amount : 0), 0)
  const remainingDue = Math.max(0, order.totalAmount - verifiedPaid)
  const canSubmitPayment =
    isBuyerOwner && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'partial')
  // Task 57-a: mirror of the API guards — money not verified yet AND nothing
  // has moved past confirmed. A cancelled order shows no cancel button.
  const canCancelOrder =
    canSubmitPayment &&
    order.subOrders.length > 0 &&
    order.subOrders.every((so) => ['pending', 'confirmed'].includes((so.status || 'pending').toLowerCase()))
  const hasPendingVerification = order.payments.some((p) => p.status === 'pending')
  const status = deriveStatus(order.subOrders)
  const subtotal = order.subOrders.reduce((sum, so) => sum + (typeof so.subtotal === 'number' ? so.subtotal : 0), 0)
  const shipping = order.subOrders.reduce((sum, so) => sum + (typeof so.shippingCost === 'number' ? so.shippingCost : 0), 0)
  const allItems = order.subOrders.flatMap((so) => so.items || [])
  const estDelivery = order.subOrders
    .map((so) => so.estimatedDelivery)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort()[0] || null
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
  const paymentStatusLabel = (order.paymentStatus || 'unpaid').toUpperCase()

  // Stepper progress from real statuses only
  const statuses = order.subOrders.map((s) => (s.status || 'pending').toLowerCase())
  const stepPacked = statuses.some((s) => ['processing', 'packed', 'shipped', 'delivered'].includes(s))
  const stepShipped = statuses.some((s) => ['shipped', 'delivered'].includes(s))
  const stepDelivered = statuses.length > 0 && statuses.every((s) => s === 'delivered')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1 text-slate-700 dark:text-slate-300 hover:text-slate-900" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-bold truncate max-w-[180px]">Order #{order.orderNumber || '--'}</h1>
          </div>
          <button onClick={() => navigate('help-center')} className="p-1 text-slate-400 hover:text-slate-700" title="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto md:px-6 md:py-6 md:max-w-2xl lg:max-w-6xl lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        {/* Status Card & 4-Step Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-black">
                Order #{order.orderNumber || '--'}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Placed {new Date(order.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <Button
              onClick={() => navigate('track-order', { orderId })}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shadow-xs shrink-0"
            >
              Track Order
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              {statusLabel}
            </span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
              order.paymentStatus === 'paid'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}>
              {paymentStatusLabel}
            </span>
            {hasPendingVerification && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                <Hourglass className="h-3 w-3" /> Payment verification pending
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500">
            {estDelivery
              ? <>Estimated Delivery: <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(estDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></>
              : 'Estimated delivery: to be scheduled by the supplier'}
          </p>

          {/* 4-Step Stepper */}
          <div className="flex items-center justify-between px-2 pt-2">
            {/* Step 1: Placed */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black shadow-xs">
                <Check className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold text-primary mt-1">Placed</span>
            </div>

            <div className="flex-1 h-0.5 bg-primary mx-1" />

            {/* Step 2: Packed */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-xs ${stepPacked ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Package className="h-4 w-4" />
              </div>
              <span className={`text-[10px] font-bold mt-1 ${stepPacked ? 'text-primary' : 'text-slate-400'}`}>Packed</span>
            </div>

            <div className={`flex-1 h-0.5 mx-1 ${stepPacked ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />

            {/* Step 3: Shipped */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-xs ${stepShipped ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Truck className="h-4 w-4" />
              </div>
              <span className={`text-[10px] font-bold mt-1 ${stepShipped ? 'text-primary' : 'text-slate-400'}`}>Shipped</span>
            </div>

            <div className={`flex-1 h-0.5 mx-1 ${stepShipped ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />

            {/* Step 4: Delivered */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${stepDelivered ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <Home className="h-4 w-4" />
              </div>
              <span className={`text-[10px] font-bold mt-1 ${stepDelivered ? 'text-primary' : 'text-slate-400'}`}>Delivered</span>
            </div>
          </div>
        </div>

        {/* Items in Order Card — grouped by shipment (Task 58) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 lg:col-span-2">
          <h2 className="text-xs md:text-sm font-bold">
            Items in Order ({allItems.length})
          </h2>

          {allItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No items recorded on this order.</p>
          ) : (
            <div className="space-y-4 pt-1">
              {order.subOrders.map((so) => {
                const soStatus = (so.status || 'pending').toLowerCase()
                const soCancellable =
                  canCancelOrder &&
                  ['pending', 'confirmed'].includes(soStatus)
                return (
                  <div key={so.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3 space-y-3">
                    {/* Shipment header: supplier + real status + per-shipment cancel */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Shipment · {so.supplier?.companyName || 'Supplier'}
                        </p>
                        <p className="text-[10px] text-slate-400 capitalize">{soStatus}</p>
                      </div>
                      {soCancellable && order.subOrders.length > 1 && (
                        <button
                          onClick={() => cancelShipment(so.id, so.supplier?.companyName || 'Supplier')}
                          disabled={cancelling}
                          className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-900 rounded-lg px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
                        >
                          Cancel this shipment
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(so.items || []).map((item) => (
                        <div key={item.id} className="flex gap-3 items-center py-2">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                            {item.product?.thumbnailUrl ? (
                              <img src={item.product.thumbnailUrl} alt={item.product?.name || 'Product'} className="w-full h-full object-cover" />
                            ) : (
                              <PlaceholderImage />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold line-clamp-1 leading-snug">
                              {item.product?.name || '--'}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {item.variant ? `${item.variant.variantName}: ${item.variant.variantValue} · ` : ''}
                              {item.product?.unit ? `Sold per ${item.product.unit}` : ''}
                            </p>
                            <div className="flex items-baseline justify-between mt-1.5">
                              <span className="text-xs font-black text-primary">
                                {formatPrice(item.totalPrice)}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({formatPrice(item.unitPrice)}/unit)
                                </span>
                              </span>
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                Qty: {item.quantity}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payment Summary Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 lg:col-start-3 lg:row-start-1 lg:row-span-2">
          <h2 className="text-xs md:text-sm font-bold">Payment Summary</h2>

          <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrice(shipping)}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total</span>
              <span className="text-xl md:text-2xl font-black text-primary">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Manual payment submission (Task 56-b) — buyer's own open orders */}
          {canSubmitPayment && (
            <div className="pt-3">
              <Button
                onClick={openPayDialog}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-2xl text-xs gap-2"
              >
                <Wallet className="h-4 w-4" />
                {order.paymentStatus === 'partial'
                  ? `Submit payment for remaining ${formatPrice(remainingDue)}`
                  : 'Submit payment'}
              </Button>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                Paid outside the app? Send money to the seller&apos;s bKash / bank, then submit the transaction reference here. The seller verifies it before the order is marked paid.
              </p>
            </div>
          )}

          {/* Task 57-a: buyer self-service cancellation — pre-payment, pre-pack only */}
          {canCancelOrder && (
            <div className="pt-3">
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
                disabled={cancelling}
                className="w-full h-11 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 dark:hover:text-red-300 gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancel order
              </Button>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                Cancelling restores the stock and voids any pending payment reference. Once the seller packs or ships, contact the supplier instead.
              </p>
            </div>
          )}

          {/* Real payment records */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {order.payments.length === 0 ? (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                No payments recorded yet. Orders start <span className="font-bold text-amber-600">UNPAID</span> — payment is confirmed only after verification.
              </p>
            ) : (
              order.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 capitalize">
                    <CreditCard className="h-3.5 w-3.5" /> {p.method || '--'}
                  </span>
                  <span className="text-right">
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">{formatPrice(p.amount)}</span>
                    <span className={`text-[10px] uppercase ${p.status === 'pending' ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-400'}`}>
                      {p.status === 'pending' ? 'verification pending' : (p.status || '--')}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-2">
            <Button
              variant="outline"
              onClick={() => navigate('order-invoice', { orderId })}
              className="w-full bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-bold h-11 rounded-2xl text-xs flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              View Invoice
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => navigate('submit-ticket', { orderId })}
                className="py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Raise Dispute Ticket
              </button>

              <button
                onClick={() => navigate('report-user', { orderId })}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Report Seller
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] md:text-xs text-slate-500 dark:text-slate-400 pt-2 px-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => navigate('escrow-protection-guide')}
                className="hover:text-red-600 hover:underline"
              >
                Payment Verification Rules
              </button>
              <button
                onClick={() => navigate('buyer-protection-policy')}
                className="hover:text-red-600 hover:underline"
              >
                Buyer Protection Policy
              </button>
            </div>
          </div>
        </div>

        {/* Shipping & Payment Info Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 lg:col-span-3 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          {/* Shipping */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Truck className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>Shipping Address</span>
            </div>
            {order.shippingAddress ? (
              <div className="text-xs text-slate-600 dark:text-slate-400 pl-6 space-y-0.5">
                {order.shippingAddress.label && <p className="font-bold text-slate-800 dark:text-slate-200">{order.shippingAddress.label}</p>}
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress.city}{order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ''}{order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ''}</p>
              </div>
            ) : (
              <div className="text-xs text-slate-400 pl-6 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> No shipping address on file for this order.
              </div>
            )}
          </div>

          {/* Billing */}
          <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-800 lg:border-t-0 lg:pt-0">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CreditCard className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span>Billed To</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 pl-6 space-y-0.5">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {user?.businessName || user?.fullName || 'Your account'}
              </p>
              {user?.email && <p>{user.email}</p>}
              <p className="text-slate-400 text-[11px] capitalize">
                Payment status: {paymentStatusLabel.toLowerCase()}
                {order.paymentStatus !== 'paid' && ' — verified payment required before shipment'}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Submit-payment dialog (Task 56-b manual leg) */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => { if (!paySubmitting) { setPayDialogOpen(open); if (!open) setPayError('') } }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black">Submit payment for order #{order?.orderNumber || '--'}</DialogTitle>
            <DialogDescription className="text-xs">
              Record how you paid outside the app. The seller verifies the reference before the order is marked paid — false references are rejected and audited.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">
                {order?.paymentStatus === 'partial' ? 'Remaining due' : 'Order total'}
              </span>
              <span className="text-lg font-black text-primary">{formatPrice(order?.paymentStatus === 'partial' ? remainingDue : (order?.totalAmount ?? 0))}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Method *</label>
              <select
                value={payMethodIdx}
                onChange={(e) => setPayMethodIdx(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-input bg-white dark:bg-slate-900 px-3 text-xs font-bold"
              >
                {PAYMENT_METHOD_OPTIONS.map((m, idx) => (
                  <option key={`${m.value}-${m.brand ?? ''}`} value={idx}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Transaction / reference ID *</label>
              <Input
                value={payTrxId}
                onChange={(e) => setPayTrxId(e.target.value)}
                placeholder="e.g. bKash TrxID or bank reference (6-64)"
                className="h-10 rounded-xl text-xs"
                maxLength={64}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sender number (optional)</label>
                <Input
                  value={paySender}
                  onChange={(e) => setPaySender(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="h-10 rounded-xl text-xs"
                  maxLength={21}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Note (optional)</label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. paid from 017… via bKash app"
                  className="h-10 rounded-xl text-xs"
                  maxLength={500}
                />
              </div>
            </div>

            {payError && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {payError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPayDialogOpen(false); setPayError('') }} disabled={paySubmitting} className="h-10 px-4 rounded-xl text-xs font-bold">
              Cancel
            </Button>
            <Button
              onClick={submitPayment}
              disabled={paySubmitting || !payTrxId.trim()}
              className="h-10 px-5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white"
            >
              {paySubmitting ? 'Submitting…' : 'Submit payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task 57-a/58: cancel confirmation — states the real consequences verbatim */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { setCancelDialogOpen(open); if (!open) setScopedShipment(null) }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              {scopedShipment
                ? `Cancel the ${scopedShipment.label} shipment?`
                : `Cancel order #${order?.orderNumber || '--'}?`}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {scopedShipment
                ? 'This cancels only this supplier\u2019s shipment, restores its stock, and reduces the order total by what that shipment owed. The rest of the order stays active. This cannot be undone.'
                : 'This cancels every shipment on the order, restores the stock to the supplier, and voids any pending payment reference so it can never be verified later. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setScopedShipment(null) }} disabled={cancelling} className="h-10 px-4 rounded-xl text-xs font-bold">
              {scopedShipment ? 'Keep shipment' : 'Keep order'}
            </Button>
            <Button
              onClick={confirmCancel}
              disabled={cancelling}
              className="h-10 px-5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelling ? 'Cancelling…' : scopedShipment ? 'Yes, cancel shipment' : 'Yes, cancel order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OrderDetailPage
