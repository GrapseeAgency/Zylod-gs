'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  LayoutDashboard, DollarSign, Users, Clock, ShoppingCart, TrendingUp, Package,
  ChevronRight, AlertCircle, BarChart3, Server, Database, Wifi, AlertTriangle,
  UserPlus, Star, MapPin, ArrowRight, ShieldAlert,
} from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ─── Types ────────────────────────────────────────────────────
interface DashboardData {
  platformOverview: {
    totalUsers: number
    activeSuppliers: number
    totalOrders: number
    totalRevenueBDT: number
    avgOrderValue: number
    totalProducts: number
    pendingApprovalsCount: number
    systemStatus: string
  }
  pendingApprovals: { supplierVerification: number; productApproval: number; total: number }
  recentActivity: { type: string; text: string; time: string }[]
  recentUsers: { id: string; label: string; userType: string; createdAt: string }[]
  recentOrders: { id: string; orderNumber: string; totalAmount: number; status: string; placedAt: string }[]
  growthData: { month: string; registrations: number; orders: number; revenue: number }[]
  registrationsChart: { day: string; value: number }[]
  orderVolumeChart: { day: string; value: number }[]
  revenueChart: { day: string; value: number }[]
  categoryBreakdown: { category: string; products: number }[]
  topRegions: { region: string; users: number; percentage: number }[]
}

// ─── Animated Counter ─────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else { setCount(Math.floor(start)) }
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return count
}

function AnimatedStat({ value, isCurrency = false }: { value: number; isCurrency?: boolean }) {
  const animated = useAnimatedCounter(value)
  const { formatPrice } = useCurrencyStore()
  if (isCurrency) return <span>{formatPrice(value)}</span>
  return <span>{animated.toLocaleString('en-BD')}</span>
}

// ─── Time formatter ───────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

// ─── Static action nav (no data, just navigation targets) ─────
const QUICK_ADMIN_ACTIONS = [
  { title: 'Manage Users', description: 'View & manage all platform users', icon: Users, page: 'admin-users', badgeKey: null as string | null },
  { title: 'Review Products', description: 'Approve & moderate products', icon: Package, page: 'admin-products', badgeKey: 'productApproval' as string | null },
  { title: 'Verify Suppliers', description: 'Review supplier applications', icon: TrendingUp, page: 'admin-suppliers', badgeKey: 'supplierVerification' as string | null },
  { title: 'Trust & Safety Reports', description: 'Review buyer/seller fraud & violations', icon: ShieldAlert, page: 'admin-reports', badgeKey: null as string | null },
]

// ─── Component ────────────────────────────────────────────────
export function AdminDashboardPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(res => res.json())
      .then(json => { if (json.success) setData(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const kpiCards = data ? [
    { title: 'Total Users', value: data.platformOverview.totalUsers, icon: Users, chartData: data.registrationsChart, chartType: 'line' as const },
    { title: 'Active Suppliers', value: data.platformOverview.activeSuppliers, icon: TrendingUp, chartData: data.orderVolumeChart, chartType: 'bar' as const },
    { title: 'Total Orders', value: data.platformOverview.totalOrders, icon: ShoppingCart, chartData: data.orderVolumeChart, chartType: 'line' as const },
    { title: 'Platform Revenue', value: data.platformOverview.totalRevenueBDT, isCurrency: true, icon: DollarSign, chartData: data.revenueChart, chartType: 'bar' as const },
    { title: 'Avg. Order Value', value: data.platformOverview.avgOrderValue, isCurrency: true, icon: BarChart3, chartData: data.revenueChart, chartType: 'line' as const },
  ] : []

  const activityIcon = (type: string) => {
    if (type === 'registration') return { Icon: UserPlus, color: 'text-green-600', bg: 'bg-green-50' }
    if (type === 'order') return { Icon: ShoppingCart, color: 'text-primary', bg: 'bg-red-50' }
    return { Icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1280px] mx-auto space-y-6 px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('home')} className="text-muted-foreground hover:text-primary">
            <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Home
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Platform overview & management</p>
          </div>
        </div>
        <Badge className="bg-primary hover:bg-[#C62828] text-white">Admin Panel</Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)
        ) : (
          kpiCards.map((kpi, index) => (
            <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="overflow-hidden border-red-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs font-medium">{kpi.title}</CardDescription>
                    <div className="bg-red-50 rounded-md p-1.5"><kpi.icon className="h-4 w-4 text-primary" /></div>
                  </div>
                  <CardTitle className="text-2xl font-bold tabular-nums">
                    <AnimatedStat value={kpi.value} isCurrency={kpi.isCurrency} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-2 pt-0">
                  <div className="h-[40px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {kpi.chartType === 'line' ? (
                        <LineChart data={kpi.chartData}>
                          <Line type="monotone" dataKey="value" stroke="#E53935" strokeWidth={2} dot={false} />
                        </LineChart>
                      ) : (
                        <BarChart data={kpi.chartData}>
                          <Bar dataKey="value" fill="#E53935" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick Admin Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ADMIN_ACTIONS.map((action, index) => {
          const badgeVal = action.badgeKey ? data?.pendingApprovals[action.badgeKey as keyof typeof data.pendingApprovals] : null
          return (
            <motion.div key={action.title} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + index * 0.05 }}>
              <Card className="hover:shadow-lg transition-all cursor-pointer group overflow-hidden" onClick={() => navigate(action.page)}>
                <CardContent className="p-5 relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#E53935] to-[#C62828] opacity-10 rounded-bl-[80px]" />
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#E53935] to-[#C62828] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm">{action.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                  {badgeVal != null && badgeVal > 0 && (
                    <Badge className="mt-2 text-xs bg-primary text-white">{badgeVal} pending</Badge>
                  )}
                  <div className="flex items-center gap-1 mt-3 text-primary text-xs font-medium group-hover:gap-2 transition-all">
                    <span>Go</span> <ChevronRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Growth Metrics */}
      <Card className="border-red-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Growth Metrics — Last 6 Months</CardTitle>
            <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('admin-analytics')}>View Full Analytics</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-[160px]" /><Skeleton className="h-[160px]" /><Skeleton className="h-[160px]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Monthly Registrations</p>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.growthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#999" fontSize={11} />
                      <YAxis stroke="#999" fontSize={11} />
                      <Tooltip formatter={(value: number) => [value, 'New Users']} contentStyle={{ borderRadius: '8px' }} />
                      <Bar dataKey="registrations" fill="#E53935" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Order Volume</p>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data!.growthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#999" fontSize={11} />
                      <YAxis stroke="#999" fontSize={11} />
                      <Tooltip formatter={(value: number) => [value, 'Orders']} contentStyle={{ borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="orders" stroke="#E53935" strokeWidth={2} dot={{ fill: '#E53935', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Revenue Trends</p>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.growthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#999" fontSize={11} />
                      <YAxis stroke="#999" fontSize={11} tickFormatter={(v) => formatPrice(v)} />
                      <Tooltip formatter={(value: number) => [formatPrice(value), 'Revenue']} contentStyle={{ borderRadius: '8px' }} />
                      <Bar dataKey="revenue" fill="#E53935" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity + Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : data?.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {data?.recentActivity.map((activity, i) => {
                  const { Icon, color, bg } = activityIcon(activity.type)
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50/50 hover:bg-red-50/20 transition-colors">
                      <div className={`h-9 w-9 rounded-full ${bg} flex items-center justify-center shrink-0`}><Icon className={`h-4 w-4 ${color}`} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(activity.time)}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" /> Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Supplier Verification</p>
                    <Badge className="bg-primary text-white text-xs">{data?.pendingApprovals.supplierVerification || 0} pending</Badge>
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-red-50 text-xs" onClick={() => navigate('admin-suppliers')}>
                    Review All
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Product Approval</p>
                    <Badge className="bg-primary text-white text-xs">{data?.pendingApprovals.productApproval || 0} pending</Badge>
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-red-50 text-xs" onClick={() => navigate('admin-products')}>
                    Review All
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Regions + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Regions */}
        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Active Regions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8" />)}</div>
            ) : data?.topRegions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No region data yet</p>
            ) : (
              data?.topRegions.map((region) => (
                <div key={region.region} className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium w-24 shrink-0">{region.region}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${region.percentage}%` }} transition={{ duration: 0.8 }} className="h-full bg-primary rounded-full" />
                  </div>
                  <span className="text-sm font-semibold text-primary w-16 text-right">{region.users.toLocaleString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-primary" /> Category Breakdown</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('admin-categories')}>Manage</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : data?.categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No category data yet</p>
            ) : (
              data?.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-red-50/20 transition-colors cursor-pointer" onClick={() => navigate('admin-categories')}>
                  <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.category}</p>
                    <p className="text-xs text-muted-foreground">{cat.products} products</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

export default AdminDashboardPage