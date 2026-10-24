'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Layers, Trophy, ShieldCheck, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * TIER BENEFITS — honest page. The platform has NO live supplier tier
 * program (GET /api/supplier/rankings returns tier: null BY DESIGN — never a
 * fabricated "Gold Supplier" scorecard). This page says exactly that and
 * routes sellers to the three REAL standing systems that exist today:
 * verification, rankings and performance.
 */
const LIVE_TODAY = [
  {
    icon: ShieldCheck, title: 'Verification status',
    body: 'Your KYC and trade-license verification is real and live — verified stores carry the badge buyers see.',
    page: 'seller-verification', cta: 'Open verification',
  },
  {
    icon: Trophy, title: 'Product rankings',
    body: 'Your best sellers rank by real units sold from recorded orders — live numbers, no invented tiers.',
    page: 'seller-rankings', cta: 'Open rankings',
  },
  {
    icon: BarChart3, title: 'Performance pipeline',
    body: 'Fulfillment rate, pending shipments and delivery counts — computed from your real subOrders.',
    page: 'seller-sales-funnel', cta: 'Open funnel',
  },
];

export function SellerTierBenefitsPagePage() {
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
        <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:bg-gray-700" aria-label="Go back">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Tier benefits</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100 dark:text-white">Tier benefits</h1>

        <Card className="border-none shadow-sm dark:bg-gray-800">
          <CardContent className="p-6 md:p-8 text-center space-y-3">
            <Layers className="w-10 h-10 text-gray-300 mx-auto" />
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="tier-honest">
              The tier program isn&apos;t live yet
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300 leading-relaxed max-w-md mx-auto">
              Zylod hasn&apos;t launched supplier tiers, so there are no tier benefits to claim — and this page
              will never describe invented tiers. Here is what your store can actually use today:
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {LIVE_TODAY.map((item) => (
            <Card key={item.title} className="border-none shadow-sm dark:bg-gray-800">
              <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-700 text-primary shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-lg">{item.body}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => navigate(item.page)}>
                  {item.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </motion.div>
  );
}

export default SellerTierBenefitsPagePage;
