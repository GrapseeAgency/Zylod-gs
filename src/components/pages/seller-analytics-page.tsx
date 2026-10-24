'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Loader2, TrendingUp, DollarSign, Activity, Users, ShoppingCart, MousePointerClick, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AnalyticsData {
  overview: {
    gmv: number;
    totalOrders: number;
    unitsSold: number;
    aov: number;
    conversionRate: number | null;
    pageViews: number | null;
  };
  salesPerformance: { date: string; bdt: number }[];
  trafficSources: { source: string; percentage: number }[];
  topProducts: { id: string; name: string; unitsSold: number; revenue: number }[];
  restockDemand: {
    totalWatchers: number;
    products: {
      productId: string;
      productName: string;
      stockQuantity: number;
      unit: string;
      isActive: boolean;
      watchers: number;
      variantLabels: string[];
    }[];
  };
}

export function SellerAnalyticsPage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7D');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/analytics');
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setData(json.data);
          setError('');
        } else {
          setError(json.error || 'Failed to fetch analytics');
          setData(null);
        }
      } catch (error) {
        console.error(error);
        setError('Could not reach the analytics service');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [timeRange]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8"
    >
      <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 border-b px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Seller Analytics</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-semibold text-gray-900 dark:text-gray-100">Seller Analytics</h1>
        <Tabs defaultValue="7D" onValueChange={setTimeRange} className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-gray-200">
            <TabsTrigger value="Today">Today</TabsTrigger>
            <TabsTrigger value="7D">7 Days</TabsTrigger>
            <TabsTrigger value="30D">30 Days</TabsTrigger>
            <TabsTrigger value="Custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading || !data ? (
          error ? (
            <div className="text-center py-14">
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{error}</p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-l-4 border-l-primary shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">GMV</p>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        ৳{data.overview.gmv.toLocaleString()}
                      </h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Orders</p>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {data.overview.totalOrders.toLocaleString()}
                      </h3>
                    </div>
                    <div className="p-2 bg-primary/5 rounded-lg">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Units Sold</p>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {data.overview.unitsSold.toLocaleString()}
                      </h3>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Activity className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Avg. Order Value</p>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
                        ৳{data.overview.aov.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </h3>
                    </div>
                    <div className="p-2 bg-amber-50 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Conv. Rate</p>
                      <h3 className="text-lg font-bold mt-1">
                        {/* Not tracked yet — the API returns null and the UI
                            says so instead of showing an invented rate. */}
                        {data.overview.conversionRate != null ? `${data.overview.conversionRate}%` : <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">Not available yet</span>}
                      </h3>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Views</p>
                      <h3 className="text-lg font-bold mt-1">
                        {data.overview.pageViews != null ? data.overview.pageViews.toLocaleString() : <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">Not available yet</span>}
                      </h3>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border-l-4 border-l-amber-400">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-amber-600" />
                    Restock Demand
                  </span>
                  {data.restockDemand.totalWatchers > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                      {data.restockDemand.totalWatchers} buyer{data.restockDemand.totalWatchers === 1 ? '' : 's'} waiting
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Buyers who set a restock watch on your sold-out goods — real rows, not estimates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.restockDemand.products.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">
                    No active restock watches right now — buyers watching your sold-out products will appear here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.restockDemand.products.map((p) => (
                      <div
                        key={p.productId}
                        className="flex items-start gap-3 border border-gray-100 dark:border-gray-800 rounded-xl p-3 cursor-pointer hover:border-amber-200 transition"
                        onClick={() => navigate('edit-product', { productId: p.productId })}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.productName}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                            {p.isActive
                              ? p.stockQuantity <= 0
                                ? 'Out of stock'
                                : `${p.stockQuantity} ${p.unit} in stock`
                              : 'Listing hidden'}
                            {p.variantLabels.length > 0 && (
                              <span className="ml-1">
                                · waiting on {p.variantLabels.join(', ')}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-full bg-amber-50 border border-amber-200">
                          <Users className="h-3 w-3 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700">{p.watchers} watching</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Traffic Sources</CardTitle>
                <CardDescription>Where your buyers are coming from</CardDescription>
              </CardHeader>
              <CardContent>
                {data.trafficSources.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">
                    Traffic-source tracking is not available yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {data.trafficSources.map((source, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MousePointerClick className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-sm font-medium">{source.source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full" 
                              style={{ width: `${source.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold w-8 text-right">{source.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between items-center">
                  <span>Top Products</span>
                  <Button variant="link" className="text-primary p-0 h-auto text-sm" onClick={() => navigate('product-performance')}>
                    View All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">
                    No sales yet — your top products will appear here once paid orders come in.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {data.topProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0 last:pb-0">
                        <div className="h-12 w-12 bg-gray-100 dark:bg-gray-900 rounded-md flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-gray-400 dark:text-gray-500 font-bold">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{product.unitsSold} units sold</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">৳{product.revenue.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </motion.div>
  );
}

export default SellerAnalyticsPage;
