'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Trophy, Star, Package, Inbox, Medal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RankedProduct {
  rank: number;
  id: string;
  name: string;
  soldCount: number;
  stockQuantity: number;
  ratingAvg: number;
  reviewCount: number;
  unit: string;
}

interface RankingsData {
  totalProducts: number;
  platformRank: number | null;
  tier: string | null;
  products: RankedProduct[];
}

const medalStyle = (rank: number) => {
  if (rank === 1) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  if (rank === 2) return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  if (rank === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
};

export function SellerRankingsPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchRankings = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/supplier/rankings');
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
          setError(json?.error || json?.data?.error || 'Failed to load rankings');
          setData(null);
        }
      } catch {
        if (alive) setError('Could not reach the rankings service');
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchRankings();
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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Rankings</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-white">Rankings</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Trophy className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sign in with a supplier account to see your product rankings.</p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Honest platform-rank card — the endpoint has no marketplace-wide data */}
            <Card className="border-none shadow-sm dark:bg-gray-800">
              <CardContent className="p-4 flex items-start gap-3">
                <Medal className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  <span className="font-semibold text-gray-900 dark:text-white">Your best sellers, ranked by units sold.</span>{' '}
                  A platform-wide rank and supplier tier aren&apos;t computed yet — they will appear here when the
                  marketplace ranks stores against each other, not before.
                </div>
              </CardContent>
            </Card>

            {data.products.length === 0 ? (
              <Card className="border-dashed dark:bg-gray-800">
                <CardContent className="p-10 text-center space-y-2">
                  <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nothing to rank yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Add products and make sales — your top 10 best sellers will rank here by units sold.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                    <Trophy className="w-4 h-4 text-primary" />
                    Top {data.products.length} product{data.products.length === 1 ? '' : 's'} · {data.totalProducts} ranked
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2" data-testid="rankings-list">
                  {data.products.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${medalStyle(p.rank)}`}>
                        {p.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={p.name}>{p.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {p.ratingAvg ? p.ratingAvg.toFixed(1) : '—'}
                            {p.reviewCount > 0 && <span>({p.reviewCount})</span>}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            stock {p.stockQuantity} {p.unit}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums" data-testid={`rankings-sold-${p.rank}`}>{p.soldCount}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">sold</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center">
              Ranked by real soldCount from recorded orders · <Badge variant="outline" className="text-[10px]">updated live</Badge>
            </p>
          </>
        ) : null}
      </main>
    </motion.div>
  );
}

export default SellerRankingsPagePage;
