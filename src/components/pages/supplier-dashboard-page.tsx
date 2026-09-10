'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  DollarSign, TrendingUp, Package, ShoppingCart, Clock, ChevronRight, AlertCircle,
  AlertTriangle, BarChart3, Users, MapPin, Star, PlusCircle, ClipboardList,
  Award, Store, MessageSquare, ShoppingBag,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Types ────────────────────────────────────────────────────
interface DashboardData {
  stats: {
    totalProducts: number
    totalOrders: number
    pendingOrders: number
    lowStockCount: number
    totalRevenueBDT: number
    thisMonthRevenue: number
    totalBuyers: number
  }
  supplier: { companyName: string; verificationStatus: string; ratingAvg: number; city: string }
  recentSubOrders: { id: string; orderNumber: string; date: string; status: string; totalAmount: number; itemCount: number; primaryItemName: string }[]
  topProducts: { id: string; name: string; basePrice: number; stockQuantity: number; soldCount: number; category: string }[]
  productPerformance: { id: string; name: string; sales: number; revenue: number; rating: number; category: string }[]
  inventoryAlerts: { id: string; name: string; currentStock: number; threshold: number; severity: string }[]
  monthlyRevenue: { month: string; revenue: number }[]
  pendingVerifications: { id: string; type: string; status: string; date: string }[]
  customerInsights: { newBuyers: number; repeatBuyers: number; topRegions: { region: string; orders: number; percentage: number }[] }
  storeStats: { messages: number; quotes: number }
}

// ─── Animated Counter Hook ────────────────────────────────────
function useAnimatedCounter(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  const ref = useRef<number>(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else { setCount(Math.floor(start)) }
    }, 16)
    ref.current = target
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'delivered': return 'bg-green-100 text-green-700 border-green-200'
    case 'shipped': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'confirmed': case 'packed': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'pending': return 'bg-red-100 text-red-700 border-red-200'
    case 'cancelled': case 'returned': return 'bg-gray-100 text-gray-700 border-gray-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'warning': return 'bg-amber-100 text-amber-700 border-amber-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const QUICK_ACTIONS = [
  { title: 'Add Product', description: 'List a new product in your catalog', icon: PlusCircle, page: 'supplier-add-product' },
  { title: 'Manage Orders', description: 'Process incoming orders', icon: ClipboardList, page: 'supplier-orders' },
  { title: 'View Analytics', description: 'Track sales performance', icon: BarChart3, page: 'supplier-analytics' },
  { title: 'Update Catalog', description: 'Edit product listings', icon: Package, page: 'supplier-products' },
]

// ─── Component ────────────────────────────────────────────────
export function SupplierDashboardPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/supplier/dashboard')
      .then(res => res.json())
      .then(json => { if (json.success) setData(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const revenueCards = data ? [
    { title: 'Total Revenue', value: data.stats.totalRevenueBDT, isCurrency: true, icon: DollarSign, color: 'text-primary', bg: 'bg-red-50' },
    { title: 'Pending Orders', value: data.stats.pendingOrders, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'This Month', value: data.stats.thisMonthRevenue, isCurrency: true, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Total Buyers', value: data.stats.totalBuyers, icon: Users, color: 'text-primary', bg: 'bg-red-50' },
  ] : []

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1280px] mx-auto space-y-6 px-4 py-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" className="h-auto p-0 text-muted-foreground hover:text-primary" onClick={() => navigate('home')}>Home</Button>
        <span>/</span>
        <span className="text-foreground font-medium">Supplier Dashboard</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Supplier Dashboard</h1>
          <p className="text-muted-foreground mt-1">{data?.supplier.companyName || 'Loading...'} • {data?.supplier.city || ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {data?.supplier.verificationStatus === 'approved' && (
            <Badge className="bg-primary hover:bg-[#C62828] text-white"><Star className="h-3 w-3 mr-1 fill-white" /> Verified Supplier</Badge>
          )}
          <Button className="bg-primary hover:bg-[#C62828] text-white gap-2" onClick={() => navigate('supplier-add-product')}>
            <PlusCircle className="h-4 w-4" /> Add New Product
          </Button>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          revenueCards.map((stat, index) => (
            <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-red-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">
                    {stat.isCurrency ? formatPrice(stat.value) : <AnimatedStat value={stat.value} />}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((action, index) => (
          <motion.div key={action.title} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + index * 0.05 }}>
            <Card className="hover:shadow-lg transition-all cursor-pointer group overflow-hidden" onClick={() => navigate(action.page)}>
              <CardContent className="p-5 relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#E53935] to-[#C62828] opacity-10 rounded-bl-[80px]" />
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#E53935] to-[#C62828] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-sm">{action.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                <div className="flex items-center gap-1 mt-3 text-primary text-xs font-medium group-hover:gap-2 transition-all">
                  <span>Go</span> <ChevronRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart & Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Revenue Trend</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('supplier-analytics')}>View Analytics</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-[240px]" />
            ) : (
              <>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#999" fontSize={12} />
                      <YAxis stroke="#999" fontSize={12} tickFormatter={(v) => formatPrice(v)} />
                      <Tooltip formatter={(value: number) => [formatPrice(value), 'Revenue']} contentStyle={{ borderRadius: '8px', border: '1px solid #E5393520' }} />
                      <Bar dataKey="revenue" fill="#E53935" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total 6-month revenue</span>
                  <span className="text-lg font-bold text-primary">{formatPrice(data?.stats.totalRevenueBDT || 0)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" /> Inventory Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : data?.inventoryAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">All products well stocked</p>
            ) : (
              data?.inventoryAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="p-3 rounded-lg border hover:bg-red-50/20 transition-colors cursor-pointer" onClick={() => navigate('product-detail', { productId: alert.id })}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm truncate flex-1">{alert.name}</p>
                    <Badge className={`text-xs border ${getSeverityColor(alert.severity)}`}>{alert.severity}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={alert.threshold > 0 ? Math.min(100, (alert.currentStock / alert.threshold) * 100) : 0} className="h-2" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.currentStock}/{alert.threshold}</span>
                  </div>
                </div>
              ))
            )}
            <Separator />
            <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-red-50" onClick={() => navigate('supplier-warehouse')}>Manage Inventory</Button>
          </CardContent>
        </Card>
      </div>

      {/* Order Management */}
      <Card className="border-red-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Recent Orders</CardTitle>
            <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('supplier-orders')}>View All Orders</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : data?.recentSubOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-red-50/50">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Order</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Product</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Items</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentSubOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-red-50/30 cursor-pointer transition-colors" onClick={() => navigate('order-detail', { orderId: order.id })}>
                      <td className="py-3 px-3 text-sm font-medium text-primary">{order.orderNumber}</td>
                      <td className="py-3 px-3 text-sm max-w-[200px] truncate">{order.primaryItemName}</td>
                      <td className="py-3 px-3 text-sm">{order.itemCount}</td>
                      <td className="py-3 px-3 text-sm font-semibold">{formatPrice(order.totalAmount)}</td>
                      <td className="py-3 px-3"><Badge className={`text-xs border ${getStatusColor(order.status)}`}>{order.status}</Badge></td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">{new Date(order.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Performance & Customer Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Top Products</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('supplier-products')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : data?.productPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No product performance data yet</p>
            ) : (
              data?.productPerformance.map((product, index) => (
                <motion.div key={product.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-red-50/20 transition-all cursor-pointer" onClick={() => navigate('product-detail', { productId: product.id })}>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#E53935] to-[#C62828] flex items-center justify-center shrink-0 text-white text-sm font-bold">#{index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category} • {product.sales} sold</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary">{formatPrice(product.revenue)}</p>
                    {product.rating > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{product.rating.toFixed(1)}</p>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Customer Insights</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 text-center">
                  <Users className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold"><AnimatedStat value={data?.customerInsights.newBuyers || 0} /></p>
                  <p className="text-xs text-muted-foreground mt-1">New Buyers</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 text-center">
                  <Award className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold"><AnimatedStat value={data?.customerInsights.repeatBuyers || 0} /></p>
                  <p className="text-xs text-muted-foreground mt-1">Repeat Buyers</p>
                </div>
              </div>
            )}
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-3">Top Buyer Regions</p>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>
              ) : data?.customerInsights.topRegions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No region data yet</p>
              ) : (
                <div className="space-y-2">
                  {data?.customerInsights.topRegions.map((region) => (
                    <div key={region.region} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" /> {region.region}</span>
                          <span className="text-xs text-muted-foreground">{region.percentage}%</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${region.percentage}%` }} transition={{ duration: 0.8 }} className="h-full bg-primary rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-red-50" onClick={() => navigate('supplier-insights')}>View Detailed Insights</Button>
          </CardContent>
        </Card>
      </div>

      {/* Pending Verifications & Store Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" /> Pending Verifications</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('supplier-verification-status')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : data?.pendingVerifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No pending verifications</p>
            ) : (
              data?.pendingVerifications.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-red-50/20 transition-colors cursor-pointer" onClick={() => navigate('supplier-verification-status')}>
                  <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Clock className="h-5 w-5 text-amber-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.type}</p>
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                  </div>
                  <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 border">{item.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Store Overview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : (
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200">
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#E53935] to-[#C62828] flex items-center justify-center"><Store className="h-7 w-7 text-white" /></div>
                  <div>
                    <p className="font-bold">{data?.supplier.companyName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {data?.supplier.city} • {(data?.supplier.ratingAvg ?? 0) > 0 && (<><Star className="h-3 w-3 text-amber-500 fill-amber-500" /> {data?.supplier.ratingAvg.toFixed(1)}</>)}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <Package className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold">{data?.stats.totalProducts ?? 0}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <MessageSquare className="h-4 w-4 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{data?.storeStats.messages ?? 0}</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <ShoppingBag className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{data?.storeStats.quotes ?? 0}</p>
                <p className="text-xs text-muted-foreground">Quotes</p>
              </div>
            </div>
            <Separator />
            <Button variant="outline" className="w-full border-primary text-primary hover:bg-red-50" onClick={() => navigate('supplier-profile')}>Edit Store Profile</Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

export default SupplierDashboardPage