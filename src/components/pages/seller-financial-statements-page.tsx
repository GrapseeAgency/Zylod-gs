'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, FileSpreadsheet, Inbox, TrendingUp, BadgeCheck, HelpCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { PageLoader } from '@/components/ui/page-loader'

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

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function SellerFinancialStatementsPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchRevenue = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/revenue');
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
          setError(json?.error || json?.data?.error || 'Failed to load the revenue ledger');
          setData(null);
        }
      } catch {
        if (alive) setError('Could not reach the revenue service');
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchRevenue();
    return () => { alive = false; };
  }, []);

  const maxGross = data?.dailySeries?.reduce((m, d) => Math.max(m, d.gross), 0) ?? 0;
  const recentSeries = data?.dailySeries?.slice(-14) ?? [];

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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Financial statements</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100 dark:text-white">Financial statements</h1>

        {loading ? (
          <PageLoader />
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Sign in with a supplier account to see your revenue ledger.</p>
              <ButtonSignLink />
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Summary — gross is recorded order-line truth; recognized is actually-paid money */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">Gross revenue</span>
                  </div>
                  <p className="mt-2 text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="revenue-gross">{bdt(data.summary.gross)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">all recorded order lines</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <BadgeCheck className="w-4 h-4" />
                    <span className="text-xs font-medium">Recognized</span>
                  </div>
                  <p className="mt-2 text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="revenue-recognized">{bdt(data.summary.recognized)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">orders actually paid</p>
                </CardContent>
              </Card>
              {(
                [
                  ['Commission fees', data.summary.commissionFees],
                  ['Net revenue', data.summary.netRevenue],
                ] as const
              ).map(([label, value]) => (
                <Card key={label} className="border-none shadow-sm dark:bg-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <span className="text-xs font-medium">{label}</span>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-48">
                            The platform has no fee ledger yet — this number is never invented.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="mt-2 text-lg md:text-xl font-bold text-gray-400 dark:text-gray-500 dark:text-gray-400" title="Not tracked yet">—</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">not tracked yet</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Daily gross — CSS bars from the real dailySeries */}
            {recentSeries.length > 0 && (
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base dark:text-white">Daily gross · last {recentSeries.length} recorded days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1.5 h-32" data-testid="revenue-daily-chart">
                    {recentSeries.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors"
                          style={{ height: `${maxGross > 0 ? Math.max(4, (d.gross / maxGross) * 100) : 4}%` }}
                          title={`${fmtDay(d.date)}: ${bdt(d.gross)}`}
                        />
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 dark:text-gray-400 truncate w-full text-center">
                          {fmtDay(d.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data.ledger.length === 0 ? (
              <Card className="border-dashed dark:bg-gray-800">
                <CardContent className="p-10 text-center space-y-2">
                  <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No revenue recorded yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Order lines on your products will appear here the moment buyers order them.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base dark:text-white">Revenue ledger · {data.ledger.length} line{data.ledger.length === 1 ? '' : 's'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-gray-900 dark:bg-gray-800">
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 border-b">
                          <th className="py-2 pr-3 font-medium">Date</th>
                          <th className="py-2 pr-3 font-medium">Order</th>
                          <th className="py-2 pr-3 font-medium">Product</th>
                          <th className="py-2 pr-3 font-medium text-right">Qty</th>
                          <th className="py-2 pr-3 font-medium text-right">Gross</th>
                          <th className="py-2 pr-3 font-medium">Payment</th>
                          <th className="py-2 font-medium">Fulfillment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ledger.map((row) => (
                          <tr key={row.id} className="border-b last:border-0 text-gray-800 dark:text-gray-200">
                            <td className="py-2.5 pr-3 text-xs whitespace-nowrap">{fmtDay(row.date)}</td>
                            <td className="py-2.5 pr-3 font-mono text-xs">{row.orderNumber}</td>
                            <td className="py-2.5 pr-3 max-w-40 truncate" title={row.productName}>{row.productName}</td>
                            <td className="py-2.5 pr-3 text-right tabular-nums">{row.quantity}</td>
                            <td className="py-2.5 pr-3 text-right font-semibold tabular-nums whitespace-nowrap">{bdt(row.gross)}</td>
                            <td className="py-2.5 pr-3">{paymentChip(row.paymentStatus)}</td>
                            <td className="py-2.5">{fulfillmentChip(row.fulfillmentStatus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Commission and net columns arrive when the platform has a real fee ledger — they are never estimated.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </main>
    </motion.div>
  );
}

function ButtonSignLink() {
  const navigate = useNavigationStore((state) => state.navigate);
  return (
    <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
  );
}

export default SellerFinancialStatementsPagePage;
