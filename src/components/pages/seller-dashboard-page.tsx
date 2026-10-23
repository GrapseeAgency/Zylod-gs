'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import {
  Package, ShoppingCart, AlertTriangle, DollarSign, MessageCircle,
  Plus, Truck, Store, BarChart3, ChevronRight, LayoutList, Users, PackageSearch,
  BellRing, PackageOpen, BadgePercent, Wallet, FileSpreadsheet, Trophy, Filter,
  MessagesSquare, Radio
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRealtimeRoom } from '@/hooks/use-realtime-room';

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
  supplier: { companyName: string; verificationStatus: string; ratingAvg: number; supplierId?: string | null };
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

interface RestockDemandRow {
  productId: string;
  productName: string;
  stockQuantity: number;
  unit: string;
  isActive: boolean;
  watchers: number;
}

/* Task 102: platform campaigns featuring THIS supplier's products —
   server-windowed, cross-supplier-isolated, real pins only. */
interface CampaignParticipation {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  validUntil: string;
  products: Array<{ id: string; name: string }>;
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
  const [demand, setDemand] = useState<RestockDemandRow[]>([]);
  const [totalWatchers, setTotalWatchers] = useState(0);
  const [demandPulse, setDemandPulse] = useState<'none' | 'watcher' | 'restock'>('none');
  const [campaigns, setCampaigns] = useState<CampaignParticipation[]>([]);
  // Realtime-tap reload counter: events that change the dashboard aggregates
  // (moderation decisions, new reviews) bump this to refetch — no polling loop.
  const [reloadTick, setReloadTick] = useState(0);

  const fetchDemand = useCallback(async () => {
    try {
      const res = await fetch('/api/seller/stock-watches');
      const json = await res.json();
      if (res.ok && json.success) {
        setDemand(json.data || []);
        setTotalWatchers(json.totalWatchers || 0);
      }
    } catch (err) {
      console.error('Error fetching restock demand:', err);
    }
  }, []);

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
    fetchDemand();
  }, [fetchDemand, reloadTick]);

  /* Task 102: the platform campaigns this supplier's products are pinned
     into — the seller side of the admin's promotion console. Real rows
     only; a silent list simply means no campaign is running. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/supplier/promotion-participation', { credentials: 'include' });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success) setCampaigns(json.data ?? []);
      } catch { /* the card is informational — a failed fetch stays silent */ }
    })();
    return () => { cancelled = true };
  }, []);

  /* Task 62: live demand tick — a buyer hitting 'Notify me when back in
     stock' pushes the REAL active-watcher count into this seller's room;
     the card pulses and refetches. No polling loop. */
  const sellerRoom = data?.supplier?.supplierId ? `seller:${data.supplier.supplierId}` : null;
  useRealtimeRoom(sellerRoom ? [sellerRoom] : [], {
    onEvent: useCallback((msg) => {
      // 'stock:watch' — a buyer just started watching; 'inventory:updated' —
      // the seller's own restock just landed and completed watches must
      // leave the demand queue immediately (both are real persisted truths).
      if (msg.event === 'stock:watch' || msg.event === 'inventory:updated') {
        setDemandPulse(msg.event === 'stock:watch' ? 'watcher' : 'restock');
        fetchDemand();
        setTimeout(() => setDemandPulse('none'), 3000);
        return;
      }
      // Cohesion taps — the server already persisted the row before emitting;
      // these only surface it live (the durable notification row is separate).
      if (msg.event === 'moderation:decision') {
        const d = (typeof msg.data === 'object' && msg.data !== null ? msg.data : {}) as {
          entityType?: unknown;
          decision?: unknown;
          reason?: unknown;
        };
        const reason = typeof d.reason === 'string' && d.reason ? d.reason : undefined;
        if (d.entityType === 'product') {
          if (d.decision === 'approved') {
            toast.success('Product approved — buyers can see it now', { description: reason });
          } else {
            toast.error('Product rejected by review', { description: reason });
          }
        } else if (d.entityType === 'supplier') {
          toast.message(`Verification update: ${String(d.decision ?? 'reviewed')}`, { description: reason });
        }
        setReloadTick((t) => t + 1); // aggregates (products count, verification) resync from DB truth
        return;
      }
      if (msg.event === 'supplier:reviewed') {
        const d = (typeof msg.data === 'object' && msg.data !== null ? msg.data : {}) as { rating?: unknown };
        const rating = typeof d.rating === 'number' ? d.rating : null;
        toast.message('New store review received', {
          description: rating !== null ? `Rated ${rating} out of 5.` : 'A buyer just reviewed your store.',
        });
        setReloadTick((t) => t + 1);
        return;
      }
      if (msg.event === 'qa:new') {
        toast.message('New product question', {
          description: 'A buyer asked about one of your products — answer it from Queries.',
        });
      }
    }, [fetchDemand]),
  });

  const stats = [
    { label: "Paid Revenue (all time)", value: data ? `৳${data.stats.totalRevenueBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '0', icon: DollarSign, color: "text-green-600" },
    { label: "Awaiting Payment", value: data ? `৳${data.stats.pendingPaymentBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '0', icon: AlertTriangle, color: "text-orange-600" },
    { label: "Pending Orders", value: data ? data.stats.pendingOrders : 0, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Low Stock Alerts", value: data ? data.stats.lowStockCount : 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Unread Messages", value: data ? data.storeStats.messages : 0, icon: MessageCircle, color: "text-yellow-600", page: 'chat-list' as string | undefined },
  ];

  /* Quick actions point ONLY at real, rendered pages. */
  const quickActions = [
    { icon: Plus, label: 'Add Product', page: 'seller-add-product' },
    { icon: Truck, label: 'Orders', page: 'seller-orders' },
    { icon: PackageOpen, label: 'Samples', page: 'supplier-samples' },
    { icon: PackageSearch, label: 'Inventory', page: 'inventory-management' },
    { icon: LayoutList, label: 'Listings', page: 'product-listings-manager' },
    { icon: Store, label: 'Store', page: 'seller-storefront' },
    { icon: BarChart3, label: 'Analytics', page: 'seller-analytics' },
    { icon: Wallet, label: 'Payouts', page: 'seller-payouts' },
    { icon: FileSpreadsheet, label: 'Financials', page: 'seller-financial-statements' },
    { icon: Trophy, label: 'Rankings', page: 'seller-rankings' },
    { icon: Filter, label: 'Funnel', page: 'seller-sales-funnel' },
    { icon: Users, label: 'Customers', page: 'seller-customer-insights' },
    { icon: MessagesSquare, label: 'Queries', page: 'customer-queries' },
    { icon: Radio, label: 'Live Studio', page: 'seller-live-studio' },
    { icon: MessageCircle, label: 'Messages', page: 'chat-list' },
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
              {stats.map((stat, idx) => {
                const inner = (
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
                )
                // Task 136: a stat with a real destination is clickable — the
                // unread-messages tile opens the chat inbox directly.
                return stat.page ? (
                  <Card key={idx} className="border-none shadow-sm dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(stat.page!)} data-testid="stat-unread-messages">
                    {inner}
                  </Card>
                ) : (
                  <Card key={idx} className="border-none shadow-sm dark:bg-gray-800">{inner}</Card>
                )
              })}
            </div>

            {/* Restock Demand — REAL active watch counts per product (Task 62) */}
            <Card className={`border-none shadow-sm dark:bg-gray-800 transition-shadow ${demandPulse !== 'none' ? 'ring-2 ring-primary/40' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BellRing className={`w-4 h-4 ${demandPulse !== 'none' ? 'text-primary animate-pulse' : 'text-gray-400'}`} />
                    Restock Demand
                    {demandPulse === 'watcher' && <span className="text-[10px] font-medium text-primary">new watcher</span>}
                    {demandPulse === 'restock' && <span className="text-[10px] font-medium text-emerald-600">stock updated</span>}
                  </span>
                  {totalWatchers > 0 && (
                    <Badge variant="outline" className="text-[10px]">{totalWatchers} buyer{totalWatchers !== 1 ? 's' : ''} waiting</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {demand.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-gray-500">No active restock watches right now. Buyers who tap “Notify me” on a sold-out product appear here instantly.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {demand.map((row) => (
                      <div key={row.productId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate dark:text-white">{row.productName}</div>
                          <div className="text-[10px] text-gray-500">
                            {row.stockQuantity <= 0 ? 'Out of stock' : `${row.stockQuantity} ${row.unit} in stock`}
                            {!row.isActive && ' · hidden listing'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] font-semibold">{row.watchers} watching</Badge>
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => navigate('inventory-management')}>
                            Restock
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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

            {/* Task 102: platform campaigns featuring this supplier's products —
                rendered ONLY when a live campaign exists; silence means none. */}
            {campaigns.length > 0 && (
              <Card className="border-emerald-200 dark:border-emerald-900 shadow-sm dark:bg-gray-800">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <BadgePercent className="w-4 h-4" /> Platform campaigns featuring your products ({campaigns.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {campaigns.map((c) => (
                    <div key={c.id} className="rounded-lg border border-emerald-100 dark:border-emerald-900/60 p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{c.name}</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900">
                          {c.type === 'percentage' ? `${c.value}% off` : `৳${c.value.toLocaleString()} off`}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {c.products.length} of your products pinned · ends {new Date(c.validUntil).toLocaleDateString('en-GB')}
                        {c.minOrderAmount != null ? ` · applies from ৳${c.minOrderAmount.toLocaleString()}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                        You are always paid the full line value — the platform funds the discount.
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

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
