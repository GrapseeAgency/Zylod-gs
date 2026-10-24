'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Landmark, Plus, Trash2, Lock, ShieldCheck, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  branchName: string;
  routingNumber: string;
  isDefault: boolean;
  verified: boolean;
  createdAt?: string;
}

export function SellerPayoutMethodsPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAccounts = async () => {
    let alive = true;
    try {
      setLoading(true);
      const res = await fetch('/api/bank-accounts');
      const json = await res.json().catch(() => null);
      if (!alive) return;
      if (res.status === 401) {
        setAuthRequired(true);
        setError('');
        setAccounts([]);
      } else if (res.ok && json?.success && Array.isArray(json?.data)) {
        setAccounts(json.data as BankAccount[]);
        setError('');
        setAuthRequired(false);
      } else {
        setError(json?.error || 'Failed to load payout methods');
        setAccounts([]);
        setAuthRequired(false);
      }
    } catch {
      if (alive) {
        setError('Could not reach the payout-methods service');
        setAccounts([]);
      }
    } finally {
      if (alive) setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    return () => { /* noop */ };
  }, []);

  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) loadAccounts();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this payout method? Future payouts will not be sent to this account.')) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: 'DELETE' });
      if (res.ok) loadAccounts();
    } finally {
      setActionLoading(null);
    }
  };

  const masked = (num: string) => {
    if (!num) return '—';
    const tail = num.slice(-4);
    return `•••• ${tail}`;
  };

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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payout Methods</h1>
      </header>

      <main className="p-4 space-y-4 md:p-6 md:max-w-3xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Payout Methods</h1>
          <Button size="sm" onClick={() => navigate('add-bank-account')} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Add payout method
          </Button>
        </div>

        <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed dark:text-gray-300">
              Payout methods are the verified commercial bank accounts where the finance team settles
              your wallet withdrawals. A request alone never moves funds — payouts only leave your
              wallet when finance completes them with a reference.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-40" />
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
                Sign in to manage the bank accounts the platform pays your withdrawals into.
              </p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">
              {error}
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={loadAccounts}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="border-dashed dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Landmark className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No payout methods linked</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                Add a commercial bank account so the finance team can settle your wallet withdrawals.
              </p>
              <Button onClick={() => navigate('add-bank-account')} className="h-11">
                <Plus className="h-4 w-4 mr-1" />
                Add a payout method
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <Card key={acc.id} className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0 dark:bg-rose-950/40 dark:border-rose-900">
                        <Landmark className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{acc.bankName}</h3>
                          {acc.isDefault && (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Primary
                            </Badge>
                          )}
                          {acc.verified && (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono block mt-0.5 dark:text-gray-500">
                          A/C: {masked(acc.accountNumber)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(acc.id)}
                      disabled={actionLoading === acc.id}
                      className="text-gray-400 dark:text-gray-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 dark:hover:bg-rose-950/40"
                      aria-label="Remove payout method"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 text-xs divide-y divide-gray-100 dark:bg-gray-950 dark:divide-gray-800">
                    <div className="pb-1.5 flex justify-between gap-2">
                      <span className="text-gray-400 font-medium dark:text-gray-500">Beneficiary</span>
                      <span className="font-bold text-gray-800 text-right dark:text-gray-200">{acc.accountHolderName || '—'}</span>
                    </div>
                    <div className="pt-1.5 flex justify-between gap-2">
                      <span className="text-gray-400 font-medium dark:text-gray-500">Branch</span>
                      <span className="font-semibold text-gray-700 text-right dark:text-gray-300">{acc.branchName || '—'}</span>
                    </div>
                    {acc.routingNumber && acc.routingNumber !== 'N/A' && (
                      <div className="pt-1.5 flex justify-between gap-2">
                        <span className="text-gray-400 font-medium dark:text-gray-500">Routing</span>
                        <span className="font-mono text-gray-700 text-right dark:text-gray-300">{acc.routingNumber}</span>
                      </div>
                    )}
                  </div>

                  {!acc.isDefault && (
                    <Button
                      onClick={() => handleSetDefault(acc.id)}
                      disabled={actionLoading === acc.id}
                      variant="outline"
                      className="w-full h-9 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800 dark:border-gray-700"
                    >
                      {actionLoading === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set as primary payout account'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add CTA at the end (always visible when not loading/error) */}
        {!loading && !authRequired && !error && accounts.length > 0 && (
          <Button
            onClick={() => navigate('add-bank-account')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Link another bank account
          </Button>
        )}
      </main>
    </motion.div>
  );
}

export default SellerPayoutMethodsPagePage;
