'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Filter, ShoppingCart, PackageCheck, PackageX, Truck, Undo2, XCircle, Inbox, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/page-loader'

interface PerformanceData {
  orders: {
    ordersReceived: number;
    ordersFulfilled: number;
    pendingShipment: number;
    inTransit: number;
    cancelled: number;
    returned: number;
    fulfillmentRate: number;
  };
  funnel: {
    impressions: number | null;
    productClicks: number | null;
    inquiries: number | null;
    orders: number;
  };
  leaderboard: unknown[];
  alerts: unknown[];
}

export function SellerSalesFunnelPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/performance');
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 401) {
          setAuthRequired(true);
          setError('');
        } else if (res.ok && json?.success && json?.data) {
          setData(json.data);
          setError('');
          setAuthRequired(false);
        } else {
          setError(json?.error || json?.data?.error || 'Failed to load performance');
          setData(null);
        }
      } catch {
        if (alive) setError('Could not reach the performance service');
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchPerformance();
    return () => { alive = false; };
  }, []);

  const orderStats = data ? [
    { label: 'Orders received', value: data.orders.ordersReceived, icon: ShoppingCart, color: 'text-primary' },
    { label: 'Fulfilled', value: data.orders.ordersFulfilled, icon: PackageCheck, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Pending shipment', value: data.orders.pendingShipment, icon: PackageX, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'In transit', value: data.orders.inTransit, icon: Truck, color: 'text-sky-600 dark:text-sky-400' },
    { label: 'Cancelled', value: data.orders.cancelled, icon: XCircle, color: 'text-red-600 dark:text-red-400' },
    { label: 'Returned', value: data.orders.returned, icon: Undo2, color: 'text-orange-600 dark:text-orange-400' },
  ] : [];

  // Funnel bars: real orders stage always renders; untracked stages stay honest.
  const funnelStages = data ? [
    { label: 'Impressions', value: data.funnel.impressions },
    { label: 'Product clicks', value: data.funnel.productClicks },
    { label: 'Inquiries', value: data.funnel.inquiries },
    { label: 'Orders', value: data.funnel.orders },
  ] : [];
  const funnelMax = Math.max(...funnelStages.map((s) => s.value ?? 0), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8 dark:bg-gray-900"
    >
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 dark:bg-gray-800 border-b px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:bg-gray-700" aria-label="Go back">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Sales funnel</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-neutral-100 dark:text-white">Sales funnel</h1>

        {loading ? (
          <PageLoader />
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Filter className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Sign in with a supplier account to see your funnel.</p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Order pipeline — real subOrder statuses */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="border-none shadow-sm dark:bg-gray-800 md:col-span-1">
                <CardContent className="p-4">
                  <div className={`flex items-center gap-2 ${orderStats[6]?.color ?? 'text-primary'}`}>
                    <Percent className="w-4 h-4" />
                    <span className="text-xs font-medium">Fulfillment rate</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="funnel-fulfillment-rate">
                    {data.orders.fulfillmentRate}%
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">delivered ÷ received</p>
                </CardContent>
              </Card>
              {orderStats.map((s) => (
                <Card key={s.label} className="border-none shadow-sm dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className={`flex items-center gap-2 ${s.color}`}>
                      <s.icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{s.label}</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white tabular-nums">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Funnel — only real stages render; untracked stages say so */}
            <Card className="border-none shadow-sm dark:bg-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base dark:text-white">Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3" data-testid="funnel-stages">
                {funnelStages.map((stage) =>
                  stage.value === null ? (
                    <div key={stage.label} className="flex items-center justify-between p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 dark:border-gray-700">
                      <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">{stage.label}</span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400 italic">not tracked yet</span>
                    </div>
                  ) : (
                    <div key={stage.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">{stage.label}</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100 dark:text-white tabular-nums">{stage.value}</span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/85 transition-all"
                          style={{ width: `${Math.max(3, (stage.value / funnelMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Alerts — honest empty state until a real alert source exists */}
            <Card className="border-dashed dark:bg-gray-800">
              <CardContent className="p-6 text-center space-y-1">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No alerts</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Stock and fulfillment alerts for your store will surface here.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </motion.div>
  );
}

export default SellerSalesFunnelPagePage;
