'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Edit, MapPin, MessageCircle, Share2, Star, CheckCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export const SellerStorefrontPage = () => {
  const { goBack, navigate } = useNavigationStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const res = await fetch('/api/supplier/storefront');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8">
      {/* Banner Area */}
      <div className="relative h-48 bg-gray-200 dark:bg-gray-800">
        {loading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <img src={data?.bannerUrl || 'https://via.placeholder.com/800x400'} alt="Store Banner" className="w-full h-full object-cover" />
        )}
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

      {/* Profile Header */}
      <div className="px-4 relative pt-12 pb-4 bg-white dark:bg-gray-800 shadow-sm mb-2">
        <div className="absolute -top-10 left-4">
          {loading ? (
            <Skeleton className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800" />
          ) : (
            <img src={data?.logoUrl || 'https://via.placeholder.com/150'} alt="Logo" className="w-20 h-20 rounded-xl border-4 border-white dark:border-gray-800 object-cover bg-white" />
          )}
        </div>
        
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {loading ? <Skeleton className="w-32 h-6" /> : data?.storeName}
              {!loading && data?.isGold && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-sm uppercase tracking-wider">Gold</span>}
            </h1>
            <div className="flex items-center text-sm text-gray-500 mt-1 gap-3">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {data?.location || 'Bangladesh'}</span>
              <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" /> Verified</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <div className="text-center">
            <div className="text-sm font-bold dark:text-white">{loading ? '-' : data?.rating} <Star className="w-3 h-3 inline text-amber-400 mb-0.5" fill="currentColor" /></div>
            <div className="text-[10px] text-gray-500 uppercase">Rating</div>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <div className="text-sm font-bold dark:text-white">{loading ? '-' : data?.responseRate}%</div>
            <div className="text-[10px] text-gray-500 uppercase">Response</div>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <div className="text-sm font-bold dark:text-white">{loading ? '-' : data?.onTimeDelivery}%</div>
            <div className="text-[10px] text-gray-500 uppercase">On-Time</div>
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
              ) : (
                data?.products?.map((prod: any) => (
                  <div key={prod.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                    <img src={prod.image} alt={prod.name} className="w-full aspect-square object-cover" />
                    <div className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 dark:text-white mb-1">{prod.name}</h3>
                      <div className="font-bold text-primary">৳{prod.price} <span className="text-xs font-normal text-gray-500">/ {prod.unit}</span></div>
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
    </div>
  );
};

export default SellerStorefrontPage;
