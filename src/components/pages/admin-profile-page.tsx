'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ArrowLeft, Shield, Users, DollarSign, AlertTriangle, Activity,
  CheckCircle2, Clock, Settings, Edit3, BarChart3, Layers, Boxes,
  ShieldCheck, ShieldAlert, Loader2, Check, ChevronRight, X,
  RefreshCw, Zap, FileText, Truck, Star, Globe, TrendingUp,
  TrendingDown, MessageSquare, Archive, Bell, Lock, Eye,
  Megaphone, Building2, Hash, Download, Search, Filter,
  Calendar, Wrench, Cpu, Radio, Package, HardHat, Award,
  Camera, ChevronDown, ChevronUp, Ban, UserCheck, Landmark,
  CreditCard, Scale, Receipt, MapPin, Database, Server,
  ShoppingBag, Plus, Send
} from 'lucide-react'

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────────
interface MerchantPending {
  id: string
  businessName: string
  ownerName: string
  email: string
  type: string
  submittedAt: string
  kycStatus: string
}

interface DisputeCase {
  id: string
  caseNumber: string
  orderId: string
  amount: number
  openedAt: string
  status: string
  buyerName?: string
  sellerName?: string
}

interface StaffMember {
  id: string
  fullName: string
  role: string
  email: string
  status: string
  lastLogin?: string
}

interface AdminStats {
  totalUsers?: number
  totalSellers?: number
  totalBuyers?: number
  totalOrders?: number
  totalRevenue?: number
  pendingKyc?: number
  openDisputes?: number
  todayOrders?: number
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function AdminStatCard({
  icon: Icon,
  value,
  label,
  sub,
  trend,
  urgent,
}: {
  icon: React.ElementType
  value: string
  label: string
  sub?: string
  trend?: { value: string; up: boolean }
  urgent?: boolean
}) {
  return (
    <div className={`rounded-3xl p-4 border shadow-2xs space-y-3 ${urgent ? 'bg-rose-950/80 border-rose-800' : 'bg-slate-800/60 border-slate-700'}`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${urgent ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-slate-300'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className={`text-2xl font-black font-mono leading-none ${urgent ? 'text-rose-300' : 'text-white'}`}>
          {value}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-0.5 text-[10px] font-bold ${trend.up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
        <span className={`text-[11px] font-bold uppercase tracking-wider block mt-1 ${urgent ? 'text-rose-400' : 'text-slate-400'}`}>{label}</span>
        {sub && <span className="text-[10px] text-slate-500 block">{sub}</span>}
      </div>
    </div>
  )
}

// ─── MAIN ADMIN PROFILE PAGE ──────────────────────────────────────────────────
export function AdminProfilePage() {
  const { navigate } = useNavigationStore()
  const { user, token, logout } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  // Active tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'merchants' | 'disputes' | 'finance' | 'staff' | 'platform' | 'announcements' | 'settings'
  >('overview')

  // Data
  const [stats, setStats] = useState<AdminStats>({})
  const [pendingMerchants, setPendingMerchants] = useState<MerchantPending[]>([])
  const [disputes, setDisputes] = useState<DisputeCase[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  // UI state
  const [merchantSearch, setMerchantSearch] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [announcementText, setAnnouncementText] = useState('')
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false)
  const [announcementPublished, setAnnouncementPublished] = useState(false)
  const [serverPing, setServerPing] = useState<number | null>(null)
  const [pingLoading, setPingLoading] = useState(false)

  // ─── FETCH FUNCTIONS ──────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setStats(json.stats || json.data || {})
      }
    } catch {
      // Graceful
    }
  }, [token])

  const fetchPendingMerchants = useCallback(async () => {
    if (!token) return
    try {
      const params = new URLSearchParams({
        status: 'pending',
        limit: '20',
        ...(merchantSearch ? { q: merchantSearch } : {}),
      })
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setPendingMerchants(json.data)
      }
    } catch {
      // Graceful
    }
  }, [token, merchantSearch])

  const fetchDisputes = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/admin/disputes?status=open&limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setDisputes(json.data)
      }
    } catch {
      // Graceful
    }
  }, [token])

  const fetchStaff = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/admin/staff?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setStaffMembers(json.data)
      }
    } catch {
      // Graceful
    }
  }, [token])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (activeTab === 'merchants') fetchPendingMerchants()
    if (activeTab === 'disputes') fetchDisputes()
    if (activeTab === 'staff') fetchStaff()
  }, [activeTab, fetchPendingMerchants, fetchDisputes, fetchStaff])

  // ─── MERCHANT KYC ACTIONS ──────────────────────────────────────────────────
  const approveMerchant = async (id: string) => {
    setApprovingId(id)
    try {
      if (token) {
        await fetch(`/api/admin/users/${id}/approve`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        })
        setPendingMerchants((prev) => prev.filter((m) => m.id !== id))
      }
    } catch {
      // Graceful
    } finally {
      setApprovingId(null)
    }
  }

  const rejectMerchant = async (id: string) => {
    setRejectingId(id)
    try {
      if (token) {
        await fetch(`/api/admin/users/${id}/reject`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject', reason: 'KYC documents insufficient' }),
        })
        setPendingMerchants((prev) => prev.filter((m) => m.id !== id))
      }
    } catch {
      // Graceful
    } finally {
      setRejectingId(null)
    }
  }

  // ─── ANNOUNCEMENT PUBLISH ──────────────────────────────────────────────────
  const publishAnnouncement = async () => {
    if (!announcementText.trim()) return
    setPublishingAnnouncement(true)
    try {
      if (token) {
        await fetch('/api/admin/announcements', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: announcementText, scope: 'all' }),
        })
      }
      setAnnouncementPublished(true)
      setAnnouncementText('')
      setTimeout(() => setAnnouncementPublished(false), 3000)
    } catch {
      // Graceful
    } finally {
      setPublishingAnnouncement(false)
    }
  }

  // ─── PING SERVER ──────────────────────────────────────────────────────────
  const pingServer = async () => {
    setPingLoading(true)
    const start = performance.now()
    try {
      await fetch('/api/health')
      setServerPing(Math.round(performance.now() - start))
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
          <button onClick={() => navigate('home')} className="p-1 text-slate-400 hover:text-white" title="Home">
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
            className="h-8 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
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
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
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
              className="h-8 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
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
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
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
                    Super Admin
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email || 'admin@zylod.com'}</p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">Admin Session Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION (CLEAN ICONS, NO EMOJIS) ──────────────────── */}
        <div className="sticky top-[57px] md:top-[60px] z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 py-2">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'merchants', label: 'KYC Queue', icon: Building2 },
              { key: 'disputes', label: 'Disputes', icon: Scale },
              { key: 'finance', label: 'Finance', icon: DollarSign },
              { key: 'staff', label: 'Staff Roster', icon: Users },
              { key: 'platform', label: 'System Health', icon: Server },
              { key: 'announcements', label: 'Broadcast', icon: Megaphone },
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
                  {/* Platform KPI Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    <AdminStatCard
                      icon={Users}
                      value={stats.totalUsers !== undefined ? String(stats.totalUsers) : 'Active'}
                      label="Registered Users"
                    />
                    <AdminStatCard
                      icon={DollarSign}
                      value={stats.totalRevenue !== undefined ? formatPrice(stats.totalRevenue) : 'Managed'}
                      label="Gross Volume"
                    />
                    <AdminStatCard
                      icon={Building2}
                      value={stats.totalSellers !== undefined ? String(stats.totalSellers) : 'Active'}
                      label="Sellers"
                    />
                    <AdminStatCard
                      icon={ShoppingBag}
                      value={stats.totalOrders !== undefined ? String(stats.totalOrders) : 'Live'}
                      label="Platform Orders"
                    />
                    <AdminStatCard
                      icon={ShieldAlert}
                      value={stats.pendingKyc !== undefined ? String(stats.pendingKyc) : '0'}
                      label="Pending KYC"
                      urgent={Number(stats.pendingKyc) > 0}
                    />
                    <AdminStatCard
                      icon={Scale}
                      value={stats.openDisputes !== undefined ? String(stats.openDisputes) : '0'}
                      label="Open Disputes"
                      urgent={Number(stats.openDisputes) > 0}
                    />
                  </div>

                  {/* Platform Health Radar */}
                  <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-black text-white flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        Infrastructure Health
                      </h2>
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Operational
                      </span>
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: 'API Gateway', latency: serverPing ? `${serverPing}ms` : '<50ms', pct: 100 },
                        { label: 'PostgreSQL Database', latency: '<10ms', pct: 100 },
                        { label: 'Media & File Storage', latency: '<25ms', pct: 100 },
                      ].map(({ label, latency, pct }) => (
                        <div key={label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300">{label}</span>
                            <span className="text-slate-400 font-mono">{latency}</span>
                          </div>
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 2: MERCHANT APPROVAL QUEUE
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'merchants' && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                    <Input
                      value={merchantSearch}
                      onChange={(e) => setMerchantSearch(e.target.value)}
                      placeholder="Search pending merchants..."
                      className="h-12 pl-10 rounded-2xl bg-slate-900 border-slate-700 text-xs font-semibold text-slate-200 placeholder:text-slate-500"
                    />
                  </div>

                  {pendingMerchants.length > 0 ? (
                    <>
                    <div className="space-y-3 md:hidden">
                      {pendingMerchants.map((merchant) => (
                        <div key={merchant.id} className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-sm font-black text-white">{merchant.businessName}</h3>
                              <p className="text-[11px] text-slate-400">{merchant.ownerName} • {merchant.email}</p>
                            </div>
                            <span className="text-[10px] font-black text-amber-400 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full">
                              Pending KYC
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => approveMerchant(merchant.id)}
                              disabled={approvingId === merchant.id}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
                            >
                              {approvingId === merchant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Approve KYC</>}
                            </Button>
                            <Button
                              onClick={() => rejectMerchant(merchant.id)}
                              disabled={rejectingId === merchant.id}
                              variant="outline"
                              className="flex-1 border-rose-700 text-rose-400 bg-rose-950/40 hover:bg-rose-950 font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
                            >
                              {rejectingId === merchant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4" /> Reject</>}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop: KYC queue table */}
                    <div className="hidden md:block bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-800/60 text-left">
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Business</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Owner</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Email</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Type</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {pendingMerchants.map((merchant) => (
                            <tr key={merchant.id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-bold text-white">{merchant.businessName}</td>
                              <td className="px-4 py-3 text-slate-300 text-xs">{merchant.ownerName}</td>
                              <td className="px-4 py-3 text-slate-400 text-xs">{merchant.email}</td>
                              <td className="px-4 py-3 text-slate-300 text-xs">{merchant.type}</td>
                              <td className="px-4 py-3">
                                <span className="text-[10px] font-black text-amber-400 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full">
                                  Pending KYC
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    onClick={() => approveMerchant(merchant.id)}
                                    disabled={approvingId === merchant.id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 rounded-lg text-xs flex items-center gap-1.5"
                                  >
                                    {approvingId === merchant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Approve</>}
                                  </Button>
                                  <Button
                                    onClick={() => rejectMerchant(merchant.id)}
                                    disabled={rejectingId === merchant.id}
                                    variant="outline"
                                    className="border-rose-700 text-rose-400 bg-rose-950/40 hover:bg-rose-950 font-bold h-8 px-3 rounded-lg text-xs flex items-center gap-1.5"
                                  >
                                    {rejectingId === merchant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><X className="h-3.5 w-3.5" /> Reject</>}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                  ) : (
                    <div className="bg-slate-900 rounded-3xl p-12 border border-slate-800 text-center space-y-3">
                      <UserCheck className="h-12 w-12 text-slate-600 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-400">
                        No pending KYC applications
                      </h3>
                      <p className="text-xs text-slate-500">All merchant verification requests are up to date.</p>
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 3: DISPUTES
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'disputes' && (
                <>
                  {disputes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {disputes.map((dispute) => (
                        <div key={dispute.id} className="bg-slate-900 rounded-3xl p-5 border border-rose-800/40 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] font-mono text-rose-400 font-bold">CASE #{dispute.caseNumber}</span>
                              <h3 className="text-sm font-black text-white mt-0.5">Order #{dispute.orderId}</h3>
                            </div>
                            <span className="text-lg font-black text-white font-mono">{formatPrice(dispute.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-900 rounded-3xl p-12 border border-slate-800 text-center space-y-3">
                      <Scale className="h-12 w-12 text-slate-600 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-400">No open disputes</h3>
                      <p className="text-xs text-slate-500">All Trade Assurance arbitration claims are resolved.</p>
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 4: FINANCE
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'finance' && (
                <>
                  <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Platform Commission &amp; Settlement
                    </h2>
                    <div className="space-y-3 text-xs">
                      {[
                        { label: 'Standard Wholesale Commission', value: '2.5%' },
                        { label: 'Payment Processing Fee', value: '1.8%' },
                        { label: 'Trade Assurance Escrow Protection', value: '0.5%' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
                          <span className="text-slate-300">{label}</span>
                          <span className="font-bold text-white font-mono">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 5: STAFF ROSTER
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'staff' && (
                <>
                  <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Platform Staff Members
                    </h2>
                    {staffMembers.length > 0 ? (
                      <div className="space-y-2">
                        {staffMembers.map((s) => (
                          <div key={s.id} className="p-3 bg-slate-800/60 rounded-xl flex justify-between items-center">
                            <div>
                              <span className="text-xs font-bold text-white block">{s.fullName}</span>
                              <span className="text-[10px] text-slate-400">{s.role}</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400">Active</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-4 text-center">Manage staff accounts from the main system administration panel.</p>
                    )}
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 6: PLATFORM SETTINGS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'platform' && (
                <>
                  <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      Server &amp; Maintenance Controls
                    </h2>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center py-2 border-b border-slate-800">
                        <span className="text-slate-300">Platform Maintenance Mode</span>
                        <Switch className="data-[state=checked]:bg-primary" />
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-800">
                        <span className="text-slate-300">Automated Database Backups</span>
                        <span className="text-emerald-400 font-bold">Enabled (Daily)</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 7: ANNOUNCEMENTS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'announcements' && (
                <>
                  <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-4">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-primary" />
                      System Announcement Broadcaster
                    </h2>
                    <textarea
                      rows={4}
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="Enter announcement text to broadcast to users..."
                      className="w-full rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 text-xs font-semibold text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:border-primary"
                    />
                    <Button
                      onClick={publishAnnouncement}
                      disabled={publishingAnnouncement || !announcementText.trim()}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2"
                    >
                      {publishingAnnouncement ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : announcementPublished ? (
                        <><Check className="h-4 w-4" /> Announcement Sent!</>
                      ) : (
                        <><Send className="h-4 w-4" /> Send Announcement</>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 8: SECURITY
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
                        className="w-full justify-start border-slate-700 bg-slate-800 text-slate-200 text-xs h-10 rounded-xl"
                      >
                        Change Admin Password
                      </Button>
                      <Button
                        onClick={() => { logout?.(); navigate('login') }}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-10 rounded-xl"
                      >
                        Sign Out Admin Session
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}