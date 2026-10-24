'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { Star, AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealtimeRoom } from '@/hooks/use-realtime-room';

interface SellerReview {
  id: string;
  kind?: 'product' | 'store';
  supplierId?: string;
  rating: number;
  comment: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  productName: string | null;
  buyerName: string;
}

export function SellerReviewsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [storeAverageRating, setStoreAverageRating] = useState(0);
  const [storeTotalReviews, setStoreTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/supplier/reviews');
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setReviews(json.data.reviews || []);
        setAverageRating(json.data.averageRating ?? 0);
        setTotalReviews(json.data.totalReviews ?? 0);
        setStoreAverageRating(json.data.storeAverageRating ?? 0);
        setStoreTotalReviews(json.data.storeTotalReviews ?? 0);
      } else {
        setError(json.error || 'Could not load reviews');
      }
    } catch {
      setError('Could not reach the reviews service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ─── Real-time review tap (cohesion): a buyer's new store review is
  // broadcast to the token-gated seller room (POST /api/suppliers/[id]/reviews).
  // The room id is the real supplierProfiles.id the server returned with the
  // rows; the room-token endpoint re-verifies ownership, and a denial degrades
  // honestly to the manual refresh — never a faked live state.
  const reviewRoom = reviews[0]?.supplierId ? `seller:${reviews[0].supplierId}` : null;
  useRealtimeRoom(reviewRoom ? [reviewRoom] : [], {
    // optionsRef keeps this fresh every render, so calling `load` inline is safe.
    onEvent: (message) => {
      if (message.event === 'supplier:reviewed') void load();
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="md:hidden bg-primary text-white p-4 flex items-center">
        <button onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none active:scale-95 transition-transform" aria-label="Go back">←</button>
        <h1 className="text-xl font-bold">Seller Reviews</h1>
      </header>
      <h1 className="hidden md:block text-2xl font-bold text-slate-900 dark:text-slate-100">Seller Reviews</h1>
      <main className="flex-1 p-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded shadow text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-1" /> Retry
            </Button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white dark:bg-gray-900 p-4 rounded shadow">
              <h2 className="text-lg font-bold">Rating Overview</h2>
              <div className="flex items-center space-x-2 mt-2">
                <Star className="text-yellow-500" />
                {/* Real average from the supplier's own product reviews — no
                    fabricated default when there are none. */}
                <span className="text-2xl font-bold">
                  {totalReviews > 0 ? averageRating.toFixed(1) : '—'}
                </span>
                <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">({totalReviews} product review{totalReviews !== 1 ? 's' : ''})</span>
              </div>
              {storeTotalReviews > 0 && (
                <div className="flex items-center space-x-2 mt-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-semibold">{storeAverageRating.toFixed(1)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">({storeTotalReviews} store review{storeTotalReviews !== 1 ? 's' : ''})</span>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 p-8 rounded shadow text-center">
                  <Star className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No reviews yet</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                    Buyer reviews for your products will appear here once buyers start reviewing.
                  </p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="bg-white dark:bg-gray-900 p-4 rounded shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold">{review.buyerName}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                          {review.productName ?? 'Store review'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.kind === 'store' && (
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">Store</span>
                        )}
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} />
                          ))}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {review.comment && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{review.comment}</p>}
                    {review.verifiedPurchase && (
                      <span className="inline-block mt-2 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        Verified purchase
                      </span>
                    )}
                    <div className="mt-4 flex space-x-2">
                      <button onClick={() => navigate('seller-review-reply', { id: review.id })} className="flex items-center text-primary text-sm font-semibold">
                        <MessageSquare className="w-4 h-4 mr-1" /> Reply
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerReviewsPage;
