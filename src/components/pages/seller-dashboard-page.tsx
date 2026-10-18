'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { 
  Package, ShoppingCart, AlertTriangle, DollarSign, MessageCircle, 
  Plus, Truck, Store, BarChart3, ChevronRight, LayoutList, Users, PackageSearch
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/* Data comes from the REAL GET /api/supplier/dashboard (per-supplier stats,
 * monthly revenue, recent sub-orders). Every number is a real aggregate —
 * zeros are real zeros, and a 401/403 shows an honest sign-in state. */

interface DashboardData {
  stats: {
    totalProducts: number;
    totalOrders: number;
    pendingOrders: number;
    lowStockCount: number;
    totalRevenueBDT: number;
    pendingPaymentBDT: number;
    thisMonthRevenue: number;
    totalBuyers: number;
  };
  supplier: { companyName: string; verificationStatus: string; ratingAvg: number };
  recentSubOrders: Array<{
    id: string;
    orderNumber: string;
    date: string;
    status: string;
    totalAmount: number;
    itemCount: number;
    primaryItemName: string;
  }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  storeStats: { messages: number; quotes: number };
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  packed: 'bg-blue-50 text-blue-700 border-blue-200',
  shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  returned: 'bg-red-50 text-red-700 border-red-200',
};

export const SellerDashboardPage = () => {
  const { navigate } = useNavigationStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/supplier/dashboard');
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setData(json.data);
          setError('');
        } else {
          setError(json.error || 'Could not load your dashboard');
          if (res.status === 401) setAuthRequired(true);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Could not reach the seller service');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const stats = [
    { label: "Paid Revenue (all time)", value: data ? `৳${data.stats.totalRevenueBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '0', icon: DollarSign, color: "text-green-600" },
    { label: "Awaiting Payment", value: data ? `৳${data.stats.pendingPaymentBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '0', icon: AlertTriangle, color: "text-orange-600" },
    { label: "Pending Orders", value: data ? data.stats.pendingOrders : 0, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Low Stock Alerts", value: data ? data.stats.lowStockCount : 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Unread Messages", value: data ? data.storeStats.messages : 0, icon: MessageCircle, color: "text-yellow-600" },
  ];

  /* Quick actions point ONLY at real, rendered pages. */
  const quickActions = [
    { icon: Plus, label: 'Add Product', page: 'seller-add-product' },
    { icon: Truck, label: 'Orders', page: 'seller-orders' },
    { icon: PackageSearch, label: 'Inventory', page: 'inventory-management' },
    { icon: LayoutList, label: 'Listings', page: 'product-listings-manager' },
    { icon: Store, label: 'Store', page: 'seller-storefront' },
    { icon: BarChart3, label: 'Analytics', page: 'seller-analytics' },
  ];

  const maxRevenue = data?.monthlyRevenue?.reduce((m, r) => Math.max(m, r.revenue), 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 dark:bg-gray-900">
      <header className="bg-white px-4 py-4 shadow-sm dark:bg-gray-800 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Seller Hub</h1>
          <p className="text-sm text-gray-500">
            {data ? `Welcome back, ${data.supplier.companyName}` : 'Welcome back to Zylod Marketplace'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('seller-verification')}>
          Verification
        </Button>
      </header>

      <main className="p-4 space-y-6 md:max-w-5xl md:mx-auto">
        {/* Quick Actions — all targets are real, rendered pages */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.page}
              onClick={() => navigate(action.page)}
              className="flex flex-col items-center justify-center gap-2 p-3 min-h-[72px] bg-white dark:bg-gray-800 rounded-xl shadow-sm active:scale-95 transition-transform"
            >
              <div className="text-primary">
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
            </button>
          ))}
        </div>

        {authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Users className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Supplier sign-in required</h2>
              <p className="text-xs text-gray-500">Sign in with a supplier account to see your live dashboard.</p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : (
          <>
            {/* Overview Metrics — real aggregates */}
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, idx) => (
                <Card key={idx} className="border-none shadow-sm dark:bg-gray-800">
                  <CardContent className="p-4 flex flex-col items-start gap-2">
                    <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-700 ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      {loading ? (
                        <Skeleton className="h-6 w-16 mb-1" />
                      ) : (
                        <div className="text-2xl font-bold dark:text-white">{stat.value}</div>
                      )}
                      <div className="text-xs text-gray-500 font-medium">{stat.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Revenue Trend — real monthly revenue bars from subOrders */}
            <Card className="border-none shadow-sm dark:bg-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Revenue Trend (last 6 months)</span>
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-40 w-full rounded-lg" />
                ) : maxRevenue === 0 ? (
                  <div className="h-40 w-full bg-gray-100 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center gap-1">
                    <BarChart3 className="w-6 h-6 text-gray-400" />
                    <p className="text-sm text-gray-500">No revenue yet — your sales will chart here</p>
                  </div>
                ) : (
                  <div className="h-40 w-full flex items-end justify-between gap-2 px-1">
                    {data?.monthlyRevenue.map((point) => (
                      <div key={point.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-[9px] font-semibold text-gray-500 tabular-nums">
                          {point.revenue > 0 ? `৳${point.revenue >= 1000 ? `${Math.round(point.revenue / 1000)}k` : point.revenue}` : ''}
                        </span>
                        <div
                          className="w-full max-w-[36px] rounded-t-md bg-primary/80"
                          style={{ height: `${Math.max(2, Math.round((point.revenue / maxRevenue) * 100))}%` }}
                          title={`${point.month}: ৳${point.revenue.toLocaleString()}`}
                        />
                        <span className="text-[10px] text-gray-500">{point.month}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders — real subOrders */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Orders</h2>
                <Button variant="ghost" size="sm" className="text-primary h-8" onClick={() => navigate('seller-orders')}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {loading ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
                ) : (data?.recentSubOrders?.length ?? 0) === 0 ? (
                  <Card className="border-dashed shadow-sm dark:bg-gray-800">
                    <CardContent className="p-8 text-center">
                      <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No orders yet</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Orders from buyers will appear here the moment they come in.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('seller-add-product')}>
                        <Plus className="w-4 h-4 mr-1" /> Add a product
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  data?.recentSubOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="border-none shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => navigate('seller-order-management', { subOrderId: order.id })}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm dark:text-white">{order.orderNumber}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {order.primaryItemName}
                              {order.itemCount > 1 ? ` +${order.itemCount - 1} more` : ''} • {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-bold text-sm dark:text-white">৳{order.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[order.status] || ''}`}>
                            {order.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SellerDashboardPage;
