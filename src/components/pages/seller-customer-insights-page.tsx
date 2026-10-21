'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Users, Repeat, ShoppingBag, Coins, Inbox,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CustomerRow {
  buyerId: string;
  displayName: string;
  email: string;
  ordersCount: number;
  totalSpent: number;
  deliveredCount: number;
  openCount: number;
  repeat: boolean;
  firstOrderAt: string;
  lastOrderAt: string;
}

interface CustomersData {
  summary: {
    totalCustomers: number;
    repeatCustomers: number;
    avgOrdersPerCustomer: number | null;
    lifetimeValue: number;
  };
  customers: CustomerRow[];
}

const bdt = (n: number) =>
  `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function SellerCustomerInsightsPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<CustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/customers');
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
          setError(json?.error || json?.data?.error || 'Failed to load customer insights');
          setData(null);
        }
      } catch {
        if (alive) setError('Could not reach the customer insights service');
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchCustomers();
    return () => { alive = false; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 pb-20 md:pb-8 dark:bg-gray-900"
    >
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-800 border-b px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Go back">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Customer insights</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customer insights</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Everyone who ordered from your store — built from your real order lines, nothing modeled.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Users className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sign in with a supplier account to see your customers.</p>
              <button onClick={() => navigate('login')} className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">
                Sign In
              </button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Summary — real aggregates from the seller's own subOrders */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium">Customers</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white" data-testid="customers-total">{data.summary.totalCustomers}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">bought from your store</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Repeat className="w-4 h-4" />
                    <span className="text-xs font-medium">Repeat buyers</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white" data-testid="customers-repeat">{data.summary.repeatCustomers}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">more than one order</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <ShoppingBag className="w-4 h-4" />
                    <span className="text-xs font-medium">Avg orders</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white" data-testid="customers-avg">
                    {data.summary.avgOrdersPerCustomer ?? '—'}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">per customer</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Coins className="w-4 h-4" />
                    <span className="text-xs font-medium">Lifetime earned</span>
                  </div>
                  <p className="mt-2 text-lg md:text-2xl font-bold text-gray-900 dark:text-white" data-testid="customers-ltv">{bdt(data.summary.lifetimeValue)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">all customers combined</p>
                </CardContent>
              </Card>
            </div>

            {data.customers.length === 0 ? (
              <Card className="border-dashed dark:bg-gray-800">
                <CardContent className="p-10 text-center space-y-2">
                  <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No customers yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    When a buyer orders one of your products, they appear here with their real order history.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop table */}
                <Card className="border-none shadow-sm dark:bg-gray-800 hidden md:block">
                  <CardContent className="p-0">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b">
                            <th className="py-3 pl-4 pr-3 font-medium">Customer</th>
                            <th className="py-3 pr-3 font-medium text-right">Orders</th>
                            <th className="py-3 pr-3 font-medium text-right">Earned</th>
                            <th className="py-3 pr-3 font-medium text-center">Delivered / Open</th>
                            <th className="py-3 pr-3 font-medium">First order</th>
                            <th className="py-3 pr-4 font-medium">Last order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.customers.map((c) => (
                            <tr key={c.buyerId} className="border-b last:border-0 text-gray-800 dark:text-gray-200">
                              <td className="py-3 pl-4 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate max-w-52" title={c.displayName}>{c.displayName}</span>
                                  {c.repeat && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">Repeat</Badge>}
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-52">{c.email}</p>
                              </td>
                              <td className="py-3 pr-3 text-right font-semibold tabular-nums">{c.ordersCount}</td>
                              <td className="py-3 pr-3 text-right font-semibold tabular-nums whitespace-nowrap">{bdt(c.totalSpent)}</td>
                              <td className="py-3 pr-3 text-center text-xs tabular-nums">{c.deliveredCount} / {c.openCount}</td>
                              <td className="py-3 pr-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(c.firstOrderAt)}</td>
                              <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(c.lastOrderAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3" data-testid="customers-list">
                  {data.customers.map((c) => (
                    <Card key={c.buyerId} className="border-none shadow-sm dark:bg-gray-800">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{c.displayName}</span>
                          {c.repeat && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] shrink-0">Repeat</Badge>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                          <span>Orders</span><span className="text-right font-semibold">{c.ordersCount}</span>
                          <span>Earned</span><span className="text-right font-semibold">{bdt(c.totalSpent)}</span>
                          <span>Delivered / Open</span><span className="text-right">{c.deliveredCount} / {c.openCount}</span>
                          <span>First</span><span className="text-right">{fmtDate(c.firstOrderAt)}</span>
                          <span>Last</span><span className="text-right">{fmtDate(c.lastOrderAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
      </main>
    </motion.div>
  );
}

export default SellerCustomerInsightsPagePage;
