'use client';

import React, { useEffect, useState } from 'react';
import { BadgePercent, Tag, ImageOff, Package, Loader2, CalendarClock } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Task 115: THE CAMPAIGN RAIL on the storefront. Buyers read a seller's
 * LIVE campaigns — real rows from the promotions table (supplierId set),
 * each with REAL pricing teeth at checkout (seller-funded). Only active,
 * in-window campaigns are served by the API; pinned products are only
 * listed when they are active + approved right now. Empty means empty: a
 * store without live campaigns shows the honest empty state, never an
 * invented sale.
 */

export interface StorefrontCampaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  bannerImageUrl: string | null;
  validFrom: string;
  validUntil: string;
  products: Array<{
    id: string;
    name: string;
    unitPrice: number;
    unit: string;
    bundleSize: number | null;
    inStock: boolean;
    image: string | null;
  }>;
}

/** The honest discount label — only what the engine actually computes. */
export function campaignLabel(c: { type: string; value: number }): string {
  if (c.type === 'percentage') return `${c.value}% OFF`;
  if (c.type === 'fixed') return `৳${c.value.toLocaleString()} OFF`;
  return c.type;
}

const CampaignCard = ({ c }: { c: StorefrontCampaign }) => {
  const { navigate } = useNavigationStore();
  const end = new Date(c.validUntil);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      <div className="relative h-28 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-gray-700 dark:to-gray-800">
        {c.bannerImageUrl ? (
          <img src={c.bannerImageUrl} alt={c.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-500/70 dark:text-gray-500">
            <BadgePercent className="w-8 h-8" />
          </div>
        )}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow">
          {campaignLabel(c)}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{c.name}</h3>
        {c.description ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{c.description}</p>
        ) : null}
        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mt-2">
          <CalendarClock className="w-3 h-3" />
          {daysLeft > 0 ? `Ends in ${daysLeft} day${daysLeft > 1 ? 's' : ''}` : 'Ending today'}
        </div>
        {c.products.length > 0 ? (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
              {c.products.length} product{c.products.length > 1 ? 's' : ''} in this campaign
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {c.products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate('product-detail', { productId: p.id })}
                  className="shrink-0 w-24 text-left group"
                  aria-label={`View ${p.name}`}
                >
                  <div className="w-24 h-24 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-500">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate mt-1">{p.name}</div>
                  <div className="text-[11px] text-primary font-bold">
                    ৳{p.unitPrice} <span className="text-gray-400 font-normal">/{p.unit}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
            <ImageOff className="w-3 h-3" /> Campaign products are being prepared
          </div>
        )}
      </div>
    </div>
  );
};

export const StorefrontCampaigns = ({ supplierId }: { supplierId: string }) => {
  const [campaigns, setCampaigns] = useState<StorefrontCampaign[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/campaigns`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (dead) return;
        if (res.ok && json.success) {
          setCampaigns(json.data?.campaigns ?? []);
        } else {
          setError(json.error || 'Could not load campaigns');
          setCampaigns([]);
        }
      } catch {
        if (dead) return;
        setError('Could not reach the campaigns service');
        setCampaigns([]);
      } finally {
        if (!dead) setLoading(false);
      }
    };
    if (supplierId) load();
    return () => {
      dead = true;
    };
  }, [supplierId]);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <Tag className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-10">
        <BadgePercent className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No live campaigns right now</h3>
        <p className="text-xs text-gray-500 mt-1">When this store runs a campaign, it appears here — and the discount applies at checkout automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-label="Store campaigns">
      {campaigns.map((c) => (
        <CampaignCard key={c.id} c={c} />
      ))}
    </div>
  );
};

export default StorefrontCampaigns;
