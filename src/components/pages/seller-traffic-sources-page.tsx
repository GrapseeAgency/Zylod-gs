'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, MousePointerClick, BarChart3, Eye, Search, Share2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * TRAFFIC SOURCES — honest page. The platform has NO traffic tracking yet:
 * /api/supplier/analytics returns trafficSources: [] and the performance
 * funnel's impressions/clicks/inquiries are null BY DESIGN (never invented).
 * This page states exactly that, shows which channels WILL be tracked, and
 * routes the seller to the analytics that DO have real numbers today.
 */
const PLANNED_CHANNELS = [
  { icon: Search, label: 'Zylod search', note: 'visits that started from a marketplace search' },
  { icon: Eye, label: 'Direct & product pages', note: 'buyers opening your storefront or products' },
  { icon: Share2, label: 'Social', note: 'links shared to Facebook, WhatsApp and others' },
  { icon: Link2, label: 'Campaigns & referrals', note: 'affiliate and promotion-driven visits' },
];

export function SellerTrafficSourcesPagePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);

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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Traffic sources</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto md:pt-6">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-white">Traffic sources</h1>

        <Card className="border-none shadow-sm dark:bg-gray-800">
          <CardContent className="p-6 md:p-8 text-center space-y-3">
            <MousePointerClick className="w-10 h-10 text-gray-300 mx-auto" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white" data-testid="traffic-honest">
              Traffic tracking isn&apos;t live yet
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-md mx-auto">
              Zylod doesn&apos;t record storefront visits, impressions or click channels yet — so this page has
              no numbers, and it will never show invented percentages. When visit tracking ships, every
              channel below lights up with real data.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PLANNED_CHANNELS.map((ch) => (
            <Card key={ch.label} className="border-dashed dark:bg-gray-800">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 shrink-0">
                  <ch.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{ch.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ch.note}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-none shadow-sm dark:bg-gray-800">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-200">
                Your <span className="font-semibold">real</span> sales numbers live in Analytics today — GMV,
                orders, units sold and best sellers, all from recorded order lines.
              </p>
            </div>
            <Button size="sm" className="h-9 shrink-0" onClick={() => navigate('seller-analytics')}>
              Open Analytics
            </Button>
          </CardContent>
        </Card>
      </main>
    </motion.div>
  );
}

export default SellerTrafficSourcesPagePage;
