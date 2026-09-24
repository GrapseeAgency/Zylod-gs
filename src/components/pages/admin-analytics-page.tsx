'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  BarChart3, Users, Package, ShoppingCart, Wallet, RefreshCw, AlertTriangle,
  ScrollText, ShieldCheck, Clock,
} from 'lucide-react'

// ── Real API types (GET /api/admin/analytics) ──────────────────────────
interface AnalyticsCounts {
  totalUsers: number
  usersByType: Record<string, number>
  usersByStatus: Record<string, number>
  totalProducts: number
  productsByApproval: { approved: number; unapproved: number }
  totalCategories: number
  totalOrders: number
  ordersByStatus: Record<string, number>
  totalSubOrders: number
  subOrdersByStatus: Record<string, number>
  totalPayments: number
  paymentsByStatus: Record<string, number>
  totalRevenue: number
  gmvSum: number
  totalReviews: number
  totalAuditLogs: number
  totalWishlistItems: number
  totalCoupons: number
  totalSessions: number
  activeSessions: number
  suppliersPendingKyc: number
  totalReturnRequests: number | null
  totalDisputes: number | null
}

interface ApiAnalytics {
  counts: AnalyticsCounts
  recentAuditLogs: { id: string; action: string; createdAt: string; actorId: string | null }[]
  recentOrders: { id: string; orderNumber: string; status: string; paymentStatus: string; totalAmount: number; placedAt: string }[]
  dataNotes: string[]
}

const chipClass = 'text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400'

// Real status → chip color (same palette language as the admin queues)
const statusChip: Record<string, string> = {
  processing: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800',
  shipped: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  delivered: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  cancelled: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900',
  pending: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  failed: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900',
  refunded: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800',
  active: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-900',
  suspended: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900',
  banned: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900',
}

const REFRESH_INTERVAL_MS = 30_000

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

// ── Small breakdown card: title + label/value rows from real data ──────
function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: number | null }[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
      <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{title}</h3>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              {row.value === null && <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" title="No module in the database yet" />}
              {row.label}
            </span>
            <span className={`text-xs font-black tabular-nums ${row.value === null ? 'text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
              {row.value === null ? '—' : row.value.toLocaleString('en-BD')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Small KPI card for the secondary count strip ───────────────────────
function MiniStat({ label, value, sub }: { label: string; value: number | null; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-xl font-black tabular-nums mt-1 ${value === null ? 'text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
        {value === null ? '—' : value.toLocaleString('en-BD')}
      </p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub || (value === null ? 'not tracked yet' : '\u00A0')}</p>
    </div>
  )
}

export function AdminAnalyticsPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()

  const [data, setData] = useState<ApiAnalytics | null>(null)
  const [loading, setLoading] = useState(true)      // initial load → skeleton
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')            // full error when nothing loaded yet
  const [refreshError, setRefreshError] = useState('') // verbatim error on a failed refresh (data stays)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const inFlight = useRef(false)

  const loadAnalytics = useCallback(async (background = false) => {
    if (inFlight.current) return
    inFlight.current = true
    if (background) setRefreshing(true)
    else { setLoading(true); setError(''); setRefreshError('') }
    setRefreshError('')
    try {
      const res = await fetch('/api/admin/analytics', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setNeedsAuth(true)
        setData(null)
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Failed to load analytics (HTTP ${res.status})`
        if (background) setRefreshError(msg)
        else setError(msg)
        return
      }
      setData(json.data as ApiAnalytics)
      setLastUpdated(new Date())
    } catch {
      const msg = 'Network error while loading analytics. Check your connection and retry.'
      if (background) setRefreshError(msg)
      else setError(msg)
    } finally {
      inFlight.current = false
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  // Initial load + auto-refresh every 30s (with cleanup)
  useEffect(() => {
    loadAnalytics()
    const id = setInterval(() => { loadAnalytics(true) }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadAnalytics])

  // ── Guard states ──────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-base font-black">Admin access required</h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">Platform analytics are restricted to Zylod admins. Sign in with an admin account to view live platform counts.</p>
        <Button onClick={() => navigate('login')} className="h-10 px-5 rounded-xl text-xs font-bold">Sign In</Button>
      </div>
    )
  }

  const c = data?.counts
  const marketplaceEmpty = !!c && c.totalUsers === 0 && c.totalProducts === 0 && c.totalOrders === 0

  return (
    <div className="max-w-[1280px] mx-auto space-y-4 px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight">Platform Analytics</h1>
            <p className="text-[11px] text-slate-400">Live counts from the real database — no estimates, no projections.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 tabular-nums">Updated {lastUpdated.toLocaleTimeString('en-GB')} · auto-refreshes every 30s</span>
          )}
          <Button
            variant="outline"
            onClick={() => loadAnalytics(true)}
            disabled={refreshing}
            className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Verbatim refresh error (last good data stays on screen) */}
      {refreshError && data && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-2xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-bold">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{refreshError}</span>
          <button onClick={() => loadAnalytics(true)} className="ml-auto underline underline-offset-2 shrink-0">Retry</button>
        </div>
      )}

      {/* States */}
      {loading ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
            ))}
          </div>
        </>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-black">Could not load platform analytics</h2>
          <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
          <Button onClick={() => loadAnalytics()} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : c && data ? (
        <>
          {/* Honest empty-marketplace banner — zeros ARE the truth here */}
          {marketplaceEmpty && (
            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
              <span>
                This marketplace has no data yet — every number on this page is a live count from the database, and right now they are all zero. Figures appear the moment real users, products and orders exist.
              </span>
            </div>
          )}

          {/* Top KPI strip — Users · Products · Orders · Revenue */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Users</p>
                <Users className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-200 mt-1">{c.totalUsers.toLocaleString('en-BD')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {c.usersByType.buyer} buyers · {c.usersByType.supplier} suppliers · {c.usersByType.admin} admins
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Products</p>
                <Package className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-200 mt-1">{c.totalProducts.toLocaleString('en-BD')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {c.productsByApproval.approved} approved · {c.productsByApproval.unapproved} pending
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Orders</p>
                <ShoppingCart className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-200 mt-1">{c.totalOrders.toLocaleString('en-BD')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">GMV {formatPrice(c.gmvSum)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Revenue</p>
                <Wallet className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-2xl font-black tabular-nums text-primary mt-1">{formatPrice(c.totalRevenue)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">verified (status success) payments</p>
            </div>
          </div>

          {/* Secondary counts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <MiniStat label="Categories" value={c.totalCategories} />
            <MiniStat label="Sub-orders" value={c.totalSubOrders} />
            <MiniStat label="Payments" value={c.totalPayments} />
            <MiniStat label="Reviews" value={c.totalReviews} />
            <MiniStat label="Audit log entries" value={c.totalAuditLogs} />
            <MiniStat label="Wishlist items" value={c.totalWishlistItems} />
            <MiniStat label="Coupons" value={c.totalCoupons} />
            <MiniStat label="Sessions" value={c.totalSessions} sub={`${c.activeSessions} active (not expired)`} />
            <MiniStat label="Suppliers pending KYC" value={c.suppliersPendingKyc} sub="awaiting admin review" />
            <MiniStat label="Return requests" value={c.totalReturnRequests} sub="no module in DB yet" />
            <MiniStat label="Disputes" value={c.totalDisputes} sub="no module in DB yet" />
          </div>

          {/* Breakdowns */}
          <div>
            <h2 className="text-sm font-black tracking-tight mb-2">Breakdowns</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <BreakdownCard title="Users by type" rows={[
                { label: 'Buyers', value: c.usersByType.buyer },
                { label: 'Suppliers', value: c.usersByType.supplier },
                { label: 'Admins', value: c.usersByType.admin },
              ]} />
              <BreakdownCard title="Users by status" rows={[
                { label: 'Active', value: c.usersByStatus.active },
                { label: 'Suspended', value: c.usersByStatus.suspended },
                { label: 'Banned', value: c.usersByStatus.banned },
              ]} />
              <BreakdownCard title="Products by approval" rows={[
                { label: 'Approved', value: c.productsByApproval.approved },
                { label: 'Pending approval', value: c.productsByApproval.unapproved },
              ]} />
              <BreakdownCard title="Orders by status" rows={[
                { label: 'Processing', value: c.ordersByStatus.processing },
                { label: 'Shipped', value: c.ordersByStatus.shipped },
                { label: 'Delivered', value: c.ordersByStatus.delivered },
                { label: 'Cancelled', value: c.ordersByStatus.cancelled },
              ]} />
              <BreakdownCard title="Sub-orders by status" rows={[
                { label: 'Pending', value: c.subOrdersByStatus.pending },
                { label: 'Confirmed', value: c.subOrdersByStatus.confirmed },
                { label: 'Packed', value: c.subOrdersByStatus.packed },
                { label: 'Shipped', value: c.subOrdersByStatus.shipped },
                { label: 'Delivered', value: c.subOrdersByStatus.delivered },
                { label: 'Cancelled', value: c.subOrdersByStatus.cancelled },
                { label: 'Returned', value: c.subOrdersByStatus.returned },
              ]} />
              <BreakdownCard title="Payments by status" rows={[
                { label: 'Pending', value: c.paymentsByStatus.pending },
                { label: 'Success (paid)', value: c.paymentsByStatus.success },
                { label: 'Failed', value: c.paymentsByStatus.failed },
                { label: 'Refunded', value: c.paymentsByStatus.refunded },
              ]} />
            </div>
          </div>

          {/* Recent audit log + Recent orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ScrollText className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-black">Recent audit log</h3>
                <span className="text-[10px] text-slate-400 ml-auto">last 10</span>
              </div>
              {data.recentAuditLogs.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <ScrollText className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400">Nothing yet</p>
                  <p className="text-[10px] text-slate-400">Admin actions are audit-logged and appear here as they happen.</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentAuditLogs.map((log) => (
                    <div key={log.id} className="py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{log.action}</p>
                        <p className="text-[10px] text-slate-400 truncate">actor {log.actorId || 'system'}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{formatTimestamp(log.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-black">Recent orders</h3>
                <span className="text-[10px] text-slate-400 ml-auto">last 10</span>
              </div>
              {data.recentOrders.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <ShoppingCart className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400">Nothing yet</p>
                  <p className="text-[10px] text-slate-400">Orders appear here the moment buyers check out.</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentOrders.map((o) => (
                    <div key={o.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{o.orderNumber}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold border rounded-lg px-2 py-0.5 ${statusChip[o.status] || chipClass}`}>
                            {o.status}
                          </span>
                          <span className={`text-[10px] font-bold border rounded-lg px-2 py-0.5 ${statusChip[o.paymentStatus] || chipClass}`}>
                            {o.paymentStatus}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-primary tabular-nums">{formatPrice(o.totalAmount)}</p>
                        <p className="text-[10px] text-slate-400 tabular-nums">{formatTimestamp(o.placedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Honest data notes straight from the API */}
          {data.dataNotes.length > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-1">
              {data.dataNotes.map((note, i) => (
                <p key={i} className="text-[10px] text-slate-400 leading-relaxed">· {note}</p>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

export default AdminAnalyticsPage
