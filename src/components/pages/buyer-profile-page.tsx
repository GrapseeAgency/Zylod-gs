'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  User, ShoppingBag, DollarSign, Wallet, Truck,
  Star, ShieldCheck, Scale, FileText, Bookmark, Clock,
  ChevronRight, Settings, Edit3, CheckCircle2, ArrowUpRight,
  CreditCard, Package, RefreshCw, BarChart3, Boxes, Building2,
  Search, Filter, MapPin, Phone, Mail, Globe, Calendar,
  TrendingUp, TrendingDown, AlertTriangle, CheckSquare, Activity,
  Heart, BookOpen, Layers, Archive, ArrowLeft, Plus, Minus,
  Download, Share2, Send, Eye, History, Receipt, Landmark,
  HelpCircle, ChevronDown, ChevronUp, Lock, Bell, Camera,
  Award, Banknote, Hash, Info, FileCheck2, UserCheck, Loader2,
  Check, X, Zap, Shield, Radio, HardHat, Factory, MessageSquare,
  ClipboardCheck, ShoppingCart, Wrench
} from 'lucide-react'

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────
interface Order {
  id: string
  orderNumber: string
  placedAt: string
  totalAmount: number
  status: string
  itemsCount: number
  supplierName?: string
}

interface SavedSupplier {
  id: string
  name: string
  category?: string
  rating?: number
  verificationStatus?: string
}

interface TradeCredit {
  limit: number
  used: number
  available: number
  tier: string
}

// ─── STAT MINI CARD ───────────────────────────────────────────────────────────
function StatMiniCard({
  icon: Icon,
  value,
  label,
  badge,
  trend,
  color = 'primary',
}: {
  icon: React.ElementType
  value: string
  label: string
  badge?: string
  trend?: { value: string; up: boolean }
  color?: string
}) {
  const iconColorMap: Record<string, string> = {
    primary: 'bg-rose-50 text-primary border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3">
      <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${iconColorMap[color] || iconColorMap.primary}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-black text-slate-900 font-mono leading-none">{value}</div>
        {trend && (
          <div className={`flex items-center gap-1 mt-0.5 text-[10px] font-bold ${trend.up ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
        <span className="text-[11px] font-bold text-slate-400 block mt-1 uppercase tracking-wider">{label}</span>
        {badge && (
          <span className="text-[10px] font-bold text-primary bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full mt-1 inline-block">
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── ORDER STATUS BADGE ─────────────────────────────────────────────────────
function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    delivered: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    shipped: { label: 'In Transit', className: 'bg-sky-50 text-sky-700 border-sky-100' },
    processing: { label: 'Processing', className: 'bg-amber-50 text-amber-700 border-amber-100' },
    pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    cancelled: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700 border-rose-100' },
    returned: { label: 'Returned', className: 'bg-violet-50 text-violet-700 border-violet-100' },
  }
  const s = map[status.toLowerCase()] || map.pending
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${s.className}`}>
      {s.label}
    </span>
  )
}

// ─── MAIN BUYER PROFILE COMPONENT ─────────────────────────────────────────────
export function BuyerProfilePage() {
  const { navigate } = useNavigationStore()
  const { user, token, updateUser } = useAuthStore()
  const { formatPrice } = useCurrencyStore()

  // Tab state
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'orders' | 'sourcing' | 'suppliers' | 'credit' | 'wishlist' | 'compliance' | 'settings'
  >('dashboard')

  // Profile Data
  const [profileData, setProfileData] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [savedSuppliers, setSavedSuppliers] = useState<SavedSupplier[]>([])
  const [tradeCredit, setTradeCredit] = useState<TradeCredit | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)

  // Uploading avatar
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null)

  // UI
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatus, setOrderStatus] = useState('all')

  // ─── FETCH ──────────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/profile/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setProfileData(json.data)
          setAvatarUrl(json.data.avatarUrl || null)
        }
      }
    } catch {
      // Graceful
    }
  }, [token])

  const fetchOrders = useCallback(async () => {
    if (!token) return
    setLoadingOrders(true)
    try {
      const params = new URLSearchParams({
        limit: '20',
        ...(orderStatus !== 'all' ? { status: orderStatus } : {}),
        ...(orderSearch ? { q: orderSearch } : {}),
      })
      const res = await fetch(`/api/orders/my-orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setOrders(json.data)
      }
    } catch {
      // Graceful
    } finally {
      setLoadingOrders(false)
    }
  }, [token, orderStatus, orderSearch])

  const fetchSavedSuppliers = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/suppliers?savedOnly=true&limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) setSavedSuppliers(json.data)
      }
    } catch {
      // Graceful
    }
  }, [token])

  const fetchTradeCredit = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/profile/credits', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setTradeCredit(json.data || null)
      }
    } catch {
      // Graceful
    }
  }, [token])

  useEffect(() => {
    fetchProfile()
    fetchOrders()
    fetchSavedSuppliers()
    fetchTradeCredit()
  }, [fetchProfile, fetchOrders, fetchSavedSuppliers, fetchTradeCredit])

  // Avatar Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)

      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (res.ok) {
        const json = await res.json()
        if (json.data?.avatarUrl) {
          setAvatarUrl(json.data.avatarUrl)
          if (updateUser) {
            updateUser({ avatarUrl: json.data.avatarUrl })
          }
        }
      }
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const buyerName = profileData?.buyerProfile?.businessName || profileData?.buyerProfile?.fullName || user?.fullName || 'Wholesale Buyer'
  const creditUsed = tradeCredit?.used ?? 0
  const creditLimit = tradeCredit?.limit ?? 0
  const creditAvailable = tradeCredit?.available ?? 0
  const creditPct = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0
  const totalOrdersCount = profileData?.stats?.totalOrders ?? orders.length

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 md:pb-8">
      {/* Hidden file input for avatar upload */}
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('home')} className="p-1 text-slate-700" title="Home">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-lg font-black tracking-tight text-primary">Zylod</span>
            <span className="text-[9px] font-bold text-slate-400 block -mt-0.5 uppercase tracking-widest">
              Buyer Portal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('notification-preferences')}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 relative"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('account-settings')}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto lg:max-w-5xl">
        {/* ─── BUYER HERO IDENTITY CARD ──────────────────────────────── */}
        <div className="bg-white border-b border-slate-200">
          <div className="h-28 md:h-36 bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 relative overflow-hidden">
            <div className="absolute top-3 left-3">
              <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Verified Trade Account
              </span>
            </div>
          </div>

          <div className="px-4 pb-4 -mt-10 space-y-4">
            <div className="flex items-end justify-between">
              {/* Avatar */}
              <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden ring-2 ring-rose-100 flex items-center justify-center bg-slate-100">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={buyerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white text-xs font-bold"
                >
                  {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('edit-profile')}
                  className="h-8 px-3 rounded-xl text-xs font-bold text-slate-700 border-slate-200 flex items-center gap-1.5 hover:border-primary hover:text-primary"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Profile
                </Button>
                <Button
                  onClick={() => navigate('wholesale-catalog')}
                  className="h-8 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-xs flex items-center gap-1.5"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Browse Catalog
                </Button>
              </div>
            </div>

            {/* Identity */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{buyerName}</h1>
                <span className="bg-rose-50 text-primary border border-rose-100 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  Wholesale Buyer
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {profileData?.email || user?.email || 'Active Account'}
              </p>
            </div>

            {/* Meta chips */}
            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5 font-semibold">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Bangladesh
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <strong className="text-primary">{totalOrdersCount}</strong> Orders Placed
              </span>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION (CLEAN ICONS, NO EMOJIS) ───────────────── */}
        <div className="sticky top-[57px] z-30 bg-white border-b border-slate-100 shadow-xs">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-3 py-2">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'orders', label: 'My Orders', icon: Package },
              { key: 'sourcing', label: 'Sourcing Hub', icon: Search },
              { key: 'suppliers', label: 'Saved Factories', icon: Building2 },
              { key: 'credit', label: 'Trade Credit', icon: CreditCard },
              { key: 'wishlist', label: 'Wishlist', icon: Heart },
              { key: 'compliance', label: 'Documents', icon: FileCheck2 },
              { key: 'settings', label: 'Settings', icon: Settings },
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
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
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
                  TAB 1: DASHBOARD
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'dashboard' && (
                <>
                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatMiniCard
                      icon={ShoppingBag}
                      value={String(totalOrdersCount)}
                      label="Total Orders"
                      color="primary"
                    />
                    <StatMiniCard
                      icon={Building2}
                      value={String(savedSuppliers.length)}
                      label="Saved Factories"
                      color="sky"
                    />
                    <StatMiniCard
                      icon={CreditCard}
                      value={creditLimit > 0 ? formatPrice(creditAvailable) : 'Active'}
                      label="Trade Credit"
                      color="emerald"
                    />
                    <StatMiniCard
                      icon={ShieldCheck}
                      value="Protected"
                      label="Trade Assurance"
                      color="violet"
                    />
                  </div>

                  {/* Procurement Quick Actions */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Procurement Quick Actions
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                      {[
                        { icon: ShoppingBag, label: 'Wholesale Catalog', sub: 'Verified products', page: 'wholesale-catalog', color: 'primary' },
                        { icon: Truck, label: 'Track Orders', sub: 'Shipment status', page: 'orders', color: 'sky' },
                        { icon: Scale, label: 'Dispute Center', sub: 'Trade protection', page: 'dispute-center', color: 'amber' },
                        { icon: Receipt, label: 'Invoices', sub: 'Order billing', page: 'order-invoice', color: 'emerald' },
                        { icon: FileCheck2, label: 'Return Request', sub: 'RMA support', page: 'return-request', color: 'violet' },
                        { icon: Building2, label: 'Factory Directory', sub: 'Verified suppliers', page: 'wholesale-catalog', color: 'slate' },
                      ].map(({ icon: Icon, label, sub, page, color }) => {
                        const colorMap: Record<string, string> = {
                          primary: 'text-primary border-rose-100 bg-rose-50',
                          sky: 'text-sky-600 border-sky-100 bg-sky-50',
                          amber: 'text-amber-600 border-amber-100 bg-amber-50',
                          emerald: 'text-emerald-600 border-emerald-100 bg-emerald-50',
                          violet: 'text-violet-600 border-violet-100 bg-violet-50',
                          slate: 'text-slate-600 border-slate-200 bg-slate-100',
                        }

                        return (
                          <button
                            key={label}
                            onClick={() => navigate(page)}
                            className="p-3.5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-100 hover:border-slate-200 text-left space-y-1 transition-all group hover:shadow-xs"
                          >
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${colorMap[color]}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-900 group-hover:text-primary leading-snug">{label}</h3>
                            <p className="text-[10px] text-slate-400">{sub}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 2: MY ORDERS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'orders' && (
                <>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search orders..."
                        className="h-12 pl-10 rounded-2xl bg-white border-slate-200 text-xs font-semibold shadow-2xs"
                      />
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setOrderStatus(s)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap capitalize transition-colors ${
                            orderStatus === s
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {s === 'all' ? 'All Orders' : s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingOrders ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-3xl p-5 border border-slate-200 animate-pulse space-y-3">
                          <div className="h-4 bg-slate-100 rounded w-2/3" />
                          <div className="h-3 bg-slate-100 rounded w-1/3" />
                        </div>
                      ))}
                    </div>
                  ) : orders.length > 0 ? (
                    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3 text-left"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-sm font-black text-slate-900">
                                #{order.orderNumber}
                              </h3>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {order.supplierName || 'Supplier'} • {order.itemsCount || 1} items
                              </p>
                            </div>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-mono">
                              {new Date(order.placedAt).toLocaleDateString()}
                            </span>
                            <span className="font-black text-slate-900">{formatPrice(order.totalAmount)}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                            <Button
                              onClick={() => navigate('track-order', { orderId: order.id })}
                              className="flex-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-primary font-bold h-8 rounded-xl text-[11px]"
                            >
                              Track
                            </Button>
                            <Button
                              onClick={() => navigate('order-invoice-download', { orderId: order.id })}
                              className="flex-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-primary font-bold h-8 rounded-xl text-[11px]"
                            >
                              Invoice
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
                      <Package className="h-12 w-12 text-slate-200 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-400">No orders found</h3>
                      <Button onClick={() => navigate('wholesale-catalog')} className="bg-primary text-white font-bold h-10 rounded-xl text-xs px-6">
                        Browse Wholesale Catalog
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 3: SOURCING HUB
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'sourcing' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Search className="h-4 w-4 text-primary" />
                      Browse by Industry Category
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                      {[
                        { label: 'Industrial Machinery & Parts', icon: Wrench },
                        { label: 'Textiles & Apparel', icon: Package },
                        { label: 'Electronics & Electrical', icon: Zap },
                        { label: 'Construction Materials', icon: HardHat },
                        { label: 'Plastics & Packaging', icon: Boxes },
                        { label: 'Chemicals & Raw Materials', icon: Activity },
                      ].map(({ label, icon: Icon }) => (
                        <button
                          key={label}
                          onClick={() => navigate('wholesale-catalog')}
                          className="p-3.5 bg-slate-50 hover:bg-rose-50 rounded-2xl border border-slate-100 text-left space-y-1.5 transition-all group"
                        >
                          <Icon className="h-5 w-5 text-primary" />
                          <h3 className="text-xs font-bold text-slate-900 group-hover:text-primary leading-snug">{label}</h3>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 4: SAVED SUPPLIERS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'suppliers' && (
                <>
                  {savedSuppliers.length > 0 ? (
                    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                      {savedSuppliers.map((sup) => (
                        <div key={sup.id} className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black text-sm shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-xs font-black text-slate-900">{sup.name}</h3>
                              <p className="text-[10px] text-slate-400">{sup.category || 'Manufacturer'}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => navigate('delivery-chat')}
                            className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3">
                      <Building2 className="h-12 w-12 text-slate-200 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-400">No saved factories yet</h3>
                      <p className="text-xs text-slate-400">Follow supplier stores to build your shortlist.</p>
                      <Button onClick={() => navigate('wholesale-catalog')} className="bg-primary text-white font-bold h-10 rounded-xl text-xs px-6">
                        Browse Verified Factories
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 5: TRADE CREDIT
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'credit' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Trade Credit Facility
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Zylod Trade Credit enables verified wholesale buyers to place bulk orders with flexible payment terms (Net-30 / Net-60) after credit verification.
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Credit Status</span>
                        <span className="font-bold text-emerald-600">Active Trade Account</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Payment Security</span>
                        <span className="font-bold text-slate-800">Trade Assurance Protected</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 6: WISHLIST
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'wishlist' && (
                <>
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xs text-center space-y-3">
                    <Heart className="h-10 w-10 text-slate-200 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-400">Wishlist is empty</h3>
                    <p className="text-xs text-slate-400">Save products to quickly reorder or monitor wholesale price updates.</p>
                    <Button onClick={() => navigate('wholesale-catalog')} className="bg-primary text-white font-bold h-10 rounded-xl text-xs px-6">
                      Explore Products
                    </Button>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 7: COMPLIANCE & DOCUMENTS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'compliance' && (
                <>
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-primary" />
                      Trade &amp; Customs Documents
                    </h2>
                    <div className="space-y-2">
                      {[
                        { title: 'Commercial Invoices', page: 'order-invoice' },
                        { title: 'Customs Clearance Status', page: 'customs-clearance' },
                        { title: 'Import / Export Tracker', page: 'import-export-tracker' },
                      ].map(({ title, page }) => (
                        <button
                          key={title}
                          onClick={() => navigate(page)}
                          className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 text-left text-xs font-bold text-slate-800"
                        >
                          <span>{title}</span>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  TAB 8: ACCOUNT SETTINGS
              ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'settings' && (
                <>
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                    <button
                      onClick={() => navigate('account-settings')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <Settings className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-slate-900">Manage All Settings</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                    <button
                      onClick={() => navigate('notification-preferences')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-slate-900">Notification Preferences</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                    <button
                      onClick={() => navigate('chat-list')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-slate-900">Messages</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
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
