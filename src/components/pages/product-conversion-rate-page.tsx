'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Activity, ShoppingCart, Package, Lock, Inbox, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

interface AnalyticsData {
  overview: Overview;
  topProducts: TopProduct[];
}

export function ProductConversionRatePagePage() {
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
          setError(json?.error || 'Failed to load conversion data');
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
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conversion Rate</h1>
      </header>

      <main className="p-4 space-y-4 md:p-6 md:max-w-4xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Conversion Rate</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="dark:bg-gray-900 dark:border-gray-800">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Lock className="w-10 h-10 text-gray-300 mx-auto dark:text-gray-600" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sign in with a supplier account to view your conversion data.
              </p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">
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
            {/* Honest headline: the platform does not track conversion yet */}
            <Card className="shadow-sm border-l-4 border-l-amber-400 dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 dark:text-gray-100">
                  <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Conversion Rate
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  How many product views turn into orders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 dark:bg-amber-950/30 dark:border-amber-900">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Not available yet
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        Conversion rate = orders ÷ product views. The platform tracks your real orders
                        ({data.overview.totalOrders.toLocaleString()} received) but does not yet track
                        product views, so the rate cannot be computed honestly. Showing an invented
                        percentage here would be the same fake-data class this round eliminates.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                    <p className="text-[11px] text-gray-500 uppercase font-medium dark:text-gray-400">Orders (numerator)</p>
                    <p className="text-lg font-bold text-gray-900 mt-1 dark:text-gray-100">
                      {data.overview.totalOrders.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">real, from paid order lines</p>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                    <p className="text-[11px] text-gray-500 uppercase font-medium dark:text-gray-400">Product Views (denominator)</p>
                    <p className="text-lg font-bold text-gray-400 mt-1 dark:text-gray-500">
                      —
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">no tracking source yet</p>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 col-span-2 md:col-span-1 dark:border-gray-800">
                    <p className="text-[11px] text-gray-500 uppercase font-medium dark:text-gray-400">Conversion Rate</p>
                    <p className="text-lg font-bold text-gray-400 mt-1 dark:text-gray-500">
                      —
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">cannot compute honestly</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Real inputs that DO exist — orders + units + top products */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-xs font-medium">Orders</span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {data.overview.totalOrders.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">paid, non-reversed</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Package className="w-4 h-4" />
                    <span className="text-xs font-medium">Units Sold</span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {data.overview.unitsSold.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">across all paid orders</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm col-span-2 md:col-span-1 dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-medium">Top Product</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900 truncate dark:text-gray-100">
                    {data.topProducts[0]?.name || '—'}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {data.topProducts[0]
                      ? `${data.topProducts[0].unitsSold} units · ৳${data.topProducts[0].revenue.toLocaleString()}`
                      : 'no sales yet'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Per-product "what would feed a real conversion funnel" — units sold */}
            <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base dark:text-gray-100">Top Products by Units Sold</CardTitle>
                <CardDescription className="dark:text-gray-400">
                  The numerator inputs that a real conversion rate would slice by product
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Inbox className="h-8 w-8 text-gray-300 mx-auto dark:text-gray-600" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No sales yet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                      When buyers pay for your products, the per-product order counts that feed a conversion rate will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.topProducts.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800"
                      >
                        <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0 text-gray-500 font-bold dark:bg-gray-800 dark:text-gray-400">
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{p.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{p.unitsSold} units sold</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            ৳{p.revenue.toLocaleString()}
                          </p>
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

export default ProductConversionRatePagePage;
