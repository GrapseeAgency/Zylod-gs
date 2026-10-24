'use client'

/**
 * Admin Profile / Command Center — rewired in Task 51-b.
 *
 * Every data surface here now talks to a REAL endpoint with the platform's
 * cookie transport (credentials:'include') and shows real error states:
 *   - Overview KPIs   → GET /api/admin/dashboard (real platformOverview +
 *                       pendingApprovals shape — the old mapping read fields
 *                       this API has never returned)
 *   - Complaints tab  → GET /api/admin/complaints (real queue since Task 48)
 *                       with a link into the full admin-complaints page
 *   - Ping            → GET /api (a real public route; the old ping hit
 *                       /api/health which has never existed → 404)
 *
 * DELETED as dead-ends that faked success against endpoints that DO NOT EXIST
 * anywhere in src/app/api: the KYC "approve/reject" merchant queue (it called
 * /api/admin/users/[id]/approve and /api/admin/users/[id]/reject), the staff
 * roster (/api/admin/staff), and the announcement broadcaster
 * (/api/admin/announcements). Real KYC review lives on the admin-suppliers
 * page (PATCH /api/admin/suppliers); the silent "// Graceful" catches are gone.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Shield, Users, DollarSign, AlertTriangle, Activity,
  Settings, BarChart3, Building2, Scale, Server,
  ShieldCheck, Loader2, RefreshCw, TrendingUp, Lock,
  Megaphone, CreditCard, ChevronRight, Inbox, Store,
} from 'lucide-react'

// ─── TYPE DEFINITIONS (real API shapes) ───────────────────────────────────────
interface AdminStats {
  totalUsers?: number
  totalSellers?: number
  totalOrders?: number
  totalRevenue?: number
  pendingKyc?: number
  pendingProducts?: number
}

interface ComplaintSummary {
  id: string
  title: string
  status: string
  categoryLabel: string
  buyerName: string | null
  createdAt: string
}

interface ComplaintCounts {
  open: number
  in_review: number
  resolved: number
  rejected: number
  withdrawn: number
  total: number
}

const complaintStatusChip: Record<string, string> = {
  open: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  in_review: 'bg-primary/10 text-primary/70 border-primary/30',
  resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  withdrawn: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function AdminStatCard({
  icon: Icon,
  value,
  label,
  sub,
  urgent,
}: {
  icon: React.ElementType
  value: string
  label: string
  sub?: string
  urgent?: boolean
}) {
  return (
    <div className={`rounded-3xl p-4 border shadow-2xs space-y-3 ${urgent ? 'bg-rose-950/80 border-rose-800' : 'bg-slate-800/60 border-slate-700'}`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${urgent ? 'bg-rose-500/20 text-rose-300' : 'bg-white dark:bg-gray-900/10 text-slate-300'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className={`text-2xl font-black font-mono leading-none ${urgent ? 'text-rose-300' : 'text-white'}`}>
          {value}
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wider block mt-1 ${urgent ? 'text-rose-400' : 'text-slate-400'}`}>{label}</span>
        {sub && <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 block">{sub}</span>}
      </div>
    </div>
  )
}

// ─── MAIN ADMIN PROFILE PAGE ──────────────────────────────────────────────────
export function AdminProfilePage() {
  const { navigate } = useNavigationStore()
  const { user, logout } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  // Active tab — the dead Staff Roster / KYC-queue / Broadcast tabs are gone.
  const [activeTab, setActiveTab] = useState<
    'overview' | 'complaints' | 'finance' | 'platform' | 'settings'
  >('overview')

  // Data (real endpoints)
  const [stats, setStats] = useState<AdminStats>({})
  const [statsError, setStatsError] = useState('')
  const [statsNeedsAuth, setStatsNeedsAuth] = useState(false)
  const [complaints, setComplaints] = useState<ComplaintSummary[]>([])
  const [complaintCounts, setComplaintCounts] = useState<ComplaintCounts | null>(null)
  const [complaintsError, setComplaintsError] = useState('')
  const [complaintsLoading, setComplaintsLoading] = useState(false)

  // UI state
  const [serverPing, setServerPing] = useState<number | null>(null)
  const [pingLoading, setPingLoading] = useState(false)

  // ─── FETCH: platform KPIs (GET /api/admin/dashboard — real shape) ────────
  const fetchStats = useCallback(async () => {
    setStatsError('')
    setStatsNeedsAuth(false)
    try {
      const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setStatsNeedsAuth(true)
        setStats({})
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setStatsError(json?.error || `Failed to load platform stats (HTTP ${res.status})`)
        setStats({})
        return
      }
      const d = json.data ?? {}
      setStats({
        totalUsers: d.platformOverview?.totalUsers,
        totalSellers: d.platformOverview?.activeSuppliers,
        totalOrders: d.platformOverview?.totalOrders,
        totalRevenue: d.platformOverview?.totalRevenueBDT,
        pendingKyc: d.pendingApprovals?.supplierVerification,
        pendingProducts: d.pendingApprovals?.productApproval,
      })
    } catch {
      setStatsError('Network error while loading platform stats. Check your connection and retry.')
      setStats({})
    }
  }, [])

  // ─── FETCH: real complaints queue (GET /api/admin/complaints) ────────────
  const fetchComplaints = useCallback(async () => {
    setComplaintsLoading(true)
    setComplaintsError('')
    try {
      const res = await fetch('/api/admin/complaints?status=all&take=100', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        setComplaintsError(json401Message(res.status))
        setComplaints([])
        setComplaintCounts(null)
        return
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setComplaintsError(json?.error || `Failed to load complaints (HTTP ${res.status})`)
        setComplaints([])
        setComplaintCounts(null)
        return
      }
      const all = Array.isArray(json.data?.complaints) ? json.data.complaints : []
      setComplaintCounts(json.data?.counts ?? null)
      // Most recent five for the compact card — the full queue lives on admin-complaints.
      setComplaints(all.slice(0, 5))
    } catch {
      setComplaintsError('Network error while loading complaints. Check your connection and retry.')
      setComplaints([])
      setComplaintCounts(null)
    } finally {
      setComplaintsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchComplaints()
  }, [fetchStats, fetchComplaints])

  // ─── PING SERVER (real endpoint: GET /api) ────────────────────────────────
  const pingServer = async () => {
    setPingLoading(true)
    const start = performance.now()
    try {
      const res = await fetch('/api', { cache: 'no-store' })
      // Measure against the REAL status — a 4xx/5xx is not a healthy ping.
      if (res.ok) setServerPing(Math.round(performance.now() - start))
      else setServerPing(-1)
    } catch {
      setServerPing(-1)
    } finally {
      setPingLoading(false)
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-xl flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('home')} className="p-1 text-slate-400 dark:text-slate-500 hover:text-white" title="Home">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-lg font-black tracking-tight text-primary">Zylod</span>
            <span className="text-[9px] font-bold text-rose-500 block -mt-0.5 uppercase tracking-widest">
              Admin Command Center
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pingServer}
            className="h-9 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            {pingLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Activity className="h-3.5 w-3.5" />
            )}
            {serverPing !== null
              ? serverPing < 0
                ? 'Offline'
                : `${serverPing}ms`
              : 'Ping'}
          </button>
          <button
            onClick={() => navigate('account-settings')}
            className="min-h-11 min-w-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-white"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto lg:max-w-6xl w-full">
        {/* ─── DESKTOP COMMAND BAR ─────────────────────────────────────── */}
        <div className="hidden md:flex items-center justify-between px-6 pt-5">
          <div>
            <span className="text-xl font-black tracking-tight text-primary">Zylod</span>
            <span className="text-[9px] font-bold text-rose-500 block -mt-0.5 uppercase tracking-widest">
              Admin Command Center
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={pingServer}
              className="h-9 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
            >
              {pingLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              {serverPing !== null
                ? serverPing < 0
                  ? 'Offline'
                  : `${serverPing}ms`
                : 'Ping'}
            </button>
            <button
              onClick={() => navigate('account-settings')}
              className="min-h-11 min-w-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-white"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── ADMIN IDENTITY CARD ─────────────────────────────────────── */}
        <div className="border-b border-slate-800 bg-slate-900">
          <div className="px-4 py-5 md:px-6 space-y-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden ring-2 ring-rose-500/30 flex items-center justify-center">
                  <Shield className="h-10 w-10 text-rose-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center border-2 border-slate-950">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>

              {/* Identity */}
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    {user?.fullName || 'Platform Administrator'}
                  </h1>
                  <span className="text-[10px] font-black text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Admin
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{user?.email || 'Not signed in'}</p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{user ? 'Admin Session Active' : 'Sign in to load live platform data'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION ──────────────────────────────────────────── */}
        <div className="sticky top-[57px] md:top-[60px] z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 py-2">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'complaints', label: 'Complaints', icon: Scale },
              { key: 'finance', label: 'Finance', icon: DollarSign },
              { key: 'platform', label: 'System Health', icon: Server },
              { key: 'settings', label: 'Security', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary text-white shadow-xs font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* ═══════════════════════════════════════════════════════════
                  TAB 1: PLATFORM OVERVIEW
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <>
                  {statsNeedsAuth ? (
                    <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 text-center space-y-3">
                      <Lock className="h-10 w-10 text-amber-400 mx-auto" />
                      <h2 className="text-sm font-black text-white">Admin access required</h2>
                      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">Platform stats come from the admin dashboard API. Sign in with an admin account to load live numbers.</p>
                      <Button onClick={() => navigate('login')} className="h-11 px-5 rounded-xl text-xs font-bold">Sign In</Button>
                    </div>
                  ) : statsError ? (
                    <div className="bg-slate-900 rounded-3xl p-8 border border-red-900/60 text-center space-y-3">
                      <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
                      <h2 className="text-sm font-black text-white">Could not load platform stats</h2>
                      <p className="text-xs text-red-400 break-words">{statsError}</p>
                      <Button onClick={fetchStats} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2 border-slate-700 bg-slate-800 text-slate-200">
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Platform KPI Grid — real dashboard aggregates */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        <AdminStatCard
                          icon={Users}
                          value={stats.totalUsers !== undefined ? String(stats.totalUsers) : '—'}
                          label="Registered Users"
                        />
                        <AdminStatCard
                          icon={DollarSign}
                          value={stats.totalRevenue !== undefined ? formatPrice(stats.totalRevenue) : '—'}
                          label="Paid Gross Volume"
                        />
                        <AdminStatCard
                          icon={Building2}
                          value={stats.totalSellers !== undefined ? String(stats.totalSellers) : '—'}
                          label="Active Sellers"
                        />
                        <AdminStatCard
                          icon={Store}
                          value={stats.totalOrders !== undefined ? String(stats.totalOrders) : '—'}
                          label="Platform Orders"
                        />
                        <AdminStatCard
                          icon={ShieldCheck}
                          value={stats.pendingKyc !== undefined ? String(stats.pendingKyc) : '—'}
                          label="Pending KYC"
                          sub={stats.pendingProducts !== undefined ? `${stats.pendingProducts} products awaiting review` : undefined}
                          urgent={Number(stats.pendingKyc) > 0}
                        />
                        <AdminStatCard
                          icon={Scale}
                          value={complaintCounts ? String(complaintCounts.open) : '—'}
                          label="Open Complaints"
                          urgent={(complaintCounts?.open ?? 0) > 0}
                        />
                      </div>

                      {/* Real quick links into the working admin surfaces */}
                      <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
                        <h2 className="text-sm font-black text-white flex items-center gap-2">
                          <Activity className="h-4 w-4 text-emerald-400" />
                          Jump into the queues
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {[
                            { label: 'Product moderation', desc: 'Approve or reject supplier listings — with media review', page: 'admin-products' as const },
                            { label: 'KYC verification', desc: 'Approve / reject seller verification with audit trail', page: 'admin-suppliers' as const },
                            { label: 'Payment verification', desc: 'Verify real bank / mobile transfers', page: 'admin-payments' as const },
                            { label: 'Inventory audit', desc: 'Read-only stock oversight across suppliers', page: 'admin-inventory' as const },
                            { label: 'Orders fulfillment', desc: 'Every order with real per-shipment status', page: 'admin-orders' as const },
                            { label: 'Complaints queue', desc: 'Buyer complaints with evidence review', page: 'admin-complaints' as const },
                          ].map((item) => (
                            <button
                              key={item.page}
                              onClick={() => navigate(item.page)}
                              className="min-h-11 flex items-center justify-between gap-2 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-2.5 text-left hover:bg-slate-800 transition"
                            >
                              <span>
                                <span className="text-xs font-black text-white block">{item.label}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{item.desc}</span>
                              </span>
                              <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-400 dark:text-slate-500 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Real health reading — no fabricated service rows */}
                      <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-sm font-black text-white flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-400" />
                            Infrastructure Health
                          </h2>
                          {serverPing !== null && (
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${serverPing < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${serverPing < 0 ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                              {serverPing < 0 ? 'API unreachable' : 'Operational'}
                            </span>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-300">API round-trip (GET /api)</span>
                              <span className="text-slate-400 dark:text-slate-500 font-mono">{serverPing === null ? 'Press Ping to measure' : serverPing < 0 ? 'failed' : `${serverPing}ms`}</span>
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${serverPing === null ? 'bg-slate-600' : serverPing < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: serverPing === null ? '8%' : serverPing < 0 ? '100%' : '100%' }}
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                            The only number shown here is one this page actually measured. No invented service latencies.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 2: COMPLAINTS (real queue since Task 48)
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'complaints' && (
                <>
                  {/* Real counts */}
                  {complaintCounts && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {([
                        ['open', complaintCounts.open],
                        ['in_review', complaintCounts.in_review],
                        ['resolved', complaintCounts.resolved],
                        ['rejected', complaintCounts.rejected],
                        ['withdrawn', complaintCounts.withdrawn],
                        ['total', complaintCounts.total],
                      ] as const).map(([key, value]) => (
                        <div key={key} className="bg-slate-900 rounded-2xl border border-slate-800 p-3 text-center">
                          <p className="text-lg font-black font-mono text-white">{value}</p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{key.replace('_', ' ')}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {complaintsLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-16 bg-slate-900 rounded-2xl border border-slate-800 animate-pulse" />
                      ))}
                    </div>
                  ) : complaintsError ? (
                    <div className="bg-slate-900 rounded-3xl p-8 border border-red-900/60 text-center space-y-3">
                      <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
                      <h2 className="text-sm font-black text-white">Could not load complaints</h2>
                      <p className="text-xs text-red-400 break-words">{complaintsError}</p>
                      <Button onClick={fetchComplaints} variant="outline" className="h-10 px-5 rounded-xl text-xs font-bold gap-2 border-slate-700 bg-slate-800 text-slate-200">
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  ) : complaints.length > 0 ? (
                    <div className="space-y-2">
                      {complaints.map((c) => (
                        <div key={c.id} className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">{c.title}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {c.categoryLabel} · {c.buyerName || 'buyer name unavailable'} · {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold border px-2 py-1 rounded-full whitespace-nowrap ${complaintStatusChip[c.status] ?? complaintStatusChip.withdrawn}`}>
                            {c.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                      <Button
                        onClick={() => navigate('admin-complaints')}
                        className="w-full min-h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
                      >
                        <Megaphone className="h-4 w-4" /> Open the full complaints queue
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-slate-900 rounded-3xl p-12 border border-slate-800 text-center space-y-3">
                      <Inbox className="h-12 w-12 text-slate-600 dark:text-slate-400 dark:text-slate-500 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500">No complaints filed yet</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Buyer complaints appear here the moment they are filed. The counts above are live from the complaints table.</p>
                      <Button
                        onClick={() => navigate('admin-complaints')}
                        variant="outline"
                        className="min-h-11 px-5 rounded-xl text-xs font-bold border-slate-700 bg-slate-800 text-slate-200"
                      >
                        Go to complaints queue
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 3: FINANCE — honest: real queue links, no invented rates
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'finance' && (
                <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Money on the platform
                  </h2>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-300">Paid gross volume</span>
                      <span className="font-bold text-white font-mono">{stats.totalRevenue !== undefined ? formatPrice(stats.totalRevenue) : '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-300">Orders awaiting payment verification</span>
                      <span className="font-bold text-white font-mono">See unpaid queue</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    Commission / settlement rates are not configured anywhere in the platform yet — no percentage is shown here because none exists to show.
                  </p>
                  <Button
                    onClick={() => navigate('admin-payments')}
                    className="w-full min-h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" /> Open payment verification queue
                  </Button>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 4: SYSTEM HEALTH — real measured data only
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'platform' && (
                <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    System Health
                  </h2>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-slate-800">
                      <span className="text-slate-300">API round-trip (GET /api)</span>
                      <span className="font-bold text-white font-mono">
                        {serverPing === null ? 'Press Ping to measure' : serverPing < 0 ? 'Failed' : `${serverPing}ms`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-800">
                      <span className="text-slate-300">Realtime socket service</span>
                      <span className="text-slate-400 dark:text-slate-500 font-mono">loopback :3006 — degrades to polling when down</span>
                    </div>
                  </div>
                  <Button
                    onClick={pingServer}
                    disabled={pingLoading}
                    variant="outline"
                    className="w-full min-h-11 rounded-xl text-xs font-bold border-slate-700 bg-slate-800 text-slate-200 gap-2"
                  >
                    {pingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                    {pingLoading ? 'Measuring…' : 'Measure API latency now'}
                  </Button>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    Maintenance mode is not a platform capability yet — no switch is shown here because none is wired to a real endpoint.
                  </p>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 5: SECURITY
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'settings' && (
                <>
                  <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" />
                      Administrator Security
                    </h2>
                    <div className="space-y-2">
                      <Button
                        onClick={() => navigate('reset-password')}
                        variant="outline"
                        className="w-full min-h-11 justify-start border-slate-700 bg-slate-800 text-slate-200 text-xs rounded-xl"
                      >
                        Change Admin Password
                      </Button>
                      <Button
                        onClick={() => { logout?.(); navigate('login') }}
                        className="w-full min-h-11 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl"
                      >
                        Sign Out Admin Session
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3" />
                    Every moderation write you perform elsewhere is audit-logged with your admin session id.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

/** Honest message for auth failures — the real HTTP status, never a silent skip. */
function json401Message(status: number): string {
  return status === 403
    ? 'Admin access required (403) — your account is not an admin.'
    : 'Admin authentication required (401) — sign in with an admin account.'
}
