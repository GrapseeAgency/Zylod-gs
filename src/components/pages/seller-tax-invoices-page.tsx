'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, FileText, Lock, Inbox, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  mushakNumber: string;
  orderNumber: string;
  date: string;
  dueDate: string;
  subtotal: number;
  vatAmount: number;
  shipping: number;
  grandTotal: number;
  paymentStatus: string;
  buyerName: string;
  itemsCount: number;
}

const bdt = (n: number) =>
  `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function statusChip(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Settled</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Partial</Badge>;
    case 'unpaid':
    case 'pending':
      return <Badge className="bg-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-200">Unpaid</Badge>;
    case 'refunded':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Settled' },
  { id: 'pending', label: 'Unpaid' },
] as const;

export function SellerTaxInvoicesPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/invoices?status=${filter}`);
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 401) {
          setAuthRequired(true);
          setError('');
          setInvoices([]);
        } else if (res.ok && json?.success && Array.isArray(json?.data)) {
          setInvoices(json.data as InvoiceRow[]);
          setError('');
          setAuthRequired(false);
        } else {
          setError(json?.error || 'Failed to load tax invoices');
          setInvoices([]);
          setAuthRequired(false);
        }
      } catch {
        if (alive) {
          setError('Could not reach the invoices service');
          setInvoices([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [filter]);

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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tax Invoices</h1>
      </header>

      <main className="p-4 space-y-4 md:p-6 md:max-w-4xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Tax Invoices</h1>
        </div>

        <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="p-4 flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Mushak 6.3 Commercial Invoices</p>
              <p className="text-xs text-gray-500 leading-relaxed dark:text-gray-400">
                Tax invoices issued for every order you receive. Each carries a real MUSHAK-6.3 number,
                server-computed subtotal, VAT, shipping and grand total — ready for corporate audit filing.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => {
            const isSelected = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-gray-600 dark:text-gray-400 border border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Lock className="w-10 h-10 text-gray-300 mx-auto dark:text-gray-600" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sign in to view the Mushak 6.3 tax invoices issued for your orders.
              </p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">
              {error}
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setFilter((f) => f)}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : invoices.length === 0 ? (
          <Card className="border-dashed dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Inbox className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">
                {filter === 'all' ? 'No tax invoices yet' : `No ${filter} invoices`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                When buyers place orders on your products, the corresponding Mushak 6.3 invoices will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <Card
                key={inv.id}
                className="shadow-sm cursor-pointer hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-800"
                onClick={() => navigate('order-invoice', { orderId: inv.id })}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{inv.invoiceNumber}</h3>
                        {statusChip(inv.paymentStatus)}
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono block mt-0.5 dark:text-gray-500">
                        {inv.mushakNumber} · PO #{inv.orderNumber}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-gray-900 font-mono dark:text-gray-100">
                        {bdt(inv.grandTotal)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{inv.itemsCount} item{inv.itemsCount === 1 ? '' : 's'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1 dark:bg-gray-950 dark:border dark:border-gray-800">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 dark:text-gray-500">Buyer</span>
                      <span className="font-bold text-gray-800 text-right truncate dark:text-gray-200">{inv.buyerName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 dark:text-gray-500">Issued</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        {fmtDate(inv.date)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 dark:text-gray-500">Due</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{fmtDate(inv.dueDate)}</span>
                    </div>
                    <div className="flex justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-gray-400 dark:text-gray-500">Subtotal</span>
                      <span className="text-gray-700 dark:text-gray-300">{bdt(inv.subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 dark:text-gray-500">VAT (5%)</span>
                      <span className="text-gray-700 dark:text-gray-300">{bdt(inv.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 dark:text-gray-500">Shipping</span>
                      <span className="text-gray-700 dark:text-gray-300">{bdt(inv.shipping)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </motion.div>
  );
}

export default SellerTaxInvoicesPagePage;
