'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Award, ShieldCheck, Star, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * BADGE LEVELS — honest page. No badge-award engine exists on the platform
 * (badges would be invented numbers). The ONE badge that is real today is
 * the verification badge (KYC-approved stores). This page says exactly that
 * and links to the real systems.
 */
export function SellerBadgeLevelsPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);

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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Badge levels</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100 dark:text-white">Badge levels</h1>

        {/* The one REAL badge */}
        <Card className="border-none shadow-sm dark:bg-gray-800">
          <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-white flex items-center gap-2">
                  Verified Supplier badge
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">LIVE</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5 max-w-lg">
                  Earned by passing real KYC + trade-license verification — the badge buyers see on your
                  storefront. Not a level, not a score: it is a verified fact.
                </p>
              </div>
            </div>
            <Button size="sm" className="h-9 shrink-0" onClick={() => navigate('seller-verification')}>
              Verification
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed dark:bg-gray-800">
          <CardContent className="p-6 md:p-8 text-center space-y-3">
            <Award className="w-10 h-10 text-gray-300 mx-auto" />
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="badges-honest">
              Level badges aren&apos;t live yet
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300 leading-relaxed max-w-md mx-auto">
              Bronze-to-diamond style level badges need a real award engine — none exists yet, so none are
              shown. When badge levels launch, they will be earned from measured store history, never
              granted for show.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Star className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">
                Your <button className="font-semibold underline underline-offset-2" onClick={() => navigate('seller-rankings')}>product rankings</button> already show real sales standings.
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">
                Your <button className="font-semibold underline underline-offset-2" onClick={() => navigate('seller-sales-funnel')}>fulfillment rate</button> is the metric future badges will read.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </motion.div>
  );
}

export default SellerBadgeLevelsPagePage;
