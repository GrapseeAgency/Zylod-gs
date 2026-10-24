'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Lock, Inbox, TrendingUp, DollarSign, Calendar, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface LedgerRow {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  date: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gross: number;
  commission: number | null;
  net: number | null;
}

interface RevenueData {
  summary: {
    gross: number;
    recognized: number;
    commissionFees: number | null;
    deliveryDeductions: number | null;
    netRevenue: number | null;
    availableForPayout: number | null;
  };
  dailySeries: { date: string; gross: number }[];
  ledger: LedgerRow[];
}

const bdt = (n: number) =>
  `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function paymentChip(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Partial</Badge>;
    case 'unpaid':
      return <Badge className="bg-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-200">Unpaid</Badge>;
    case 'refunded':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function fulfillmentChip(status: string) {
  const map: Record<string, string> = {
    delivered: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    shipped: 'bg-sky-100 text-sky-800 hover:bg-sky-100',
    packed: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
    confirmed: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
    pending: 'bg-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-200',
    cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
    returned: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  };
  return <Badge className={(map[status] || '') + ' capitalize'}>{status}</Badge>;
}

const MAX_BAR_H = 64;

export function RevenueBreakdownPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/revenue');
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 401) {
          setAuthRequired(true);
          setError('');
          setData(null);
        } else if (res.ok && json?.success && json?.data) {
          setData(json.data as RevenueData);
          setError('');
          setAuthRequired(false);
        } else {
          setError(json?.error || 'Failed to load revenue breakdown');
          setData(null);
          setAuthRequired(false);
        }
      } catch {
        if (alive) {
          setError('Could not reach the revenue service');
          setData(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, []);

  const peakGross = data ? Math.max(1, ...data.dailySeries.map((p) => p.gross)) : 1;

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
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Revenue Breakdown</h1>
      </header>

      <main className="p-4 space-y-4 md:p-6 md:max-w-4xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Revenue Breakdown</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="dark:bg-gray-900 dark:border-gray-800">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </CardContent>
            </Card>
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Lock className="w-10 h-10 text-gray-300 mx-auto dark:text-gray-600" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sign in with a supplier account to see your revenue breakdown.
              </p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">
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
            {/* Summary — real gross + recognized; honest "not available" for null fields */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="border-l-4 border-l-primary shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-medium">Gross Revenue</span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {bdt(data.summary.gross)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">all non-reversed order lines</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">Recognized</span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {bdt(data.summary.recognized)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">paid orders only</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm col-span-2 md:col-span-1 dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Receipt className="w-4 h-4" />
                    <span className="text-xs font-medium">Platform Commission</span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-400 dark:text-gray-500">
                    Not available yet
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">no fee ledger implemented</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="flex justify-between md:block">
                  <span className="text-gray-500 dark:text-gray-400">Delivery Deductions</span>
                  <span className="font-bold text-gray-400 md:block md:mt-1 dark:text-gray-500">
                    {data.summary.deliveryDeductions != null ? bdt(data.summary.deliveryDeductions) : 'Not available yet'}
                  </span>
                </div>
                <div className="flex justify-between md:block">
                  <span className="text-gray-500 dark:text-gray-400">Net Revenue</span>
                  <span className="font-bold text-gray-400 md:block md:mt-1 dark:text-gray-500">
                    {data.summary.netRevenue != null ? bdt(data.summary.netRevenue) : 'Not available yet'}
                  </span>
                </div>
                <div className="flex justify-between md:block">
                  <span className="text-gray-500 dark:text-gray-400">Available for Payout</span>
                  <span className="font-bold text-gray-400 md:block md:mt-1 dark:text-gray-500">
                    {data.summary.availableForPayout != null ? bdt(data.summary.availableForPayout) : 'Not available yet'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Daily gross chart — real series from ledger */}
            <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base dark:text-gray-100">Daily Gross Revenue</CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Real order-line totals grouped by day
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.dailySeries.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center dark:text-gray-500">
                    No revenue recorded yet — your daily breakdown will appear here once paid orders come in.
                  </p>
                ) : (
                  <>
                    <div
                      className="flex items-end gap-1 overflow-x-auto no-scrollbar"
                      role="img"
                      aria-label="Daily gross revenue"
                    >
                      {data.dailySeries.map((p) => {
                        const h = Math.round((p.gross / peakGross) * MAX_BAR_H);
                        return (
                          <div
                            key={p.date}
                            className="flex flex-col items-center gap-1 shrink-0"
                            title={`${fmtDay(p.date)}: ${bdt(p.gross)}`}
                          >
                            <div
                              className="w-3 sm:w-4 rounded-sm bg-primary/80"
                              style={{ height: Math.max(2, h) }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
                      <span>{fmtDay(data.dailySeries[0].date)}</span>
                      <span>{fmtDay(data.dailySeries[data.dailySeries.length - 1].date)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Ledger — real rows */}
            <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base dark:text-gray-100">Revenue Ledger</CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Every order line on your products (cancelled &amp; returned excluded)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.ledger.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Inbox className="h-8 w-8 text-gray-300 mx-auto dark:text-gray-600" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No revenue lines yet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                      Your ledger will appear here once buyers place orders on your products.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white dark:bg-gray-900">
                          <tr className="text-left text-xs text-gray-500 border-b dark:text-gray-400 dark:border-gray-800">
                            <th className="py-2 pr-3 font-medium">Date</th>
                            <th className="py-2 pr-3 font-medium">Order</th>
                            <th className="py-2 pr-3 font-medium">Product</th>
                            <th className="py-2 pr-3 font-medium text-right">Qty</th>
                            <th className="py-2 pr-3 font-medium text-right">Unit Price</th>
                            <th className="py-2 pr-3 font-medium text-right">Gross</th>
                            <th className="py-2 pr-3 font-medium">Payment</th>
                            <th className="py-2 font-medium">Fulfillment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.ledger.map((r) => (
                            <tr key={r.id} className="border-b last:border-0 text-gray-800 dark:text-gray-200 dark:border-gray-800">
                              <td className="py-2.5 pr-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Calendar className="inline h-3 w-3 mr-1" />
                                {fmtDate(r.date)}
                              </td>
                              <td className="py-2.5 pr-3 font-mono text-xs">{r.orderNumber}</td>
                              <td className="py-2.5 pr-3 truncate max-w-[180px]">{r.productName}</td>
                              <td className="py-2.5 pr-3 text-right">{r.quantity}</td>
                              <td className="py-2.5 pr-3 text-right">{bdt(r.unitPrice)}</td>
                              <td className="py-2.5 pr-3 text-right font-semibold whitespace-nowrap">{bdt(r.gross)}</td>
                              <td className="py-2.5 pr-3">{paymentChip(r.paymentStatus)}</td>
                              <td className="py-2.5">{fulfillmentChip(r.fulfillmentStatus)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {data.ledger.map((r) => (
                        <div key={r.id} className="border border-gray-100 rounded-xl p-3 space-y-2 dark:border-gray-800">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{r.orderNumber}</p>
                              <p className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{r.productName}</p>
                            </div>
                            <p className="text-sm font-bold text-gray-900 shrink-0 dark:text-gray-100">{bdt(r.gross)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-300">
                            <span className="text-gray-500 dark:text-gray-400">Date</span>
                            <span className="text-right">{fmtDate(r.date)}</span>
                            <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                            <span className="text-right">{r.quantity} @ {bdt(r.unitPrice)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {paymentChip(r.paymentStatus)}
                            {fulfillmentChip(r.fulfillmentStatus)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </motion.div>
  );
}

export default RevenueBreakdownPagePage;
