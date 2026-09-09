'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { ArrowLeft, Trash2, Heart, ShoppingCart, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: string;
  name: string;
  basePrice: number;
  currency: string;
  moq: number;
  thumbnailUrl: string;
  supplier?: { companyName: string };
  priceTiers?: { minQty: number; price: number }[];
}

interface RecentlyViewedItem {
  id: string;
  viewedAt: string;
  product: Product;
}

export function RecentlyViewedPage() {
  const { goBack, navigate } = useNavigationStore();
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (cursor?: string | null) => {
    try {
      const url = new URL('/api/products/recently-viewed', window.location.origin);
      if (cursor) url.searchParams.set('cursor', cursor);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch');
      
      const { data, meta } = await res.json();
      
      if (cursor) {
        setItems(prev => [...prev, ...data]);
      } else {
        setItems(data);
      }
      
      setNextCursor(meta.nextCursor);
      setHasMore(meta.hasMore);
    } catch (error) {
      console.error('Error fetching recently viewed:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setLoadingMore(true);
          fetchItems(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, nextCursor, fetchItems]);

  const clearAll = async () => {
    try {
      await fetch('/api/products/recently-viewed', { method: 'DELETE' });
      setItems([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const groupItems = () => {
    const groups: { [key: string]: RecentlyViewedItem[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: []
    };

    const now = new Date();
    
    items.forEach(item => {
      const date = new Date(item.viewedAt);
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays <= 1) groups['Today'].push(item);
      else if (diffDays === 2) groups['Yesterday'].push(item);
      else if (diffDays <= 7) groups['This Week'].push(item);
      else groups['Older'].push(item);
    });

    return Object.entries(groups).filter(([_, groupItems]) => groupItems.length > 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 pb-20 md:pb-8">
        <header className="md:hidden sticky top-0 z-10 bg-white px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="w-32 h-6" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="w-full h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="sticky top-0 z-10 bg-white px-4 py-4 border-b flex items-center justify-between md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="md:hidden p-1 -ml-1">
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Recently Viewed</h1>
        </div>
        {items.length > 0 && (
          <button onClick={clearAll} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </header>
      
      <div className="px-4 py-2 md:px-6">
        <p className="text-sm text-gray-500">Products you've checked out recently</p>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <EyeOff className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No recently viewed products</h2>
          <p className="text-gray-500 mb-6">Your browsing history will appear here.</p>
          <Button 
            className="bg-[#C8102E] hover:bg-[#A30D25] text-white px-8"
            onClick={() => navigate('home')}
          >
            Start exploring
          </Button>
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-6 md:p-6 md:max-w-4xl md:mx-auto md:w-full">
          {groupItems().map(([groupName, groupItems]) => (
            <div key={groupName}>
              <h3 className="font-semibold text-gray-800 mb-3">{groupName}</h3>
              <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                <AnimatePresence>
                  {groupItems.map(item => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-3 relative overflow-hidden"
                      onClick={() => navigate('product-detail', { productId: item.product.id })}
                    >
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 relative">
                        {item.product.thumbnailUrl && (
                          <img src={item.product.thumbnailUrl} alt={item.product.name} className="w-full h-full object-cover rounded-lg" />
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{item.product.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{item.product.supplier?.companyName || 'Supplier'}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div>
                            <span className="text-[#C8102E] font-bold text-sm">
                              {item.product.currency} {item.product.basePrice}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">/ {item.product.moq} MOQ</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 text-gray-400 hover:text-[#C8102E] rounded-full hover:bg-red-50" onClick={(e) => { e.stopPropagation(); /* Add to wishlist logic */ }}>
                              <Heart className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 bg-[#C8102E] text-white rounded-full shadow-sm" onClick={(e) => { e.stopPropagation(); /* Add to cart logic */ }}>
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
          
          <div ref={observerTarget} className="h-4 w-full flex justify-center py-4">
            {loadingMore && <Loader2 className="w-6 h-6 animate-spin text-[#C8102E]" />}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecentlyViewedPage;
