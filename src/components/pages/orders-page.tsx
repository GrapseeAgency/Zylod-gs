'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  Menu, Search, QrCode, FileText, Truck, RotateCcw,
  MessageSquare, Package, AlertCircle, Loader2
} from 'lucide-react'

/**
 * REAL orders list — no demo rows, no fake PO numbers/carriers/dates.
 * Data comes exclusively from GET /api/orders/my-orders (server-side buyer scope).
 * - Loading  → skeleton placeholders (never fake rows).
 * - Empty    → honest "No orders yet" state with CTA.
 * - Error    → the real backend error text with a retry action.
 */

interface OrderCardItem {
  id: string
  poNumber: string
  date: string
  subOrderCount: number
  totalAmount: number
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus?: string
  supplierName: string
}

interface ApiSubOrder {
  status?: string
  supplier?: { company_name?: string }
}

interface ApiOrder {
  id?: string
  order_number?: string
  total_amount?: number
  payment_status?: string
  placed_at?: string
  updated_at?: string
  sub_orders?: ApiSubOrder[]
}

/** Mirror of the backend's overall-status logic (my-orders route). */
function deriveStatus(subOrders: ApiSubOrder[]): OrderCardItem['status'] {
  const statuses = subOrders.map((s) => (s.status || 'pending').toLowerCase())
  if (statuses.length === 0) return 'processing'
  if (statuses.every((s) => s === 'delivered')) return 'delivered'
  if (statuses.some((s) => s === 'cancelled')) return 'cancelled'
  if (statuses.some((s) => s === 'shipped')) return 'shipped'
  // pending / confirmed / packed → still being processed
  return 'processing'
}

export function OrdersPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'processing' | 'shipped' | 'delivered'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [orders, setOrders] = useState<OrderCardItem[]>([])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    setNeedsAuth(false)
    try {
      const res = await fetch('/api/orders/my-orders', { credentials: 'include' })
      const json = await res.json().catch(() => null)

      if (res.status === 401) {
        setNeedsAuth(true)
        setError(json?.error || 'Please sign in as a buyer to view your orders.')
        setOrders([])
        return
      }
      if (!res.ok || !json?.success) {
        setError(json?.error || `Could not load orders (HTTP ${res.status})`)
        setOrders([])
        return
      }

      const data: ApiOrder[] = Array.isArray(json.data) ? json.data : []
      setOrders(
        data.map((o) => {
          const subOrders = Array.isArray(o.sub_orders) ? o.sub_orders : []
          const supplierNames = Array.from(
            new Set(
              subOrders
                .map((so) => so.supplier?.company_name)
                .filter((n): n is string => typeof n === 'string' && n.length > 0)
            )
          )
          return {
            id: o.id || o.order_number || '--',
            poNumber: o.order_number ? `PO #${o.order_number}` : o.id || '--',
            date: new Date(o.placed_at || o.updated_at || Date.now()).toLocaleDateString(
              'en-US', { month: 'short', day: 'numeric', year: 'numeric' }
            ),
            subOrderCount: subOrders.length,
            totalAmount: typeof o.total_amount === 'number' ? o.total_amount : 0,
            status: deriveStatus(subOrders),
            paymentStatus: o.payment_status,
            supplierName: supplierNames.length > 0 ? supplierNames.join(', ') : '--',
          }
        })
      )
    } catch {
      setError('Network error while loading your orders. Check your connection and retry.')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchTab = activeTab === 'all' || o.status === activeTab
      const matchQuery =
        !searchQuery.trim() ||
        o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
      return matchTab && matchQuery
    })
  }, [orders, activeTab, searchQuery])

  const showEmptyState = !loading && !error && orders.length === 0
  const showNoMatches = !loading && !error && orders.length > 0 && filteredOrders.length === 0

  const emptyState = (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Package className="h-8 w-8 text-slate-400" />
      </div>
      <h2 className="text-base font-black text-slate-900">No orders yet</h2>
      <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
        You haven&apos;t placed any wholesale orders yet. Once you order, your purchases
        and tracking will appear here.
      </p>
      <Button
        onClick={() => navigate('home')}
        className="mt-5 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-xs"
      >
        Browse Products
      </Button>
    </div>
  )

  const errorState = (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" role="alert">
      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-red-700">{error}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <Button
            onClick={loadOrders}
            className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
          >
            Retry
          </Button>
          {needsAuth && (
            <Button
              onClick={() => navigate('login')}
              variant="outline"
              className="h-9 px-4 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs font-bold rounded-xl"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-xs md:hidden">
        <div className="flex items-center justify-between">
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Menu">
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
          <button className="p-1 text-slate-700 hover:text-slate-900" title="Search">
            <Search className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-5 max-w-lg mx-auto lg:max-w-5xl">
        {/* Title */}
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">My Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage and track your wholesale purchases.
          </p>
        </div>

        {error && errorState}

        {/* Search PO / Supplier Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO# or Supplier..."
            className="h-11 pl-10 pr-10 rounded-2xl bg-white border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400"
          />
          <QrCode className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Orders' },
            { key: 'processing', label: 'Processing' },
            { key: 'shipped', label: 'Shipped' },
            { key: 'delivered', label: 'Delivered' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading skeletons (mobile) */}
        {loading && (
          <div className="space-y-3.5 md:hidden" aria-busy="true" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                <div className="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                <div className="h-12 w-full bg-slate-100 rounded-2xl animate-pulse" />
                <div className="h-9 w-full bg-slate-100 rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Orders List (mobile cards) */}
        {!loading && !error && (
          <div className="space-y-3.5 md:hidden">
            {showEmptyState && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs">
                {emptyState}
              </div>
            )}
            {showNoMatches && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 text-center text-xs text-slate-400">
                No orders match your search or filter.
              </div>
            )}
            {filteredOrders.map((order) => {
              const isShipped = order.status === 'shipped'
              const isProcessing = order.status === 'processing'
              const isDelivered = order.status === 'delivered'

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        {order.poNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        {order.date} • {order.subOrderCount} shipment{order.subOrderCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                          {order.status.toUpperCase()}
                        </span>
                        <span className="text-sm font-black text-primary">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </div>
                      {order.paymentStatus && order.paymentStatus !== 'paid' && (
                        <span className="text-[10px] font-bold text-amber-600 uppercase mt-0.5 block">
                          {order.paymentStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Supplier Summary Row */}
                  <div className="flex gap-3 items-center pt-1">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                        {order.supplierName}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Supplier{order.subOrderCount > 1 ? 's' : ''} on this order
                      </p>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-2 border-t border-slate-50 flex items-center gap-2.5">
                    {isShipped && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => navigate('order-invoice', { orderId: order.id })}
                          className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Invoice
                        </Button>
                        <Button
                          onClick={() => navigate('track-order', { orderId: order.id })}
                          className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          Track Order
                        </Button>
                      </>
                    )}

                    {isProcessing && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => navigate('order-detail', { orderId: order.id })}
                          className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 rounded-2xl text-xs"
                        >
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => navigate('live-chat')}
                          className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 rounded-2xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Contact Supplier
                        </Button>
                      </>
                    )}

                    {isDelivered && (
                      <div className="w-full flex justify-end">
                        <Button
                          variant="outline"
                          onClick={() => navigate('home')}
                          className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-10 px-5 rounded-2xl text-xs flex items-center gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-primary" />
                          Browse Again
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Orders Table (desktop) */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50/50 text-left">
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">PO Number</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Supplier</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Total</th>
                <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={`skel-${i}`} aria-hidden="true">
                    {[24, 16, 40, 12, 14, 28].map((w, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className={`h-4 rounded bg-slate-100 animate-pulse`} style={{ width: `${w * 4}px` }} />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && showEmptyState && (
                <tr>
                  <td colSpan={6} className="p-0">
                    {emptyState}
                  </td>
                </tr>
              )}

              {!loading && showNoMatches && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-slate-400">
                    No orders match your search or filter.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredOrders.map((order) => {
                  const isShipped = order.status === 'shipped'
                  const isProcessing = order.status === 'processing'
                  const isDelivered = order.status === 'delivered'

                  return (
                    <tr key={order.id} className="hover:bg-red-50/30">
                      <td className="px-4 py-3 font-black text-slate-900 whitespace-nowrap">{order.poNumber}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {order.date} • {order.subOrderCount} shipment{order.subOrderCount === 1 ? '' : 's'}
                      </td>
                      <td className="px-4 py-3 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                          <p className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug max-w-[220px]">
                            {order.supplierName}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-primary whitespace-nowrap">{formatPrice(order.totalAmount)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isShipped && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => navigate('order-invoice', { orderId: order.id })}
                                className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                              >
                                Invoice
                              </Button>
                              <Button
                                onClick={() => navigate('track-order', { orderId: order.id })}
                                className="bg-primary hover:bg-primary/90 text-white font-bold h-8 px-3 rounded-lg text-xs shadow-xs"
                              >
                                Track
                              </Button>
                            </>
                          )}
                          {isProcessing && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => navigate('order-detail', { orderId: order.id })}
                                className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                              >
                                View Details
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => navigate('live-chat')}
                                className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                              >
                                Contact Supplier
                              </Button>
                            </>
                          )}
                          {isDelivered && (
                            <Button
                              variant="outline"
                              onClick={() => navigate('home')}
                              className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-bold h-8 px-3 rounded-lg text-xs"
                            >
                              Browse Again
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* Screen-reader status while loading (desktop) */}
        {loading && (
          <p className="hidden md:flex items-center justify-center gap-2 text-xs text-slate-400" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading your orders…
          </p>
        )}
      </main>
    </div>
  )
}

export default OrdersPage
