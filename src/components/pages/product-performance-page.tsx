'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, TrendingUp, DollarSign, Activity, ShoppingCart,
  Package, BarChart3, Inbox, Lock, BellRing,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Overview {
  gmv: number;
  totalOrders: number;
  unitsSold: number;
  aov: number;
  conversionRate: number | null;
  pageViews: number | null;
}

interface TopProduct {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

interface SalesPoint {
  date: string;
  bdt: number;
}

interface RestockProduct {
  productId: string;
  productName: string;
  stockQuantity: number;
  unit: string;
  isActive: boolean;
  watchers: number;
  variantLabels: string[];
}

interface AnalyticsData {
  overview: Overview;
  salesPerformance: SalesPoint[];
  topProducts: TopProduct[];
  restockDemand: {
    totalWatchers: number;
    products: RestockProduct[];
  };
}

const bdt = (n: number) =>
  `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Largest bar height (px) used in the 30-day mini chart.
const MAX_BAR_H = 56;

export function ProductPerformancePagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/analytics');
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 401) {
          setAuthRequired(true);
          setError('');
          setData(null);
        } else if (res.ok && json?.success && json?.data) {
          setData(json.data as AnalyticsData);
          setError('');
          setAuthRequired(false);
        } else {
          setError(json?.error || 'Failed to load product performance data');
          setData(null);
          setAuthRequired(false);
        }
      } catch {
        if (alive) {
          setError('Could not reach the analytics service');
          setData(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, []);

  const peakBdt = data ? Math.max(1, ...data.salesPerformance.map((p) => p.bdt)) : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8 dark:bg-gray-950"
    >
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center gap-3 dark:bg-gray-900 dark:border-gray-800">
        <button
          onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Product Performance</h1>
      </header>

      <main className="p-4 space-y-4 md:p-6 md:max-w-4xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Product Performance</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="dark:bg-gray-900 dark:border-gray-800">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </CardContent>
            </Card>
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Lock className="w-10 h-10 text-gray-300 mx-auto dark:text-gray-600 dark:text-gray-400 dark:text-gray-500" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Sign in with a supplier account to see how your products are performing.
              </p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">
              {error}
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : data ? (
          <div className="space-y-6">
            {/* Overview cards — all real, server-computed numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-l-4 border-l-primary shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase dark:text-gray-400 dark:text-gray-500">GMV</p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1 dark:text-gray-100">
                        {bdt(data.overview.gmv)}
                      </h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg dark:bg-rose-950/40 shrink-0">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase dark:text-gray-400 dark:text-gray-500">Orders</p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1 dark:text-gray-100">
                        {data.overview.totalOrders.toLocaleString()}
                      </h3>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg dark:bg-emerald-950/40 shrink-0">
                      <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase dark:text-gray-400 dark:text-gray-500">Units Sold</p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1 dark:text-gray-100">
                        {data.overview.unitsSold.toLocaleString()}
                      </h3>
                    </div>
                    <div className="p-2 bg-amber-50 rounded-lg dark:bg-amber-950/40 shrink-0">
                      <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase dark:text-gray-400 dark:text-gray-500">Avg. Order</p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1 dark:text-gray-100">
                        {bdt(data.overview.aov)}
                      </h3>
                    </div>
                    <div className="p-2 bg-rose-50 rounded-lg dark:bg-rose-950/40 shrink-0">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Honest null-states for non-existent traffic tracking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase dark:text-gray-400 dark:text-gray-500">Conversion Rate</p>
                      <p className="mt-1 text-sm text-gray-400 font-medium dark:text-gray-500 dark:text-gray-400">
                        Not available yet
                      </p>
                    </div>
                    <Activity className="h-4 w-4 text-gray-300 dark:text-gray-600 dark:text-gray-400 dark:text-gray-500 shrink-0" />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Conversion needs product-view tracking, which the platform does not collect yet.
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase dark:text-gray-400 dark:text-gray-500">Page Views</p>
                      <p className="mt-1 text-sm text-gray-400 font-medium dark:text-gray-500 dark:text-gray-400">
                        Not available yet
                      </p>
                    </div>
                    <BarChart3 className="h-4 w-4 text-gray-300 dark:text-gray-600 dark:text-gray-400 dark:text-gray-500 shrink-0" />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    A page-view tracking source does not exist; no number is shown rather than inventing one.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 30-day sales performance — real daily revenue from paid orders */}
            <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base dark:text-gray-100">Sales — last 30 days</CardTitle>
                <CardDescription className="dark:text-gray-400 dark:text-gray-500">
                  Daily gross from paid, non-reversed order lines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="flex items-end gap-[2px] overflow-x-auto no-scrollbar"
                  role="img"
                  aria-label="Daily revenue for the last 30 days"
                >
                  {data.salesPerformance.map((p) => {
                    const h = Math.round((p.bdt / peakBdt) * MAX_BAR_H);
                    return (
                      <div
                        key={p.date}
                        className="flex flex-col items-center gap-1 shrink-0"
                        title={`${fmtDay(p.date)}: ${bdt(p.bdt)}`}
                      >
                        <div
                          className="w-2 rounded-sm bg-primary/80"
                          style={{ height: Math.max(2, h) }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400">
                  <span>{fmtDay(data.salesPerformance[0]?.date || new Date().toISOString())}</span>
                  <span>{fmtDay(data.salesPerformance[data.salesPerformance.length - 1]?.date || new Date().toISOString())}</span>
                </div>
              </CardContent>
            </Card>

            {/* Top products — real rows */}
            <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base dark:text-gray-100">Top Products</CardTitle>
                <CardDescription className="dark:text-gray-400 dark:text-gray-500">
                  By recognized revenue — your best sellers first
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Inbox className="h-8 w-8 text-gray-300 mx-auto dark:text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No sales yet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                      Your top products will appear here once buyers place and pay for orders on your catalog.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.topProducts.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800"
                      >
                        <div className="h-10 w-10 bg-gray-100 dark:bg-gray-900 rounded-md flex items-center justify-center flex-shrink-0 text-gray-500 font-bold dark:bg-gray-800 dark:text-gray-400 dark:text-gray-500">
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{p.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{p.unitsSold} units sold</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{bdt(p.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Restock demand — real stockAlerts */}
            <Card className="shadow-sm border-l-4 border-l-amber-400 dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap justify-between items-center gap-2 dark:text-gray-100">
                  <span className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Restock Demand
                  </span>
                  {data.restockDemand.totalWatchers > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      {data.restockDemand.totalWatchers} buyer{data.restockDemand.totalWatchers === 1 ? '' : 's'} waiting
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="dark:text-gray-400 dark:text-gray-500">
                  Buyers who set a restock watch on your sold-out goods — real rows, not estimates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.restockDemand.products.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center dark:text-gray-500 dark:text-gray-400">
                    No active restock watches right now — buyers waiting on your sold-out products will appear here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.restockDemand.products.map((p) => (
                      <div
                        key={p.productId}
                        className="flex items-start gap-3 border border-gray-100 rounded-xl p-3 cursor-pointer hover:border-amber-200 transition dark:border-gray-800"
                        onClick={() => navigate('edit-product', { productId: p.productId })}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{p.productName}</h4>
                          <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400 dark:text-gray-500">
                            {p.isActive
                              ? p.stockQuantity <= 0
                                ? 'Out of stock'
                                : `${p.stockQuantity} ${p.unit} in stock`
                              : 'Listing hidden'}
                            {p.variantLabels.length > 0 && (
                              <span className="ml-1">· waiting on {p.variantLabels.join(', ')}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{p.watchers} watching</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </motion.div>
  );
}

export default ProductPerformancePagePage;
