'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useNavigationStore } from '@/store/navigation-store'
import { useCurrencyStore } from '@/store/currency-store'
import {
  ShoppingCart, Package, CreditCard, TrendingUp, Heart, Star, Clock,
  ArrowRight, MapPin, Award, BarChart3, Truck, Tag, Search, FileText,
  ChevronRight, Percent, Wallet,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Types ────────────────────────────────────────────────────
interface DashboardData {
  stats: { totalOrders: number; totalSpentBDT: number; activeOrders: number; wishlistCount: number; totalSavingsBDT: number }
  recentOrders: { id: string; orderNumber: string; date: string; status: string; paymentStatus: string; totalAmount: number; itemCount: number; summary: string; supplier: string; thumbnailUrl: string | null }[]
  spendingData: { month: string; amount: number }[]
  favoriteSuppliers: { id: string; name: string; location: string; rating: number; orderCount: number }[]
  wishlistItems: { id: string; productId: string; name: string; price: number; moq: number; supplier: string; thumbnailUrl: string | null }[]
  recentSearches: { id: string; query: string; date: string }[]
  couponSavings: number
  recentActivity: { type: string; text: string; time: string }[]
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

// Static navigation actions (no data)
const QUICK_ACTION_CARDS = [
  { title: 'Place New Order', description: 'Browse suppliers and place bulk orders', icon: ShoppingCart, page: 'suppliers' },
  { title: 'Request Quote', description: 'Get custom pricing from suppliers', icon: FileText, page: 'rfq-list' },
  { title: 'Browse Deals', description: 'Check daily deals & flash sales', icon: Tag, page: 'daily-deals' },
  { title: 'Track Orders', description: 'Monitor active deliveries', icon: Truck, page: 'buyer-orders' },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-700 border-green-200'
    case 'partial': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'unpaid': return 'bg-red-100 text-red-700 border-red-200'
    case 'refunded': return 'bg-gray-100 text-gray-700 border-gray-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

// ─── Component ────────────────────────────────────────────────
export default function BuyerDashboardPage() {
  const { navigate } = useNavigationStore()
  const { formatPrice } = useCurrencyStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/buyer/dashboard')
      .then(res => res.json())
      .then(json => { if (json.success) setData(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const stats = data ? [
    { title: 'Total Orders', value: data.stats.totalOrders, icon: ShoppingCart, color: 'text-primary', bg: 'bg-red-50' },
    { title: 'Total Spent', value: data.stats.totalSpentBDT, isCurrency: true, icon: CreditCard, color: 'text-primary', bg: 'bg-red-50' },
    { title: 'Pending Deliveries', value: data.stats.activeOrders, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Saved Amount', value: data.stats.totalSavingsBDT, isCurrency: true, icon: Percent, color: 'text-green-600', bg: 'bg-green-50' },
  ] : []

  const activityIcon = (type: string) => {
    if (type === 'order') return { Icon: ShoppingCart, color: 'text-primary', bg: 'bg-red-50' }
    if (type === 'wishlist') return { Icon: Heart, color: 'text-primary', bg: 'bg-red-50' }
    return { Icon: Clock, color: 'text-muted-foreground', bg: 'bg-gray-50' }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1280px] mx-auto space-y-6 px-4 py-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" className="h-auto p-0 text-muted-foreground hover:text-primary" onClick={() => navigate('home')}>Home</Button>
        <span>/</span>
        <span className="text-foreground font-medium">Buyer Dashboard</span>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buyer Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back to your wholesale command center</p>
        </div>
        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('buyer-settings')}>Settings</Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          stats.map((stat, index) => (
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
        {QUICK_ACTION_CARDS.map((action, index) => (
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

      {/* Spending Overview & Savings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Monthly Spending</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('buyer-credit')}>View Details</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px]" />
            ) : (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.spendingData ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#999" fontSize={12} />
                      <YAxis stroke="#999" fontSize={12} tickFormatter={(v) => formatPrice(v)} />
                      <Tooltip formatter={(value: number) => [formatPrice(value), 'Spending']} contentStyle={{ borderRadius: '8px', border: '1px solid #E5393520' }} />
                      <Bar dataKey="amount" fill="#E53935" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total 6-month spending</span>
                  <span className="text-lg font-bold text-primary">{formatPrice(data?.stats.totalSpentBDT ?? 0)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Savings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : (
              <div className="text-center mb-4 p-4 bg-gradient-to-br from-red-50 to-green-50 rounded-xl">
                <p className="text-xs text-muted-foreground">Total Coupon Savings</p>
                <p className="text-3xl font-bold text-green-600">
                  <AnimatedStat value={data?.stats.totalSavingsBDT ?? 0} isCurrency />
                </p>
                <p className="text-xs text-muted-foreground mt-1">{data?.couponSavings ?? 0} coupons redeemed</p>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-red-50" onClick={() => navigate('coupons')}>
              View All Coupons & Deals
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="border-red-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Recent Orders</CardTitle>
            <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('buyer-orders')}>View All Orders</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : data?.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-red-50/50">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Order</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Supplier</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Product</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-red-50/30 cursor-pointer transition-colors" onClick={() => navigate('order-detail', { orderId: order.id })}>
                      <td className="py-3 px-3 text-sm font-medium text-primary">{order.orderNumber}</td>
                      <td className="py-3 px-3 text-sm">{order.supplier}</td>
                      <td className="py-3 px-3 text-sm max-w-[200px] truncate">{order.summary}</td>
                      <td className="py-3 px-3 text-sm font-medium">{formatPrice(order.totalAmount)}</td>
                      <td className="py-3 px-3">
                        <Badge className={`text-xs border ${getStatusColor(order.paymentStatus)}`}>{order.paymentStatus}</Badge>
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">{new Date(order.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Favorite Suppliers & Wishlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> Favorite Suppliers</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('buyer-favorites')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : data?.favoriteSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No suppliers yet. Place an order to build favorites.</p>
            ) : (
              data?.favoriteSuppliers.map((supplier) => (
                <motion.div
                  key={supplier.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-red-50/20 transition-all cursor-pointer"
                  onClick={() => navigate('seller-storefront', { supplierId: supplier.id })}
                >
                  <Avatar className="h-10 w-10 bg-gradient-to-br from-[#E53935] to-[#C62828]">
                    <AvatarFallback className="text-white text-sm font-bold">{supplier.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{supplier.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {supplier.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-semibold">{supplier.rating.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{supplier.orderCount} orders</p>
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-primary" /> Wishlist</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('buyer-wishlist')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : data?.wishlistItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Your wishlist is empty</p>
            ) : (
              data?.wishlistItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-red-50/20 transition-all cursor-pointer"
                  onClick={() => navigate('product-detail', { productId: item.productId })}
                >
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl} alt={item.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><Heart className="h-5 w-5 text-primary" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.supplier} • MOQ: {item.moq}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{formatPrice(item.price)}</span>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Searches & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Recent Searches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
            ) : data?.recentSearches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent searches</p>
            ) : (
              <>
                {data?.recentSearches.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-red-50/30 cursor-pointer transition-colors"
                    onClick={() => navigate('search-results', { query: s.query })}
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{s.query}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                ))}
                <Separator className="my-2" />
                <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-red-50" onClick={() => navigate('search-results')}>
                  Search More Products
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Recent Activity</CardTitle>
              <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-red-50" onClick={() => navigate('buyer-orders')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : data?.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {data?.recentActivity.map((activity, i) => {
                  const { Icon, color, bg } = activityIcon(activity.type)
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className={`h-8 w-8 rounded-full ${bg} flex items-center justify-center shrink-0`}><Icon className={`h-4 w-4 ${color}`} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.text}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(activity.time)}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}