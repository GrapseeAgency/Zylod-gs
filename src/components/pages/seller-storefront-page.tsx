'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Edit, Package, Share2, Star, ImageOff, Store, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface StorefrontData {
  companyName?: string;
  verificationStatus?: string;
  ratingAvg?: number;
  ratingCount?: number;
  storeCustomization?: { bannerUrl?: string | null; logoUrl?: string | null } | null;
  products?: Array<{
    id: string;
    name: string;
    basePrice: number;
    unit: string;
    moq: number;
    thumbnailUrl?: string | null;
  }>;
}

/** Initials circle from the store's real company name (up to 2 letters). */
function StoreInitials({ name, className }: { name: string; className: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('') || '?';
  return (
    <div
      className={`${className} flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-black select-none`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

export const SellerStorefrontPage = () => {
  const { goBack, navigate } = useNavigationStore();
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await fetch('/api/supplier/storefront');
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setData(json.data);
        } else {
          // Real API error surfaced — no demo content is substituted.
          setError(json.error || 'Store profile not available');
        }
      } catch (e) {
        console.error(e);
        setError('Could not reach the store service');
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, []);

  const companyName = data?.companyName ?? '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8">
      {/* Banner Area — neutral gradient when no real banner is set */}
      <div className="relative h-48 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700">
        {loading ? (
          <Skeleton className="w-full h-full" />
        ) : data?.storeCustomization?.bannerUrl ? (
          <img src={data.storeCustomization.bannerUrl} alt="Store Banner" className="w-full h-full object-cover" />
        ) : !error ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <ImageOff className="w-8 h-8" />
          </div>
        ) : null}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <button onClick={goBack} className="md:hidden p-2 bg-black/50 text-white rounded-full backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm" onClick={() => navigate('store-banner-editor')}>
              <Edit className="w-5 h-5" />
            </button>
            <button className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        /* Honest state — no demo store content is invented */
        <div className="px-4 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">Store profile not available</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">{error}</p>
          <Button onClick={goBack} className="mt-4">Go Back</Button>
        </div>
      ) : (
        <>
          {/* Profile Header */}
          <div className="px-4 relative pt-12 pb-4 bg-white dark:bg-gray-800 shadow-sm mb-2">
            <div className="absolute -top-10 left-4">
              {loading ? (
                <Skeleton className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800" />
              ) : data?.storeCustomization?.logoUrl ? (
                <img src={data.storeCustomization.logoUrl} alt="Logo" className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800 object-cover bg-white" />
              ) : companyName ? (
                <StoreInitials name={companyName} className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800 text-2xl" />
              ) : (
                <div className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <Store className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="flex justify-between items-start mb-2">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {loading ? <Skeleton className="w-32 h-6" /> : companyName || 'Unnamed store'}
                </h1>
                <div className="flex items-center text-sm text-gray-500 mt-1 gap-3">
                  {/* Verified only reflects the real KYC verification status */}
                  {data?.verificationStatus === 'approved' && (
                    <span className="flex items-center gap-1 text-green-600">Verified</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 py-3 border-t border-gray-100 dark:border-gray-700">
              {/* Only real, sourced metrics are displayed */}
              <div className="text-center">
                <div className="text-sm font-bold dark:text-white flex items-center gap-1">
                  {loading
                    ? '-'
                    : data?.ratingCount && data.ratingCount > 0
                      ? data.ratingAvg?.toFixed(1)
                      : '—'}
                  <Star className="w-3 h-3 inline text-amber-400 mb-0.5" fill="currentColor" />
                </div>
                <div className="text-[10px] text-gray-500 uppercase">Rating</div>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div className="text-center">
                <div className="text-sm font-bold dark:text-white">{loading ? '-' : data?.ratingCount ?? 0}</div>
                <div className="text-[10px] text-gray-500 uppercase">Reviews</div>
              </div>
            </div>
          </div>

          {/* Tabs Content */}
          <Tabs defaultValue="products" className="w-full">
            <div className="bg-white dark:bg-gray-800 px-4 pt-2 sticky top-0 z-10 shadow-sm">
              <TabsList className="w-full h-auto p-0 bg-transparent gap-6 flex justify-start overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-gray-700 rounded-none">
                <TabsTrigger value="products" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">All Products</TabsTrigger>
                <TabsTrigger value="featured" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Featured</TabsTrigger>
                <TabsTrigger value="story" className="p-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" onClick={() => navigate('store-story-about')}>Profile</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4">
              <TabsContent value="products" className="mt-0 outline-none">
                <div className="grid grid-cols-2 gap-3">
                  {loading ? (
                    [1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)
                  ) : (data?.products?.length ?? 0) === 0 ? (
                    <div className="col-span-full text-center py-10">
                      <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No products listed yet</h3>
                      <p className="text-xs text-gray-500 mt-1">This store has not published any active products.</p>
                    </div>
                  ) : (
                    data?.products?.map((prod) => (
                      <div key={prod.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700">
                          {prod.thumbnailUrl ? (
                            <img src={prod.thumbnailUrl} alt={prod.name} className="w-full aspect-square object-cover" />
                          ) : (
                            <div className="w-full aspect-square flex items-center justify-center text-gray-300 dark:text-gray-500">
                              <Package className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-medium text-sm line-clamp-2 dark:text-white mb-1">{prod.name}</h3>
                          <div className="font-bold text-primary">৳{prod.basePrice} <span className="text-xs font-normal text-gray-500">/ {prod.unit}</span></div>
                          <div className="text-xs text-gray-500 mt-1">Min. {prod.moq} {prod.unit}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="featured" className="mt-0 outline-none">
                <div className="text-center py-10">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-gray-500 font-medium mb-4">Set up featured collections</h3>
                  <Button onClick={() => navigate('store-featured-products')}>Manage Featured Products</Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default SellerStorefrontPage;
