'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Wallet, ArrowUpRight, Clock, CheckCircle2, Banknote, Inbox, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader'

interface PayoutRow {
  id: string;
  amount: number;
  method: string;
  status: string;
  destination: string;
  reference: string | null;
  fee: number | null;
  processedAt: string | null;
  createdAt: string;
}

interface PayoutsData {
  summary: {
    totalPaid: number;
    pendingAmount: number;
    completedCount: number;
    pendingCount: number;
  };
  payouts: PayoutRow[];
}

const bdt = (n: number) =>
  `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusChip(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
    case 'processing':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Processing</Badge>;
    case 'pending':
      return <Badge className="bg-slate-200 text-slate-700 dark:text-neutral-300 hover:bg-slate-200">Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function SellerPayoutsPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<PayoutsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchPayouts = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/payouts');
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
          setError(json?.error || json?.data?.error || 'Failed to load payouts');
          setData(null);
        }
      } catch {
        if (alive) setError('Could not reach the payout service');
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchPayouts();
    return () => { alive = false; };
  }, []);

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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Payouts</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 dark:text-white">Payouts</h1>
          <Button size="sm" onClick={() => navigate('withdraw-money')} className="h-9">
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Request payout
          </Button>
        </div>

        {loading ? (
          <PageLoader />
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Wallet className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Sign in with a supplier account to see your payouts.</p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Summary — real aggregates from sellerPayouts rows */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Total paid out</span>
                  </div>
                  <p className="mt-2 text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="payouts-total-paid">{bdt(data.summary.totalPaid)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">{data.summary.completedCount} completed</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">In flight</span>
                  </div>
                  <p className="mt-2 text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="payouts-pending-amount">{bdt(data.summary.pendingAmount)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">{data.summary.pendingCount} awaiting decision</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800 col-span-2">
                <CardContent className="p-4 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 leading-relaxed">
                    Payouts are settled by the finance team. Money only leaves your wallet when a payout is
                    <span className="font-semibold"> completed with a reference</span> — a request alone never moves funds.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Mobile CTA */}
            <Button onClick={() => navigate('withdraw-money')} className="md:hidden w-full h-11">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              Request payout
            </Button>

            {data.payouts.length === 0 ? (
              <Card className="border-dashed dark:bg-gray-800">
                <CardContent className="p-10 text-center space-y-2">
                  <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No payouts yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    When the finance team settles a payout for your store, it will appear here with its reference.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop table */}
                <Card className="border-none shadow-sm dark:bg-gray-800 hidden md:block">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                      <Banknote className="w-4 h-4 text-primary" />
                      Payout history
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white dark:bg-gray-900 dark:bg-gray-800">
                          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 border-b">
                            <th className="py-2 pr-3 font-medium">Amount</th>
                            <th className="py-2 pr-3 font-medium">Method</th>
                            <th className="py-2 pr-3 font-medium">Destination</th>
                            <th className="py-2 pr-3 font-medium">Reference</th>
                            <th className="py-2 pr-3 font-medium">Status</th>
                            <th className="py-2 font-medium">Settled</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.payouts.map((p) => (
                            <tr key={p.id} className="border-b last:border-0 text-gray-800 dark:text-gray-200">
                              <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">{bdt(p.amount)}</td>
                              <td className="py-2.5 pr-3 capitalize">{p.method}</td>
                              <td className="py-2.5 pr-3 font-mono text-xs">{p.destination}</td>
                              <td className="py-2.5 pr-3 font-mono text-xs">{p.reference || <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">—</span>}</td>
                              <td className="py-2.5 pr-3">{statusChip(p.status)}</td>
                              <td className="py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtDate(p.processedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {data.payouts.map((p) => (
                    <Card key={p.id} className="border-none shadow-sm dark:bg-gray-800">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 dark:text-gray-100 dark:text-white">{bdt(p.amount)}</span>
                          {statusChip(p.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">
                          <span>Method</span><span className="text-right capitalize">{p.method}</span>
                          <span>Destination</span><span className="text-right font-mono truncate">{p.destination}</span>
                          <span>Reference</span><span className="text-right font-mono">{p.reference || '—'}</span>
                          <span>Requested</span><span className="text-right">{fmtDate(p.createdAt)}</span>
                          <span>Settled</span><span className="text-right">{fmtDate(p.processedAt)}</span>
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

export default SellerPayoutsPagePage;
