'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { AlertCircle, ArrowLeft, BarChart3, CalendarClock, MousePointerClick, Package, Tag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { campaignLabel, type StorefrontCampaign } from '@/components/supplier/storefront-campaigns';

/**
 * Task 115: CAMPAIGN ANALYTICS — REAL numbers only. The old page invented
 * "+340% ROI" and "৳45 cost/acquisition" out of thin air; those numbers had
 * no source and were deleted. What the platform can PROVE about a campaign
 * lives here: its computed lifecycle status, the ATOMIC usage counter
 * (orders actually priced under it), the window, the caps and the pinned
 * products. No fabricated ROI — a number with no source is a lie wearing a
 * chart.
 */

type AnalyticsRow = StorefrontCampaign & {
  isActive: boolean;
  usedCount: number;
  usageLimit: number | null;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  pinnedProducts: Array<{ id: string; name: string }>;
};

function computedStatus(r: { isActive: boolean; validFrom: string; validUntil: string }): string {
  if (!r.isActive) return 'paused';
  const now = Date.now();
  if (now < new Date(r.validFrom).getTime()) return 'scheduled';
  if (now > new Date(r.validUntil).getTime()) return 'ended';
  return 'live';
}

export function PromotionAnalyticsPage({ id: idProp }: { id?: string }) {
  const { goBack, pageParams } = useNavigationStore();
  // The chunk renderer mounts pages with NO props — the id rides in the
  // navigation store (navigate('promotion-analytics', { id })) just like
  // the storefront's pageParams.supplierId.
  const id = idProp ?? pageParams.id;
  const [row, setRow] = useState<AnalyticsRow | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError('No campaign selected');
      setLoading(false);
      return;
    }
    let dead = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/supplier/promotions/${encodeURIComponent(id)}`, { credentials: 'include' });
        const json = await res.json();
        if (dead) return;
        if (res.ok && json.success) setRow(json.data);
        else setError(json.error || 'Campaign not found');
      } catch {
        if (dead) return;
        setError('Could not reach the campaigns service');
      } finally {
        if (!dead) setLoading(false);
      }
    };
    load();
    return () => {
      dead = true;
    };
  }, [id]);

  const status = row ? computedStatus(row) : '';
  const daysLeft = row ? Math.ceil((new Date(row.validUntil).getTime() - Date.now()) / 86_400_000) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:bg-gray-900 flex flex-col">
      {/* Mobile header (red) */}
      <header className="md:hidden bg-primary text-white p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center">
          <button onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none active:scale-95 transition-transform" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">Campaign Analytics</h1>
        </div>
      </header>
      {/* Desktop header */}
      <header className="hidden md:flex sticky top-0 z-20 items-center gap-3 px-6 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <button onClick={goBack} className="p-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:bg-gray-700 transition" aria-label="Go back">
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-xl font-bold text-primary">Campaign Analytics</h1>
      </header>
      <main className="flex-1 p-4 md:p-6 md:max-w-3xl md:mx-auto md:w-full pb-20 md:pb-8">
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : error || !row ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-6 rounded-xl text-center shadow border border-gray-100 dark:border-gray-800 dark:border-gray-700">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">{error || 'Campaign not found'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100 dark:text-white">{row.name}</h2>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{campaignLabel(row)}</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-700 text-xs font-bold capitalize text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">{status}</span>
              </div>
              {row.description ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{row.description}</p> : null}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700">
                <MousePointerClick className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-1" />
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">{row.usedCount}</div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 dark:text-gray-500">Orders priced</div>
              </div>
              <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700">
                <BarChart3 className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-1" />
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">
                  {row.usageLimit ? `${row.usedCount}/${row.usageLimit}` : '∞'}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 dark:text-gray-500">Usage cap</div>
              </div>
              <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700">
                <CalendarClock className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-1" />
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">
                  {status === 'live' ? (daysLeft > 0 ? daysLeft : 0) : '—'}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 dark:text-gray-500">{status === 'live' ? 'Days left' : 'Not running'}</div>
              </div>
              <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700">
                <Package className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-1" />
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">{row.pinnedProducts.length}</div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 dark:text-gray-500">Products pinned</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-white mb-2">How the money works</h3>
              <ul className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 space-y-1.5 list-disc pl-4">
                <li>This campaign is <span className="font-semibold text-gray-700 dark:text-gray-300">seller-funded</span>: every order priced under it takes the discount off YOUR subOrder subtotal.</li>
                {row.minOrderAmount ? <li>Only order lines pinned here and totaling at least ৳{row.minOrderAmount.toLocaleString()} are eligible.</li> : <li>No minimum order floor.</li>}
                {row.maxDiscount ? <li>The discount never exceeds ৳{row.maxDiscount.toLocaleString()} per order.</li> : null}
                <li>The usage counter increments atomically at checkout — a campaign exhausted between read and write refuses the order rather than repricing it.</li>
                <li>Window: {new Date(row.validFrom).toLocaleString()} → {new Date(row.validUntil).toLocaleString()}.</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-white mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 dark:text-gray-400" /> Pinned products
              </h3>
              {row.pinnedProducts.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">No products pinned — this campaign cannot price anything until you pin products.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {row.pinnedProducts.map((p) => (
                    <span key={p.id} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">
                      {p.name || p.id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PromotionAnalyticsPage;
