'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Lock, Inbox, Wallet, TrendingUp, ShieldCheck, Banknote,
  ArrowUpRight, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface EarningsData {
  grossGMV: number;
  netEarnings: number;
  platformCommission: number;
  availablePayout: number;
  onHoldForPayouts: number;
  pendingEscrow: number;
  totalPaidOut: number;
  totalOrders: number;
  commissionRate: string;
  currency: string;
  recentSales: { total: number; date: string }[];
}

interface CommissionRow {
  id: string;
  orderNumber: string;
  subOrderNumber: string;
  grossAmount: number;
  ratePercent: string;
  commissionAmount: number;
  netPayout: number;
  status: string;
  date: string;
}

interface CommissionsData {
  totalGross: number;
  totalCommissions: number;
  items: CommissionRow[];
}

const bdt = (n: number) =>
  `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function statusChip(status: string) {
  switch (status) {
    case 'settled':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Settled</Badge>;
    case 'in_escrow':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">In escrow</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function RevenueReportsPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [commissions, setCommissions] = useState<CommissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        // Parallel fetch — both rails are independent.
        const [earnRes, commRes] = await Promise.all([
          fetch('/api/finance/earnings'),
          fetch('/api/finance/commissions'),
        ]);
        if (!alive) return;

        if (earnRes.status === 401 || commRes.status === 401) {
          setAuthRequired(true);
          setError('');
          setEarnings(null);
          setCommissions(null);
          return;
        }

        const earnJson = await earnRes.json().catch(() => null);
        const commJson = await commRes.json().catch(() => null);

        if (earnRes.ok && earnJson?.success && earnJson?.data) {
          setEarnings(earnJson.data as EarningsData);
        } else {
          setError(earnJson?.error || 'Failed to load earnings');
        }
        if (commRes.ok && commJson?.success && commJson?.data) {
          setCommissions(commJson.data as CommissionsData);
        } else if (!error) {
          setError((prev) => prev || commJson?.error || 'Failed to load commission history');
        }
        setAuthRequired(false);
      } catch {
        if (alive) {
          setError('Could not reach the finance service');
          setEarnings(null);
          setCommissions(null);
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
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Revenue Reports</h1>
      </header>

      <main className="p-4 space-y-4 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Revenue Reports</h1>
          <Button size="sm" onClick={() => navigate('withdraw-money')} className="h-9">
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Request payout
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="dark:bg-gray-900 dark:border-gray-800">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="dark:bg-gray-900 dark:border-gray-800">
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </CardContent>
            </Card>
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Lock className="w-10 h-10 text-gray-300 mx-auto dark:text-gray-600 dark:text-gray-400 dark:text-gray-500" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Sign in with a supplier account to view your revenue reports.
              </p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error && !earnings && !commissions ? (
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
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900">
                {error}
              </div>
            )}

            {/* Summary cards from /api/finance/earnings */}
            {earnings && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-l-4 border-l-primary shadow-sm dark:bg-gray-900 dark:border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-primary">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">Gross GMV</span>
                      </div>
                      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                        {bdt(earnings.grossGMV)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">{earnings.totalOrders} orders</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Wallet className="w-4 h-4" />
                        <span className="text-xs font-medium">Net Earnings</span>
                      </div>
                      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                        {bdt(earnings.netEarnings)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">after {earnings.commissionRate} commission</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Receipt className="w-4 h-4" />
                        <span className="text-xs font-medium">Commission</span>
                      </div>
                      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                        {bdt(earnings.platformCommission)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">{earnings.commissionRate} of GMV</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                        <Banknote className="w-4 h-4" />
                        <span className="text-xs font-medium">Available Payout</span>
                      </div>
                      <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                        {bdt(earnings.availablePayout)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">wallet minus on-hold payouts</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Secondary metrics */}
                <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                  <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">On Hold for Payouts</p>
                      <p className="font-bold text-gray-900 mt-1 dark:text-gray-100">{bdt(earnings.onHoldForPayouts)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Pending Escrow</p>
                      <p className="font-bold text-gray-900 mt-1 dark:text-gray-100">{bdt(earnings.pendingEscrow)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Paid Out</p>
                      <p className="font-bold text-gray-900 mt-1 dark:text-gray-100">{bdt(earnings.totalPaidOut)}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent sales — real rows */}
                <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base dark:text-gray-100">Recent Sales</CardTitle>
                    <CardDescription className="dark:text-gray-400 dark:text-gray-500">
                      Your most recent sub-order totals — server-computed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {earnings.recentSales.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center dark:text-gray-500 dark:text-gray-400">
                        No sales yet — your recent sales totals will appear here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {earnings.recentSales.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0 dark:border-gray-800"
                          >
                            <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{fmtDate(s.date)}</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{bdt(s.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Commission ledger from /api/finance/commissions */}
            {commissions && (
              <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base dark:text-gray-100">Commission History</CardTitle>
                  <CardDescription className="dark:text-gray-400 dark:text-gray-500">
                    Per-order commission at the standard {commissions.items[0]?.ratePercent || '3.0%'} B2B rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {commissions.items.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <Inbox className="h-8 w-8 text-gray-300 mx-auto dark:text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No commission rows yet</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                        When buyers place orders on your products, the platform-fee breakdown per order will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Gross</p>
                          <p className="font-bold text-gray-900 mt-1 dark:text-gray-100">{bdt(commissions.totalGross)}</p>
                        </div>
                        <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Commissions</p>
                          <p className="font-bold text-gray-900 mt-1 dark:text-gray-100">{bdt(commissions.totalCommissions)}</p>
                        </div>
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-white dark:bg-gray-900">
                            <tr className="text-left text-xs text-gray-500 border-b dark:text-gray-400 dark:text-gray-500 dark:border-gray-800">
                              <th className="py-2 pr-3 font-medium">Date</th>
                              <th className="py-2 pr-3 font-medium">Order</th>
                              <th className="py-2 pr-3 font-medium">Sub-order</th>
                              <th className="py-2 pr-3 font-medium text-right">Gross</th>
                              <th className="py-2 pr-3 font-medium text-right">Rate</th>
                              <th className="py-2 pr-3 font-medium text-right">Commission</th>
                              <th className="py-2 pr-3 font-medium text-right">Net Payout</th>
                              <th className="py-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {commissions.items.map((r) => (
                              <tr key={r.id} className="border-b last:border-0 text-gray-800 dark:text-gray-200 dark:border-gray-800">
                                <td className="py-2.5 pr-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                                <td className="py-2.5 pr-3 font-mono text-xs">{r.orderNumber}</td>
                                <td className="py-2.5 pr-3 font-mono text-xs">{r.subOrderNumber}</td>
                                <td className="py-2.5 pr-3 text-right">{bdt(r.grossAmount)}</td>
                                <td className="py-2.5 pr-3 text-right">{r.ratePercent}</td>
                                <td className="py-2.5 pr-3 text-right">{bdt(r.commissionAmount)}</td>
                                <td className="py-2.5 pr-3 text-right font-semibold whitespace-nowrap">{bdt(r.netPayout)}</td>
                                <td className="py-2.5">{statusChip(r.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden space-y-3">
                        {commissions.items.map((r) => (
                          <div key={r.id} className="border border-gray-100 rounded-xl p-3 space-y-2 dark:border-gray-800">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 dark:text-gray-500">{r.orderNumber}</p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400">{fmtDate(r.date)}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{bdt(r.netPayout)}</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">net payout</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">
                              <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Gross</span>
                              <span className="text-right">{bdt(r.grossAmount)}</span>
                              <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Rate</span>
                              <span className="text-right">{r.ratePercent}</span>
                              <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Commission</span>
                              <span className="text-right">{bdt(r.commissionAmount)}</span>
                            </div>
                            <div className="pt-1">{statusChip(r.status)}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Honest escrow explainer */}
            <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardContent className="p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 leading-relaxed dark:text-gray-300">
                  Earnings are settled by the finance team. Commission is the standard B2B wholesale
                  rate applied to gross GMV. Money only leaves your wallet when a payout is
                  <span className="font-semibold"> completed with a reference</span> — a request alone never moves funds.
                </p>
              </CardContent>
            </Card>

            {/* Mobile CTA */}
            <Button onClick={() => navigate('withdraw-money')} className="md:hidden w-full h-11">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              Request payout
            </Button>
          </div>
        )}
      </main>
    </motion.div>
  );
}

export default RevenueReportsPagePage;
